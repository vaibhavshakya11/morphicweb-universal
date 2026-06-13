/*
 * MorphicWeb — Content utilities shared by features (loaded after engine, before features).
 * Attaches to globalThis.__morphicUtil.
 */
(() => {
  if (globalThis.__morphicUtil) return;

  const BLOCK_SEL = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, dd, figcaption';
  const SKIP_ANCESTOR = 'nav, footer, aside, script, style, noscript, [role="navigation"], [aria-hidden="true"], .morphic-ui';

  function isVisible(el) {
    if (!el || !el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0;
  }

  /** Best guess at the main content container. */
  function mainContent() {
    const explicit = document.querySelector('main, [role="main"], article');
    if (explicit && isVisible(explicit)) return explicit;
    // density heuristic: container with the most paragraph text
    let best = document.body, bestScore = 0;
    document.querySelectorAll('article, section, div').forEach((el) => {
      if (el.closest(SKIP_ANCESTOR)) return;
      const ps = el.querySelectorAll(':scope > p');
      let score = 0;
      ps.forEach((p) => { score += (p.textContent || '').length; });
      if (score > bestScore) { bestScore = score; best = el; }
    });
    return best;
  }

  /** Readable text blocks in document order, skipping chrome/nav. */
  function readableBlocks(root = document.body) {
    if (!root) return [];
    const out = [];
    root.querySelectorAll(BLOCK_SEL).forEach((el) => {
      if (el.closest(SKIP_ANCESTOR)) return;
      const t = (el.textContent || '').trim();
      if (t.length < 2) return;
      if (!isVisible(el)) return;
      // skip blocks whose text is fully inside a nested readable block (avoid dupes)
      if (el.querySelector(BLOCK_SEL)) return;
      out.push(el);
    });
    return out;
  }

  /** Track + restore element attributes so structural edits are reversible. */
  function makeAttrTracker() {
    const log = [];
    return {
      set(el, attr, value) {
        log.push([el, attr, el.hasAttribute(attr), el.getAttribute(attr)]);
        el.setAttribute(attr, value);
      },
      restoreAll() {
        for (const [el, attr, had, old] of log) {
          if (had) el.setAttribute(attr, old); else el.removeAttribute(attr);
        }
        log.length = 0;
      },
    };
  }

  globalThis.__morphicUtil = { isVisible, mainContent, readableBlocks, makeAttrTracker, BLOCK_SEL, SKIP_ANCESTOR };
})();
