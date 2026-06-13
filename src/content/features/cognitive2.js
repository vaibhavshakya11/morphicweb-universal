/*
 * MorphicWeb — Cognitive (batch 2): focus-on-paragraph dimming + reading progress bar.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  // 1) Focus paragraph — dim everything except the block under the pointer.
  let focusMove = null, focusStyle = null, currentFocus = null;
  function markDimmable(root) { U.readableBlocks(root).forEach((b) => b.classList.add('morphic-dimmable')); }
  E.register({
    id: 'focusParagraph',
    category: 'cognitive',
    label: 'Focus current paragraph',
    apply() {
      if (!focusStyle) {
        focusStyle = document.createElement('style'); focusStyle.className = 'morphic-ui';
        focusStyle.textContent = '.morphic-dimmable{opacity:.35;transition:opacity .15s}.morphic-dimmable.morphic-focus{opacity:1}';
        document.head.appendChild(focusStyle);
        focusMove = (e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.morphic-dimmable');
          if (el === currentFocus) return;
          currentFocus?.classList.remove('morphic-focus');
          currentFocus = el; el?.classList.add('morphic-focus');
        };
        window.addEventListener('mousemove', focusMove, { passive: true });
      }
      markDimmable(U.mainContent());
    },
    onMutation(nodes) { nodes.forEach((n) => n.querySelectorAll && markDimmable(n)); },
    revert() {
      if (focusMove) window.removeEventListener('mousemove', focusMove);
      focusStyle?.remove(); focusStyle = null; focusMove = null; currentFocus = null;
      document.querySelectorAll('.morphic-dimmable').forEach((b) => b.classList.remove('morphic-dimmable', 'morphic-focus'));
    },
  });

  // 2) Reading progress bar.
  let bar = null, onScroll = null;
  E.register({
    id: 'progressBar',
    category: 'cognitive',
    label: 'Reading progress bar',
    apply() {
      if (!bar) {
        bar = document.createElement('div'); bar.className = 'morphic-ui';
        bar.style.cssText = 'position:fixed;top:0;left:0;height:4px;width:0;background:linear-gradient(90deg,#0b5cff,#ff7a00);z-index:2147483647;transition:width .1s';
        document.documentElement.appendChild(bar);
        onScroll = () => {
          const h = document.documentElement.scrollHeight - innerHeight;
          bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%';
        };
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('resize', onScroll, { passive: true });
        onScroll();
      }
    },
    revert() { if (onScroll) { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); } bar?.remove(); bar = null; onScroll = null; },
  });
})();
