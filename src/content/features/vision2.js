/*
 * MorphicWeb — Vision (batch 2): page zoom, grayscale, hide images, text loupe, AI alt-text.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  // 1) Page zoom.
  E.register({
    id: 'pageZoom',
    category: 'vision',
    label: 'Page zoom',
    defaults: { level: 1.3 },
    apply(ctx) { ctx.injectCSS(`html[data-morphic-zoom] body{zoom:${ctx.settings.level}}`); ctx.setRootFlag('zoom', true); },
    revert(ctx) { ctx.setRootFlag('zoom', false); ctx.removeCSS(); },
  });

  // 2) Grayscale (applied to body to avoid clobbering html-level filters).
  E.register({
    id: 'grayscale',
    category: 'calm',
    label: 'Grayscale',
    apply(ctx) { ctx.injectCSS('html[data-morphic-gray] body{filter:grayscale(1)!important}'); ctx.setRootFlag('gray', true); },
    revert(ctx) { ctx.setRootFlag('gray', false); ctx.removeCSS(); },
  });

  // 3) Hide images (bandwidth / visual calm).
  E.register({
    id: 'hideImages',
    category: 'calm',
    label: 'Hide images',
    apply(ctx) {
      ctx.injectCSS(`img:not(.morphic-ui), picture, video, svg:not(.morphic-ui),
        [style*="background-image"] { filter: none !important; background-image: none !important; }
        img:not(.morphic-ui), picture, video { visibility: hidden !important; }`);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 4) Text loupe — a large-print reader of whatever the pointer is over.
  let lens = null, lensMove = null;
  E.register({
    id: 'magnifier',
    category: 'vision',
    label: 'Text loupe',
    apply() {
      if (!lens) {
        lens = document.createElement('div'); lens.className = 'morphic-ui';
        lens.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:28vh;overflow:auto;background:#fffef7;color:#111;font:600 26px/1.4 Georgia,serif;padding:14px 20px;border-top:3px solid #0b5cff;z-index:2147483646;box-shadow:0 -6px 18px rgba(0,0,0,.25);display:none';
        document.documentElement.appendChild(lens);
        lensMove = (e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || el.closest('.morphic-ui')) { lens.style.display = 'none'; return; }
          const t = (el.innerText || el.textContent || '').trim();
          if (!t) { lens.style.display = 'none'; return; }
          lens.textContent = t.slice(0, 600);
          lens.style.display = 'block';
        };
        window.addEventListener('mousemove', lensMove, { passive: true });
      }
    },
    revert() { if (lensMove) window.removeEventListener('mousemove', lensMove); lens?.remove(); lens = null; lensMove = null; },
  });

  // 5) AI alt-text — caption unlabeled images (lazy, viewport-first). Needs cloud vision.
  let io = null; const done = new Set(); const added = new Map();
  async function caption(img) {
    if (done.has(img)) return; done.add(img);
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:') || (img.naturalWidth && img.naturalWidth < 48)) return;
    const ctxText = (img.closest(U.BLOCK_SEL)?.textContent || img.closest('figure')?.textContent || document.title || '').trim();
    const res = await globalThis.__morphicAI.altText(src, ctxText);
    if (!res.ok) return;
    added.set(img, img.getAttribute('alt'));
    img.alt = res.text; img.setAttribute('aria-label', res.text);
    img.title = (img.title ? img.title + ' · ' : '') + 'AI: ' + res.text;
    img.style.outline = '2px solid #8250df';
  }
  E.register({
    id: 'altText',
    category: 'vision',
    label: 'AI image alt-text',
    async apply() {
      if (io) return; // already running; don't stack observers on re-sync
      if (!(await globalThis.__morphicAI.cloudOn())) {
        globalThis.__morphicToast?.('AI alt-text needs Gemini cloud. Add your key in Settings → AI.', 'error');
        return;
      }
      io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) caption(en.target); }), { rootMargin: '200px' });
      document.querySelectorAll('img:not([alt]), img[alt=""]').forEach((img) => io.observe(img));
    },
    onMutation(nodes) { if (io) nodes.forEach((n) => n.querySelectorAll?.('img:not([alt]), img[alt=""]').forEach((img) => io.observe(img))); },
    revert() {
      io?.disconnect(); io = null; done.clear();
      added.forEach((orig, img) => { if (orig === null) img.removeAttribute('alt'); else img.alt = orig; img.removeAttribute('aria-label'); img.style.outline = ''; });
      added.clear();
    },
  });
})();
