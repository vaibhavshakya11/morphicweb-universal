/*
 * MorphicWeb — Reading / dyslexia features (no AI).
 */
(() => {
  const E = globalThis.__morphicEngine;
  if (!E) return;

  // 1) Dyslexia-friendly typography (font + spacing). Pure CSS, settings-driven.
  E.register({
    id: 'dyslexiaFont',
    category: 'dyslexia',
    label: 'Readable font & spacing',
    defaults: { line: 1.8, letter: 0.06, word: 0.16, family: 'Atkinson Hyperlegible, Comic Sans MS, Verdana, sans-serif', maxWidth: 0 },
    apply(ctx) {
      const s = ctx.settings;
      const width = s.maxWidth ? `max-width:${s.maxWidth}ch!important;` : '';
      ctx.injectCSS(`
        body, body * {
          font-family: ${s.family} !important;
          line-height: ${s.line} !important;
          letter-spacing: ${s.letter}em !important;
          word-spacing: ${s.word}em !important;
        }
        p, li, article, section { text-align: left !important; ${width} }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // 2) Bionic reading — bold the leading half of each word. Mutates text, so we wrap
  //    each processed text node and can fully restore it.
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'B', 'STRONG']);

  function bionicWord(w) {
    const n = Math.max(1, Math.ceil(w.length / 2));
    return `<b class="morphic-bionic-b">${w.slice(0, n)}</b>${w.slice(n)}`;
  }

  function processNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || SKIP.has(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-morphic-bionic]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const t of targets) {
      const span = document.createElement('span');
      span.setAttribute('data-morphic-bionic', '');
      span.dataset.morphicOrig = t.nodeValue;
      span.innerHTML = t.nodeValue.replace(/[^\s]+/g, (m) => bionicWord(m));
      t.parentNode.replaceChild(span, t);
    }
  }

  E.register({
    id: 'bionic',
    category: 'dyslexia',
    label: 'Bionic reading',
    apply(ctx) {
      ctx.injectCSS('.morphic-bionic-b{font-weight:700!important}');
      processNode(document.body || document.documentElement);
    },
    onMutation(nodes) {
      for (const node of nodes) {
        if (node.nodeType === 1 && !node.closest?.('[data-morphic-bionic]')) processNode(node);
      }
    },
    revert(ctx) {
      ctx.removeCSS();
      document.querySelectorAll('[data-morphic-bionic]').forEach((span) => {
        span.replaceWith(document.createTextNode(span.dataset.morphicOrig || span.textContent));
      });
    },
  });

  // 3) Reading guide — a tinted ruler that tracks the pointer's vertical position.
  let guideEl = null;
  let guideMove = null;
  E.register({
    id: 'readingGuide',
    category: 'dyslexia',
    label: 'Reading guide ruler',
    defaults: { height: 36, color: '255,221,0', opacity: 0.25 },
    apply(ctx) {
      const s = ctx.settings;
      if (!guideEl) {
        guideEl = document.createElement('div');
        guideEl.id = 'morphic-reading-guide';
        document.documentElement.appendChild(guideEl);
        guideMove = (e) => {
          guideEl.style.top = (e.clientY - s.height / 2) + 'px';
        };
        window.addEventListener('mousemove', guideMove, { passive: true });
      }
      guideEl.style.cssText = `position:fixed;left:0;width:100vw;height:${s.height}px;` +
        `background:rgba(${s.color},${s.opacity});pointer-events:none;z-index:2147483646;` +
        `box-shadow:0 0 0 100vmax rgba(0,0,0,0.04);`;
    },
    revert() {
      if (guideMove) window.removeEventListener('mousemove', guideMove);
      guideEl?.remove();
      guideEl = null; guideMove = null;
    },
  });

  // 4) Colour overlay / Irlen tint — full-page tint to reduce visual stress.
  let overlayEl = null;
  E.register({
    id: 'colorOverlay',
    category: 'dyslexia',
    label: 'Colour overlay (tint)',
    defaults: { color: '255,235,160', opacity: 0.18 },
    apply(ctx) {
      const s = ctx.settings;
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.id = 'morphic-color-overlay';
        document.documentElement.appendChild(overlayEl);
      }
      overlayEl.style.cssText = `position:fixed;inset:0;pointer-events:none;` +
        `z-index:2147483645;background:rgba(${s.color},${s.opacity});mix-blend-mode:multiply;`;
    },
    revert() { overlayEl?.remove(); overlayEl = null; },
  });
})();
