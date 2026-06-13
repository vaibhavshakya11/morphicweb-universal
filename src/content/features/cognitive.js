/*
 * MorphicWeb — Cognitive / focus features + on-device AI reading actions.
 * The AI actions (simplify / summarise / translate) are exposed on globalThis.__morphicActions
 * and triggered from the floating widget; the feature toggles just make them available and
 * guarantee clean restore on revert.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  // ---- shared toast -------------------------------------------------------
  globalThis.__morphicToast = (msg, kind = 'info') => {
    const t = document.createElement('div');
    t.className = 'morphic-ui';
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:78px;right:18px;max-width:300px;background:${kind === 'error' ? '#b3261e' : '#16181d'};color:#fff;font:500 13px system-ui;padding:10px 14px;border-radius:10px;z-index:2147483647;box-shadow:0 6px 20px rgba(0,0,0,.3)`;
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  };

  // ---- 1) Remove distractions / focus mode --------------------------------
  E.register({
    id: 'focusMode',
    category: 'cognitive',
    label: 'Remove distractions',
    apply(ctx) {
      ctx.injectCSS(`
        aside, [role="complementary"],
        [class*="sidebar" i], [id*="sidebar" i],
        [class*="advert" i], [class*="-ad-" i], [class*="ad-" i], [id*="-ad" i], ins.adsbygoogle,
        [class*="promo" i], [class*="newsletter" i], [class*="subscribe" i],
        [class*="cookie" i], [class*="consent" i],
        [class*="comment" i], [id*="comment" i],
        [class*="related" i], [class*="recommend" i], [class*="popular" i],
        [class*="social" i], [class*="share" i],
        [aria-label*="advert" i] { display: none !important; }
      `);
    },
    revert(ctx) { ctx.removeCSS(); },
  });

  // ---- 2) Reading mode — clean single-column overlay ----------------------
  let readerOverlay = null;
  E.register({
    id: 'readingMode',
    category: 'cognitive',
    label: 'Reading mode',
    apply() {
      if (readerOverlay) return;
      const main = U.mainContent();
      const clone = main.cloneNode(true);
      clone.querySelectorAll('script,style,iframe,nav,aside,footer,[role="navigation"],.morphic-ui').forEach((n) => n.remove());
      readerOverlay = document.createElement('div');
      readerOverlay.className = 'morphic-ui morphic-reader';
      readerOverlay.innerHTML = `
        <div class="morphic-reader-inner">
          <button class="morphic-reader-close" aria-label="Close reading mode">✕ Close</button>
          <h1 class="morphic-reader-title">${(document.title || '').replace(/[<>]/g, '')}</h1>
        </div>`;
      readerOverlay.querySelector('.morphic-reader-inner').appendChild(clone);
      readerOverlay.querySelector('.morphic-reader-close').onclick = () => {
        // turning the feature off is done via storage; here we just hide
        readerOverlay.style.display = 'none';
      };
      const style = document.createElement('style');
      style.id = 'morphic-reader-style';
      style.textContent = `
        .morphic-reader{position:fixed;inset:0;background:#fbfaf7;color:#1a1a1a;z-index:2147483640;overflow:auto}
        .morphic-reader-inner{max-width:42rem;margin:0 auto;padding:48px 24px 96px;font:18px/1.7 Georgia,serif}
        .morphic-reader-title{font:700 30px/1.2 system-ui;margin:.2em 0 .8em}
        .morphic-reader img{max-width:100%;height:auto}
        .morphic-reader a{color:#0b5cff}
        .morphic-reader-close{position:sticky;top:0;float:right;background:#16181d;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;font:600 14px system-ui}
        @media (prefers-color-scheme: dark){.morphic-reader{background:#16140f;color:#eee}}
      `;
      document.head.appendChild(style);
      document.documentElement.appendChild(readerOverlay);
    },
    revert() { readerOverlay?.remove(); readerOverlay = null; document.getElementById('morphic-reader-style')?.remove(); },
  });

  // ---- 3) Reading-time estimate -------------------------------------------
  E.register({
    id: 'readingTime',
    category: 'cognitive',
    label: 'Reading-time estimate',
    apply() {
      let badge = document.getElementById('morphic-readtime');
      const words = U.readableBlocks(U.mainContent()).reduce((n, el) => n + (el.textContent.trim().split(/\s+/).length), 0);
      const mins = Math.max(1, Math.round(words / 200));
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'morphic-readtime';
        badge.className = 'morphic-ui';
        badge.style.cssText = 'position:fixed;top:10px;right:10px;background:#16181d;color:#fff;font:600 12px system-ui;padding:6px 10px;border-radius:999px;z-index:2147483646;opacity:.92';
        document.documentElement.appendChild(badge);
      }
      badge.textContent = `⏱ ${mins} min read · ${words.toLocaleString()} words`;
    },
    revert() { document.getElementById('morphic-readtime')?.remove(); },
  });

  // ---- AI reading actions (simplify / summarise / define) -----------------
  const AI = () => globalThis.__morphicAI;
  const A = (globalThis.__morphicActions = globalThis.__morphicActions || {});
  const originals = new Map();

  function badge(verified, warnings) {
    const b = document.createElement('span');
    b.className = 'morphic-ui morphic-badge';
    b.title = (warnings && warnings.join('; ')) || 'Meaning preserved';
    b.textContent = verified ? ' ✓ plain' : ' ⚠ check';
    b.style.cssText = `font:600 11px system-ui;margin-left:6px;padding:1px 6px;border-radius:6px;cursor:pointer;vertical-align:middle;background:${verified ? '#d6f5dd' : '#ffe0b3'};color:#222`;
    b.onclick = () => A.restoreSimplify();
    return b;
  }

  A.simplifyVisible = async function () {
    const ai = AI();
    const NLP = globalThis.__morphicNLP;
    const blocks = U.readableBlocks(U.mainContent()).filter((el) => !el.dataset.morphicSimplified && el.textContent.trim().length > 40);
    if (!blocks.length) { globalThis.__morphicToast('Nothing to simplify here.'); return; }
    globalThis.__morphicWidget?.setBusy?.(true, 'Simplifying…');
    let failed = false, verified = 0, total = 0;
    let origText = '', newText = '';
    for (const el of blocks) {
      const text = el.textContent.trim();
      el.classList.add('morphic-adapting');
      const res = await ai.simplify(text);
      el.classList.remove('morphic-adapting');
      if (!res.ok) { failed = true; break; }
      originals.set(el, el.innerHTML);
      el.dataset.morphicSimplified = '1';
      el.textContent = res.text;
      el.appendChild(badge(res.verified, res.warnings));
      total++; if (res.verified) verified++;
      origText += ' ' + text; newText += ' ' + res.text;
    }
    globalThis.__morphicWidget?.setBusy?.(false);
    if (failed) { globalThis.__morphicToast('On-device AI is unavailable. Add a Gemini key in Settings → AI, or enable Chrome built-in AI.', 'error'); return; }
    // Headline metric: reading-grade before → after (ties the CL engine to the AI).
    const before = NLP?.readability(origText), after = NLP?.readability(newText);
    showSimplifyResult({ total, verified, before: before?.grade, after: after?.grade });
  };

  let resultPanel = null;
  function showSimplifyResult({ total, verified, before, after }) {
    resultPanel?.remove();
    resultPanel = document.createElement('div');
    resultPanel.className = 'morphic-ui';
    resultPanel.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;background:#0f1a14;color:#eafff1;border:1px solid #1a7f37;border-radius:14px;padding:12px 16px;z-index:2147483646;font:600 13px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.4);text-align:center;min-width:230px';
    const grade = (before != null && after != null)
      ? `<div style="font-size:22px;margin:2px 0">Grade ${before} → <span style="color:#7ee2a8">${after}</span></div>` : '';
    resultPanel.innerHTML = `<div style="color:#9fd9b4;font-size:11px;letter-spacing:.06em">SIMPLIFIED ${total} PARAGRAPH${total === 1 ? '' : 'S'}</div>
      ${grade}
      <div style="opacity:.85">✓ meaning preserved in ${verified}/${total}</div>
      <button class="morphic-ui" style="margin-top:8px;background:#1a7f37;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer">Restore original</button>`;
    resultPanel.querySelector('button').onclick = () => { A.restoreSimplify(); resultPanel.remove(); resultPanel = null; };
    document.documentElement.appendChild(resultPanel);
    setTimeout(() => { resultPanel?.style && (resultPanel.style.opacity = '0.96'); }, 10);
  }
  const _origRestore = A.restoreSimplify;
  A.restoreSimplify = function () { _origRestore(); resultPanel?.remove(); resultPanel = null; };

  A.restoreSimplify = function () {
    originals.forEach((html, el) => { el.innerHTML = html; delete el.dataset.morphicSimplified; });
    originals.clear();
  };

  let summaryPanel = null;
  A.summarizePage = async function () {
    const ai = AI();
    const text = U.readableBlocks(U.mainContent()).map((el) => el.textContent.trim()).join('\n\n').slice(0, 12000);
    if (!text) { globalThis.__morphicToast('No article text found.'); return; }
    globalThis.__morphicWidget?.setBusy?.(true, 'Summarising…');
    const res = await ai.summarize(text);
    globalThis.__morphicWidget?.setBusy?.(false);
    if (!res.ok) { globalThis.__morphicToast('On-device summariser unavailable. Update Chrome / enable built-in AI.', 'error'); return; }
    A.closeSummary();
    summaryPanel = document.createElement('div');
    summaryPanel.className = 'morphic-ui';
    summaryPanel.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:45vh;overflow:auto;background:#101418;color:#f5f7fa;z-index:2147483641;padding:18px 22px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:15px/1.6 system-ui';
    summaryPanel.innerHTML = `<div style="max-width:46rem;margin:0 auto"><strong style="font-size:13px;letter-spacing:.05em;color:#9fb0c3">SUMMARY</strong>
      <button class="morphic-ui" style="float:right;background:#222a33;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer">Close</button>
      <div class="morphic-sum-body" style="margin-top:8px;white-space:pre-wrap"></div></div>`;
    summaryPanel.querySelector('.morphic-sum-body').textContent = res.text;
    summaryPanel.querySelector('button').onclick = A.closeSummary;
    document.documentElement.appendChild(summaryPanel);
  };
  A.closeSummary = function () { summaryPanel?.remove(); summaryPanel = null; };

  E.register({ id: 'simplify', category: 'cognitive', label: 'Simplify text', apply() {}, revert() { A.restoreSimplify(); } });
  E.register({ id: 'summarize', category: 'cognitive', label: 'Summarise', apply() {}, revert() { A.closeSummary(); } });

  // ---- Define-on-click ----------------------------------------------------
  let defTip = null, dblHandler = null;
  function removeTip() { defTip?.remove(); defTip = null; }
  E.register({
    id: 'defineOnClick',
    category: 'cognitive',
    label: 'Double-click definitions',
    apply() {
      dblHandler = async (e) => {
        const word = String(globalThis.getSelection?.() || '').trim();
        if (!word || /\s/.test(word) || word.length < 2) return;
        const ctx = (e.target.closest?.(U.BLOCK_SEL)?.textContent || '').trim().slice(0, 200);
        removeTip();
        defTip = document.createElement('div');
        defTip.className = 'morphic-ui';
        defTip.style.cssText = `position:fixed;left:${Math.min(e.clientX, innerWidth - 280)}px;top:${e.clientY + 14}px;max-width:260px;background:#16181d;color:#fff;font:14px/1.5 system-ui;padding:10px 12px;border-radius:10px;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,.35)`;
        defTip.textContent = `Defining “${word}”…`;
        document.documentElement.appendChild(defTip);
        const res = await AI().define(word, ctx);
        if (!defTip) return;
        defTip.textContent = res.ok ? `${word}: ${res.text}` : 'On-device AI unavailable for definitions.';
      };
      document.addEventListener('dblclick', dblHandler);
      document.addEventListener('click', removeTip);
    },
    revert() { if (dblHandler) document.removeEventListener('dblclick', dblHandler); document.removeEventListener('click', removeTip); removeTip(); },
  });

  // adapting/animation styles used by AI actions
  const s = document.createElement('style');
  s.textContent = '.morphic-adapting{outline:2px dashed #0b5cff;outline-offset:2px;opacity:.7}';
  (document.head || document.documentElement).appendChild(s);
})();
