/*
 * MorphicWeb — Visual features (no AI).
 * Each registers into the engine. All are pure CSS / SVG-filter injection where
 * possible, so apply/revert are instant and leave no residue.
 */
(() => {
  const E = globalThis.__morphicEngine;
  if (!E) return;

  // 1) High-contrast mode (with light "smart exclusion" of media so photos survive).
  E.register({
    id: 'highContrast',
    category: 'vision',
    label: 'High contrast',
    defaults: { strength: 1.0 },
    apply(ctx) {
      const s = ctx.settings.strength;
      ctx.injectCSS(`
        html[data-morphic-highcontrast] body,
        html[data-morphic-highcontrast] body * {
          color: #fff !important;
          background-color: #000 !important;
          border-color: #fff !important;
          text-shadow: none !important;
        }
        html[data-morphic-highcontrast] a, html[data-morphic-highcontrast] a * {
          color: #ffff00 !important;
        }
        /* Smart exclusions: don't repaint real media. */
        html[data-morphic-highcontrast] img,
        html[data-morphic-highcontrast] video,
        html[data-morphic-highcontrast] canvas,
        html[data-morphic-highcontrast] svg,
        html[data-morphic-highcontrast] [style*="background-image"] {
          background-color: transparent !important;
          filter: contrast(${1 + 0.2 * s}) !important;
        }
      `);
      ctx.setRootFlag('highcontrast', true);
    },
    revert(ctx) { ctx.setRootFlag('highcontrast', false); ctx.removeCSS(); },
  });

  // 2) Smart dark mode — invert the page but re-invert real media so photos look normal.
  E.register({
    id: 'darkMode',
    category: 'vision',
    label: 'Smart dark mode',
    apply(ctx) {
      ctx.injectCSS(`
        html[data-morphic-dark] {
          filter: invert(1) hue-rotate(180deg) !important;
          background: #111 !important;
        }
        html[data-morphic-dark] img,
        html[data-morphic-dark] video,
        html[data-morphic-dark] canvas,
        html[data-morphic-dark] [style*="background-image"],
        html[data-morphic-dark] picture,
        html[data-morphic-dark] iframe {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      `);
      ctx.setRootFlag('dark', true);
    },
    revert(ctx) { ctx.setRootFlag('dark', false); ctx.removeCSS(); },
  });

  // 3) Enhanced focus indicators — thick, high-contrast, impossible to suppress.
  E.register({
    id: 'focusRings',
    category: 'vision',
    label: 'Enhanced focus indicators',
    apply(ctx) {
      ctx.injectCSS(`
        :focus, :focus-visible {
          outline: 4px solid #ff7a00 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 2px #000, 0 0 0 6px #ff7a00 !important;
        }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 4) Reduce motion — kill animations, parallax, smooth-scroll, autoplay carousels.
  E.register({
    id: 'reduceMotion',
    category: 'seizure',
    label: 'Reduce motion',
    apply(ctx) {
      ctx.injectCSS(`
        *, *::before, *::after {
          animation-duration: .001s !important;
          animation-iteration-count: 1 !important;
          transition-duration: .001s !important;
          scroll-behavior: auto !important;
        }
        html { scroll-behavior: auto !important; }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 5) Daltonization for colour-vision deficiency (SVG feColorMatrix correction).
  const DALTON_MATRICES = {
    // Correction matrices that shift confusable colours apart. Approximate but effective.
    protanopia: '0.567,0.433,0,0,0, 0.558,0.442,0,0,0, 0,0.242,0.758,0,0, 0,0,0,1,0',
    deuteranopia: '0.625,0.375,0,0,0, 0.7,0.3,0,0,0, 0,0.3,0.7,0,0, 0,0,0,1,0',
    tritanopia: '0.95,0.05,0,0,0, 0,0.433,0.567,0,0, 0,0.475,0.525,0,0, 0,0,0,1,0',
  };
  E.register({
    id: 'daltonize',
    category: 'color',
    label: 'Colour-blind filter',
    defaults: { type: 'deuteranopia' },
    apply(ctx) {
      const type = ctx.settings.type in DALTON_MATRICES ? ctx.settings.type : 'deuteranopia';
      let svg = document.getElementById('morphic-dalton-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'morphic-dalton-svg';
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0';
        (document.body || document.documentElement).appendChild(svg);
      }
      svg.innerHTML = `<filter id="morphic-dalton"><feColorMatrix type="matrix" values="${DALTON_MATRICES[type]}"/></filter>`;
      ctx.injectCSS('html[data-morphic-dalton]{filter:url(#morphic-dalton)!important}');
      ctx.setRootFlag('dalton', true);
    },
    revert(ctx) {
      ctx.setRootFlag('dalton', false);
      ctx.removeCSS();
      document.getElementById('morphic-dalton-svg')?.remove();
    },
  });

  // 6) High-visibility large cursor (inline SVG data-URI — no asset file needed).
  E.register({
    id: 'bigCursor',
    category: 'motor',
    label: 'Large high-visibility cursor',
    apply(ctx) {
      const cursor = "url('data:image/svg+xml;utf8," +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M6 2l30 18-13 3 8 16-6 3-8-16-11 9z" fill="%23000" stroke="%23fff" stroke-width="2"/></svg>'.replace(/%23/g, '#')) +
        "') 4 2, auto";
      ctx.injectCSS(`html[data-morphic-bigcursor], html[data-morphic-bigcursor] * { cursor: ${cursor} !important; }`);
      ctx.setRootFlag('bigcursor', true);
    },
    revert(ctx) { ctx.setRootFlag('bigcursor', false); ctx.removeCSS(); },
  });

  // 7) Link emphasis — underline + bolden + colour every link.
  E.register({
    id: 'linkEmphasis',
    category: 'vision',
    label: 'Emphasise links',
    apply(ctx) {
      ctx.injectCSS(`
        a[href] {
          text-decoration: underline !important;
          text-underline-offset: 2px !important;
          font-weight: 700 !important;
          color: #0b5cff !important;
        }
        html[data-morphic-dark] a[href] { color: #66b0ff !important; }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 8) Enlarged click targets (motor) — pad small interactive elements.
  E.register({
    id: 'bigTargets',
    category: 'motor',
    label: 'Enlarge click targets',
    apply(ctx) {
      ctx.injectCSS(`
        a, button, input[type="checkbox"], input[type="radio"],
        [role="button"], [role="link"], [role="checkbox"] {
          min-width: 24px !important;
          min-height: 24px !important;
          padding: 6px !important;
        }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });
})();
