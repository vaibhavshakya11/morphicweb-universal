/*
 * MorphicWeb — Hearing (batch 2): live microphone captions + hover-to-translate.
 * Note: media-element audio STT needs a bundled Whisper-web model (later milestone); today's
 * captions transcribe what the microphone hears (room audio / a nearby speaker), on-device.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  // 1) Live captions (microphone).
  let recog = null, capBar = null;
  E.register({
    id: 'micCaptions',
    category: 'hearing',
    label: 'Live captions (mic)',
    apply() {
      const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      if (!SR) { globalThis.__morphicToast?.('Live captions need speech recognition (Chrome).', 'error'); return; }
      capBar = document.createElement('div'); capBar.className = 'morphic-ui';
      capBar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;max-width:80vw;background:rgba(0,0,0,.85);color:#fff;font:600 22px/1.35 system-ui;padding:10px 18px;border-radius:12px;z-index:2147483647;text-align:center';
      capBar.textContent = '🎤 Listening…';
      document.documentElement.appendChild(capBar);
      recog = new SR(); recog.continuous = true; recog.interimResults = true; recog.lang = navigator.language || 'en-US';
      recog.onresult = (e) => {
        let txt = '';
        for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
        capBar.textContent = txt.trim() || '🎤 Listening…';
      };
      recog.onend = () => { if (recog) try { recog.start(); } catch {} };
      try { recog.start(); } catch {}
    },
    revert() { if (recog) { recog.onend = null; try { recog.stop(); } catch {} recog = null; } capBar?.remove(); capBar = null; },
  });

  // 2) Hover-to-translate a paragraph.
  let hoverIn = null, hoverOut = null, tip = null, timer = null; const cache = new WeakMap();
  function getTarget() { return document.querySelector('[data-morphic-htv]'); }
  E.register({
    id: 'hoverTranslate',
    category: 'language',
    label: 'Hover to translate',
    defaults: { target: 'en' },
    apply(ctx) {
      const target = ctx.settings.target || 'en';
      hoverIn = (e) => {
        const block = e.target.closest?.(U.BLOCK_SEL);
        if (!block || block.closest('.morphic-ui')) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const text = block.textContent.trim().slice(0, 600);
          if (!text) return;
          let translated = cache.get(block);
          showTip(block, translated || 'Translating…');
          if (!translated) {
            const res = await globalThis.__morphicAI.translate(text, target);
            translated = res.ok ? res.text : 'Translation unavailable.';
            cache.set(block, translated);
          }
          showTip(block, translated);
        }, 450);
      };
      hoverOut = () => { clearTimeout(timer); };
      document.addEventListener('mouseover', hoverIn);
      document.addEventListener('mouseout', hoverOut);
    },
    revert() {
      if (hoverIn) document.removeEventListener('mouseover', hoverIn);
      if (hoverOut) document.removeEventListener('mouseout', hoverOut);
      clearTimeout(timer); tip?.remove(); tip = null;
    },
  });
  function showTip(block, text) {
    const r = block.getBoundingClientRect();
    if (!tip) { tip = document.createElement('div'); tip.className = 'morphic-ui'; document.documentElement.appendChild(tip); }
    tip.style.cssText = `position:fixed;left:${Math.max(8, r.left)}px;top:${Math.min(r.bottom + 6, innerHeight - 80)}px;max-width:${Math.min(520, innerWidth - 16)}px;background:#0b5cff;color:#fff;font:500 15px/1.45 system-ui;padding:8px 12px;border-radius:10px;z-index:2147483647;box-shadow:0 6px 18px rgba(0,0,0,.3)`;
    tip.textContent = text;
  }
})();
