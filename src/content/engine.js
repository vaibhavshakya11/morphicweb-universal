/*
 * MorphicWeb — Content Engine
 *
 * Runs in the content-script isolated world at document_start. Loaded BEFORE the
 * feature files and bootstrap (see manifest content_scripts order), so it just sets
 * up the shared namespace + registry + helpers. Features self-register into it; the
 * bootstrap wires it to storage and starts it.
 *
 * Design notes (from the plan, Part B):
 *  - Every feature implements { id, category, label, defaults, apply, revert, onMutation? }.
 *  - Visual features are pure CSS injection where possible (instant, trivially reversible).
 *  - We cloak the page at document_start and reveal once the first synchronous pass runs,
 *    to avoid a flash of un-adapted content. Reveal is also guaranteed on a timeout so we
 *    never leave a page invisible if something throws.
 *  - No SharedArrayBuffer, no network interception — see plan Part A corrections.
 */
(() => {
  if (globalThis.__morphicEngine) return; // guard against double-injection

  const STORAGE_KEY = 'morphic.profile';
  const CLOAK_STYLE_ID = '__morphic_cloak';
  const REVEAL_FAILSAFE_MS = 1500;

  /** @type {Map<string, Feature>} */
  const features = new Map();

  const state = {
    enabled: true,        // master switch
    showOriginal: false,  // global "show original" — reverts everything visually
    settings: {},         // per-feature settings, keyed by feature id
    revealed: false,
  };

  // ---- CSS / DOM helpers --------------------------------------------------

  function styleEl(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      el.setAttribute('data-morphic', 'true');
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  /** Inject (or replace) a <style> block keyed by id. */
  function injectCSS(id, css) {
    styleEl('morphic-' + id).textContent = css;
  }

  /** Remove a previously injected <style> block. */
  function removeCSS(id) {
    document.getElementById('morphic-' + id)?.remove();
  }

  /** Toggle a flag class/attribute on <html> so CSS can scope to it. */
  function setRootFlag(name, on) {
    document.documentElement.toggleAttribute('data-morphic-' + name, !!on);
  }

  // ---- Cloak / reveal -----------------------------------------------------

  function cloak() {
    // Only cloak if we actually have visual features active, to avoid a pointless flash.
    const css = ':root{visibility:hidden!important}html[data-morphic-revealed]{visibility:visible!important}';
    styleEl(CLOAK_STYLE_ID).textContent = css;
    // Failsafe: never leave the page hidden.
    setTimeout(reveal, REVEAL_FAILSAFE_MS);
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    document.documentElement.setAttribute('data-morphic-revealed', '');
    // Drop the cloak entirely once revealed.
    document.getElementById(CLOAK_STYLE_ID)?.remove();
  }

  // ---- Registry -----------------------------------------------------------

  /**
   * @typedef {Object} Feature
   * @property {string} id
   * @property {string} category
   * @property {string} label
   * @property {Object} [defaults]   default settings for this feature
   * @property {(ctx: Ctx) => void} apply
   * @property {(ctx: Ctx) => void} revert
   * @property {(nodes: Node[], ctx: Ctx) => void} [onMutation]
   */

  function register(feature) {
    if (!feature || !feature.id) throw new Error('Feature needs an id');
    features.set(feature.id, feature);
  }

  function ctxFor(id) {
    return {
      injectCSS: (css) => injectCSS(id, css),
      removeCSS: () => removeCSS(id),
      setRootFlag,
      get settings() {
        return { ...(features.get(id)?.defaults || {}), ...(state.settings[id] || {}) };
      },
      root: () => document.documentElement,
    };
  }

  function isOn(id) {
    if (!state.enabled || state.showOriginal) return false;
    const s = state.settings[id];
    return !!(s && s.enabled);
  }

  const applied = new Set();

  /** Apply the current state: turn features on/off to match settings. */
  function sync() {
    for (const [id, feature] of features) {
      const shouldBeOn = isOn(id);
      const currentlyOn = applied.has(id);
      try {
        if (shouldBeOn && !currentlyOn) {
          feature.apply(ctxFor(id));
          applied.add(id);
        } else if (!shouldBeOn && currentlyOn) {
          feature.revert(ctxFor(id));
          applied.delete(id);
        } else if (shouldBeOn && currentlyOn && feature.apply) {
          // Re-apply so live settings changes (e.g. spacing slider) take effect.
          feature.apply(ctxFor(id));
        }
      } catch (err) {
        console.warn('[MorphicWeb] feature', id, 'failed:', err);
      }
    }
    reveal();
  }

  // ---- Mutation handling (debounced) -------------------------------------

  let observer = null;
  let pending = [];
  let scheduled = false;

  function flushMutations() {
    scheduled = false;
    const nodes = pending;
    pending = [];
    if (!nodes.length) return;
    for (const [id, feature] of features) {
      if (feature.onMutation && applied.has(id)) {
        try {
          feature.onMutation(nodes, ctxFor(id));
        } catch (err) {
          console.warn('[MorphicWeb] onMutation', id, err);
        }
      }
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeType === 1) pending.push(n);
        }
      }
      if (!scheduled && pending.length) {
        scheduled = true;
        // ~30Hz cap (plan Part F) so dynamic/SPA pages don't thrash.
        setTimeout(flushMutations, 33);
      }
    });
    const target = document.body || document.documentElement;
    observer.observe(target, { childList: true, subtree: true });
  }

  // ---- Public API ---------------------------------------------------------

  const engine = {
    register,
    cloak,
    reveal,
    startObserver,
    STORAGE_KEY,

    /** Replace the whole runtime state and re-sync. */
    setProfile(profile) {
      if (!profile) return;
      state.enabled = profile.enabled !== false;
      state.showOriginal = !!profile.showOriginal;
      state.settings = profile.settings || {};
      sync();
    },

    getState: () => state,
    listFeatures: () => [...features.values()].map((f) => ({
      id: f.id, category: f.category, label: f.label, defaults: f.defaults || {},
    })),
  };

  globalThis.__morphicEngine = engine;
})();
