/*
 * MorphicWeb — Floating assistant widget.
 * Appears when any of {readAloud, simplify, summarize, translate} is enabled. Surfaces the
 * on-device actions. Self-subscribes to chrome.storage so it stays in sync with the popup.
 */
(() => {
  if (globalThis.__morphicWidget) return;
  const STORAGE_KEY = 'morphic.profile';
  const A = () => globalThis.__morphicActions || {};
  const TTS = () => globalThis.__morphicTTS;

  let root = null, busyEl = null, playing = false;
  let profile = { enabled: true, showOriginal: false, settings: {} };

  function on(id) {
    if (!profile.enabled || profile.showOriginal) return false;
    return !!profile.settings?.[id]?.enabled;
  }

  function ensureRoot() {
    if (root) return;
    const style = document.createElement('style');
    style.textContent = `
      #morphic-widget{position:fixed;right:16px;bottom:16px;z-index:2147483646;display:flex;flex-direction:column;gap:8px;align-items:flex-end;font:600 13px -apple-system,"Segoe UI",Roboto,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      #morphic-widget button{display:flex;gap:7px;align-items:center;border:1px solid #e8eaed;border-radius:11px;padding:9px 14px;cursor:pointer;background:#fff;color:#1b1f27;box-shadow:0 4px 16px rgba(16,24,40,.14);transition:background .12s,border-color .12s,transform .04s}
      #morphic-widget button:hover{background:#4f46e5;border-color:#4f46e5;color:#fff}
      #morphic-widget button:active{transform:translateY(.5px)}
      #morphic-widget .morphic-busy{background:#4f46e5;color:#fff;border-radius:11px;padding:7px 13px;font-size:12px;box-shadow:0 4px 16px rgba(79,70,229,.35)}
      @media (prefers-color-scheme:dark){
        #morphic-widget button{background:#15181e;color:#e8eaef;border-color:#2a2f37;box-shadow:0 6px 18px rgba(0,0,0,.5)}
        #morphic-widget button:hover{background:#4f46e5;border-color:#4f46e5;color:#fff}
      }
    `;
    style.className = 'morphic-ui';
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'morphic-widget';
    root.className = 'morphic-ui';
    document.documentElement.appendChild(root);
  }

  function btn(label, title, onClick) {
    const b = document.createElement('button');
    b.textContent = label; b.title = title; b.onclick = onClick;
    b.setAttribute('aria-label', title);
    return b;
  }

  function render() {
    const features = ['readAloud', 'simplify', 'summarize', 'translate'];
    const anyOn = features.some(on);
    if (!anyOn) { root?.remove(); root = null; busyEl = null; return; }
    ensureRoot();
    root.textContent = '';

    if (busyEl) root.appendChild(busyEl);

    if (on('translate')) {
      const target = profile.settings.translate?.target || 'en';
      root.appendChild(btn('🌐 Translate', 'Translate page on-device', () => A().translatePage?.(target)));
    }
    if (on('summarize')) root.appendChild(btn('≡ Summary', 'Summarise the article', () => A().summarizePage?.()));
    if (on('simplify')) root.appendChild(btn('✦ Simplify', 'Simplify the text (meaning-checked)', () => A().simplifyVisible?.()));
    if (on('simplify') || on('translate')) {
      root.appendChild(btn('⟲ Original', 'Restore original text', () => { A().restoreSimplify?.(); A().restoreTranslate?.(); A().closeSummary?.(); }));
    }
    if (on('readAloud')) {
      root.appendChild(btn(playing ? '⏹ Stop' : '▶ Read', 'Read the page aloud', () => TTS()?.toggle()));
    }
  }

  const widget = {
    update(p) { profile = p || profile; render(); },
    setPlaying(v) { playing = v; render(); },
    setBusy(v, label) {
      if (v) {
        if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'morphic-busy morphic-ui'; }
        busyEl.textContent = (label || 'Working…');
      } else { busyEl?.remove(); busyEl = null; }
      render();
    },
  };
  globalThis.__morphicWidget = widget;

  // stay in sync with storage independently of the engine
  chrome.storage.local.get(STORAGE_KEY, (data) => { if (data?.[STORAGE_KEY]) widget.update(data[STORAGE_KEY]); else render(); });
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c[STORAGE_KEY]) widget.update(c[STORAGE_KEY].newValue); });
})();
