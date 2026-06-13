/*
 * MorphicWeb — Content bootstrap (loaded last). Wires the engine to chrome.storage and starts
 * it. Honors per-site rules: a site can use custom settings or be turned off entirely.
 *
 * Cloak strategy: only hide the page when there is at least one active feature, and reveal the
 * instant the first apply pass finishes (or via the engine failsafe). Idle pages are never cloaked.
 */
(() => {
  const E = globalThis.__morphicEngine;
  if (!E) return;

  const PKEY = E.STORAGE_KEY;        // 'morphic.profile'
  const CKEY = 'morphic.config';
  const ORIGIN = location.origin;
  const DEFAULT_PROFILE = { enabled: true, showOriginal: false, settings: {} };

  let globalProfile = DEFAULT_PROFILE;
  let config = {};

  // Resolve the profile that actually applies to THIS site.
  function effective() {
    const rule = config.siteRules?.[ORIGIN];
    if (rule?.mode === 'off') return { enabled: false, showOriginal: false, settings: {} };
    if (rule?.mode === 'custom') return { enabled: true, showOriginal: false, settings: rule.settings || {} };
    return globalProfile;
  }

  function hasActiveFeature(p) {
    if (!p || p.enabled === false || p.showOriginal) return false;
    return Object.values(p.settings || {}).some((s) => s && s.enabled);
  }
  function whenBodyReady(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn, { once: true }); }

  function applyNow() {
    const p = effective();
    whenBodyReady(() => { E.setProfile(p); E.startObserver(); });
  }

  E.cloak();

  chrome.storage.local.get([PKEY, CKEY], (data) => {
    globalProfile = data[PKEY] || DEFAULT_PROFILE;
    config = data[CKEY] || {};
    if (!hasActiveFeature(effective())) { E.reveal(); return; }
    applyNow();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[PKEY]) globalProfile = changes[PKEY].newValue || DEFAULT_PROFILE;
    if (changes[CKEY]) config = changes[CKEY].newValue || {};
    if (changes[PKEY] || changes[CKEY]) { E.setProfile(effective()); E.startObserver(); }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'morphic:readAloud') globalThis.__morphicTTS?.toggle();
  });
})();
