/*
 * MorphicWeb — Motor / structure / keyboard features.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  const CLICKABLE = '[role="button"],[onclick],[data-href],.btn,.button,[class*="btn"]';
  function looksClickable(el) {
    if (el.matches('a,button,input,select,textarea,summary,[tabindex]')) return false;
    if (el.matches(CLICKABLE)) return true;
    try { return getComputedStyle(el).cursor === 'pointer'; } catch { return false; }
  }

  // 1) Skip-to-main-content link.
  E.register({
    id: 'skipLink',
    category: 'motor',
    label: 'Skip to content',
    apply(ctx) {
      ctx.injectCSS(`
        .morphic-skip { position: fixed; left: 8px; top: -60px; z-index: 2147483647;
          background: #0b5cff; color: #fff; padding: 10px 14px; border-radius: 8px;
          font: 600 14px system-ui; transition: top .15s; text-decoration: none; }
        .morphic-skip:focus { top: 8px; outline: 3px solid #fff; }
      `);
      if (!document.getElementById('morphic-skip-link')) {
        const main = U.mainContent();
        if (main && !main.id) main.id = 'morphic-main';
        const a = document.createElement('a');
        a.id = 'morphic-skip-link';
        a.className = 'morphic-skip';
        a.href = '#' + (main?.id || 'morphic-main');
        a.textContent = 'Skip to main content';
        a.addEventListener('click', () => { main?.setAttribute('tabindex', '-1'); main?.focus(); });
        document.body.prepend(a);
      }
    },
    revert(ctx) { ctx.removeCSS(); document.getElementById('morphic-skip-link')?.remove(); },
  });

  // 2) Keyboard activation — make div-buttons focusable + Enter/Space clickable.
  let kbdTracker = null;
  function markKbd(root) {
    root.querySelectorAll(CLICKABLE + ',div,span').forEach((el) => {
      if (el.dataset.morphicKbd) return;
      if (el.matches('a,button,input,select,textarea')) return;
      if (!looksClickable(el)) return;
      el.dataset.morphicKbd = '1';
      kbdTracker.set(el, 'tabindex', '0');
      if (!el.hasAttribute('role')) kbdTracker.set(el, 'role', 'button');
    });
  }
  function onKbdKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.morphicKbd) {
      e.preventDefault();
      e.target.click();
    }
  }
  E.register({
    id: 'keyboardAssist',
    category: 'motor',
    label: 'Keyboard activation',
    apply() {
      if (!kbdTracker) { kbdTracker = U.makeAttrTracker(); document.addEventListener('keydown', onKbdKey); }
      markKbd(document.body);
    },
    onMutation(nodes) { nodes.forEach((n) => n.querySelectorAll && markKbd(n)); },
    revert() {
      document.removeEventListener('keydown', onKbdKey);
      document.querySelectorAll('[data-morphic-kbd]').forEach((el) => delete el.dataset.morphicKbd);
      kbdTracker?.restoreAll(); kbdTracker = null;
    },
  });

  // 3) Screen-reader assist — conservative ARIA / landmark / name repair.
  let srTracker = null;
  function repairA11y(root) {
    // name clickable divs from their text; ensure role
    root.querySelectorAll(CLICKABLE).forEach((el) => {
      if (el.matches('a,button')) return;
      if (!el.hasAttribute('role')) srTracker.set(el, 'role', 'button');
      if (!el.getAttribute('aria-label') && !el.textContent.trim() && el.title) {
        srTracker.set(el, 'aria-label', el.title);
      }
    });
    // icon-only links/buttons: borrow title/aria from nested svg/img
    root.querySelectorAll('a,button').forEach((el) => {
      if (el.textContent.trim() || el.getAttribute('aria-label')) return;
      const name = el.title || el.querySelector('img[alt]')?.alt || el.querySelector('[aria-label]')?.getAttribute('aria-label');
      if (name) srTracker.set(el, 'aria-label', name);
    });
  }
  E.register({
    id: 'screenReaderAssist',
    category: 'vision',
    label: 'Screen-reader assist',
    apply() {
      if (!srTracker) srTracker = U.makeAttrTracker();
      // ensure a main landmark exists
      if (!document.querySelector('main,[role="main"]')) {
        const m = U.mainContent();
        if (m) srTracker.set(m, 'role', 'main');
      }
      repairA11y(document.body);
    },
    onMutation(nodes) { nodes.forEach((n) => n.querySelectorAll && repairA11y(n)); },
    revert() { srTracker?.restoreAll(); srTracker = null; },
  });

  // 4) Dwell click — hover to click.
  let dwellTimer = null, dwellRing = null, dwellMove = null, dwellOut = null;
  E.register({
    id: 'dwellClick',
    category: 'motor',
    label: 'Dwell click',
    defaults: { ms: 1200 },
    apply(ctx) {
      const ms = ctx.settings.ms;
      if (!dwellRing) {
        dwellRing = document.createElement('div');
        dwellRing.className = 'morphic-ui';
        dwellRing.style.cssText = 'position:fixed;width:26px;height:26px;border:3px solid #0b5cff;border-radius:50%;pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .1s';
        document.documentElement.appendChild(dwellRing);
      }
      const clear = () => { clearTimeout(dwellTimer); dwellTimer = null; dwellRing.style.opacity = '0'; };
      dwellMove = (e) => {
        const t = e.target.closest('a,button,[role="button"],input,select,[data-morphic-kbd]');
        clear();
        if (!t) return;
        dwellRing.style.left = (e.clientX - 13) + 'px';
        dwellRing.style.top = (e.clientY - 13) + 'px';
        dwellRing.style.opacity = '1';
        dwellTimer = setTimeout(() => { dwellRing.style.opacity = '0'; t.click(); }, ms);
      };
      dwellOut = clear;
      window.addEventListener('mousemove', dwellMove, { passive: true });
      window.addEventListener('mouseout', dwellOut, { passive: true });
    },
    revert() {
      window.removeEventListener('mousemove', dwellMove);
      window.removeEventListener('mouseout', dwellOut);
      clearTimeout(dwellTimer); dwellRing?.remove(); dwellRing = null;
    },
  });

  // 5) Tremor smoothing — swallow accidental rapid second clicks.
  let lastClick = 0, stabHandler = null;
  E.register({
    id: 'clickStabilizer',
    category: 'motor',
    label: 'Tremor smoothing',
    apply() {
      stabHandler = (e) => {
        const now = e.timeStamp;
        if (now - lastClick < 320) { e.stopImmediatePropagation(); e.preventDefault(); return; }
        lastClick = now;
      };
      document.addEventListener('click', stabHandler, true);
    },
    revert() { if (stabHandler) document.removeEventListener('click', stabHandler, true); stabHandler = null; },
  });

  // 6) Voice control — speak commands (needs mic permission on the page).
  let recog = null, numbersOverlay = [];
  function clearNumbers() { numbersOverlay.forEach((n) => n.remove()); numbersOverlay = []; }
  function showNumbers() {
    clearNumbers();
    [...document.querySelectorAll('a[href],button,[role="button"]')].filter(U.isVisible).slice(0, 60).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const tag = document.createElement('div');
      tag.className = 'morphic-ui morphic-vnum';
      tag.textContent = i + 1;
      tag.dataset.idx = i;
      tag.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;background:#ff7a00;color:#fff;font:700 12px system-ui;padding:1px 5px;border-radius:5px;z-index:2147483647;pointer-events:none`;
      tag._target = el;
      document.documentElement.appendChild(tag);
      numbersOverlay.push(tag);
    });
  }
  function runCommand(text) {
    const t = text.toLowerCase().trim();
    if (/scroll down|down/.test(t)) scrollBy({ top: innerHeight * 0.8, behavior: 'smooth' });
    else if (/scroll up|up/.test(t)) scrollBy({ top: -innerHeight * 0.8, behavior: 'smooth' });
    else if (/top/.test(t)) scrollTo({ top: 0, behavior: 'smooth' });
    else if (/bottom/.test(t)) scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    else if (/go back|back/.test(t)) history.back();
    else if (/forward/.test(t)) history.forward();
    else if (/reload|refresh/.test(t)) location.reload();
    else if (/numbers|show links/.test(t)) showNumbers();
    else if (/hide/.test(t)) clearNumbers();
    else if (/read/.test(t)) globalThis.__morphicTTS?.toggle();
    else if (/stop/.test(t)) globalThis.__morphicTTS?.stop();
    else {
      const m = t.match(/(?:click|open|number)\s*(\d+)/);
      if (m) { numbersOverlay.find((n) => +n.dataset.idx === +m[1] - 1)?._target?.click(); clearNumbers(); }
    }
  }
  E.register({
    id: 'voiceControl',
    category: 'motor',
    label: 'Voice control',
    apply() {
      const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      if (!SR) { console.warn('[MorphicWeb] SpeechRecognition unavailable'); return; }
      recog = new SR();
      recog.continuous = true; recog.interimResults = false; recog.lang = navigator.language || 'en-US';
      recog.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) runCommand(e.results[i][0].transcript); };
      recog.onend = () => { if (recog) try { recog.start(); } catch {} }; // auto-restart
      try { recog.start(); } catch {}
    },
    revert() { if (recog) { recog.onend = null; try { recog.stop(); } catch {} recog = null; } clearNumbers(); },
  });
})();
