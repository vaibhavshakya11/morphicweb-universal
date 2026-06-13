/*
 * MorphicWeb — Calm & light features.
 * brightnessWarmth uses a blended overlay (not an html filter) so it composes cleanly with
 * dark mode / colour overlay instead of clobbering their filters.
 */
(() => {
  const E = globalThis.__morphicEngine;
  if (!E) return;

  // 1) Calm mode — hide notification badges, counts, and comment noise.
  E.register({
    id: 'calmMode',
    category: 'calm',
    label: 'Calm mode',
    apply(ctx) {
      ctx.injectCSS(`
        [class*="badge" i], [class*="unread" i], [class*="notif" i] [class*="count" i],
        [aria-label*="notification" i] sup, .morphic-hidden-count,
        [class*="comment" i], [id*="comment" i],
        [class*="trending" i], [class*="reaction" i] { display: none !important; }
        [class*="count" i]:not(:empty) { opacity: .35 !important; }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 2) Brightness & warmth (photophobia) — blended overlay.
  let overlay = null;
  E.register({
    id: 'brightnessWarmth',
    category: 'calm',
    label: 'Brightness & warmth',
    defaults: { brightness: 0.85, warmth: 0.25 },
    apply(ctx) {
      const b = ctx.settings.brightness;   // 0.4..1 (1 = unchanged)
      const w = ctx.settings.warmth;        // 0..0.6
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'morphic-ui';
        overlay.id = 'morphic-warmth';
        document.documentElement.appendChild(overlay);
      }
      const R = Math.round(255 * b);
      const G = Math.round(255 * b * (1 - 0.15 * w));
      const B = Math.round(255 * b * (1 - 0.55 * w));
      overlay.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483644;` +
        `mix-blend-mode:multiply;background:rgb(${R},${G},${B});`;
    },
    revert() { overlay?.remove(); overlay = null; },
  });
})();
