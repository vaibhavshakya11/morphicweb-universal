/*
 * MorphicWeb — Read-aloud (Web Speech `speechSynthesis`).
 * Reads the main content (or the current selection) block by block, highlighting each
 * block as it is spoken. Exposes globalThis.__morphicTTS for the widget + voice control.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  const synth = globalThis.speechSynthesis;
  let queue = [];
  let idx = 0;
  let speaking = false;
  let current = null;

  function highlight(el) {
    if (current) current.classList.remove('morphic-tts-active');
    current = el;
    if (el) {
      el.classList.add('morphic-tts-active');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function ensureStyle() {
    if (document.getElementById('morphic-tts-style')) return;
    const s = document.createElement('style');
    s.id = 'morphic-tts-style';
    s.textContent = '.morphic-tts-active{background:#fff3b0!important;box-shadow:0 0 0 4px #fff3b0!important;border-radius:3px}';
    document.head.appendChild(s);
  }

  function speakNext() {
    if (!synth || idx >= queue.length) { stop(); return; }
    const el = queue[idx];
    const text = (el.textContent || '').trim();
    if (!text) { idx++; return speakNext(); }
    highlight(el);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.onend = () => { idx++; speakNext(); };
    u.onerror = () => { idx++; speakNext(); };
    synth.speak(u);
  }

  function start(blocks) {
    if (!synth) { alert('Text-to-speech is not available in this browser.'); return; }
    stop();
    ensureStyle();
    queue = blocks; idx = 0; speaking = true;
    speakNext();
    globalThis.__morphicWidget?.setPlaying?.(true);
  }

  function stop() {
    speaking = false;
    try { synth && synth.cancel(); } catch {}
    highlight(null);
    queue = []; idx = 0;
    globalThis.__morphicWidget?.setPlaying?.(false);
  }

  function readSelection() {
    const sel = String(globalThis.getSelection?.() || '').trim();
    if (sel) { start([{ textContent: sel, classList: { add() {}, remove() {} }, scrollIntoView() {} }]); return true; }
    return false;
  }

  function toggle() {
    if (speaking) { stop(); return; }
    if (readSelection()) return;
    start(U.readableBlocks(U.mainContent()));
  }

  globalThis.__morphicTTS = { toggle, stop, start, readSelection, isSpeaking: () => speaking };

  // The feature toggle just governs availability of the read controls (widget shows them).
  E.register({
    id: 'readAloud',
    category: 'vision',
    label: 'Read aloud',
    apply() { ensureStyle(); },
    revert() { stop(); },
  });
})();
