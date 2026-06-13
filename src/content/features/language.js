/*
 * MorphicWeb — Language: on-device translation. Action exposed on __morphicActions,
 * triggered from the widget with the target language from settings.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  if (!E || !U) return;

  const AI = () => globalThis.__morphicAI;
  const A = (globalThis.__morphicActions = globalThis.__morphicActions || {});
  const originals = new Map();

  A.translatePage = async function (target = 'en') {
    const ai = AI();
    const blocks = U.readableBlocks(U.mainContent()).filter((el) => !el.dataset.morphicTranslated && el.textContent.trim().length > 1);
    if (!blocks.length) { globalThis.__morphicToast('No text to translate.'); return; }
    const source = await ai.detectLanguage(blocks[0].textContent.trim());
    globalThis.__morphicWidget?.setBusy?.(true, 'Translating…');
    let failed = false;
    for (const el of blocks) {
      const res = await ai.translate(el.textContent.trim(), target, source);
      if (!res.ok) { failed = true; break; }
      if (res.skipped) continue;
      originals.set(el, el.innerHTML);
      el.dataset.morphicTranslated = '1';
      el.textContent = res.text;
    }
    globalThis.__morphicWidget?.setBusy?.(false);
    if (failed) globalThis.__morphicToast('On-device translator unavailable for this language pair. Update Chrome / enable built-in AI.', 'error');
    else globalThis.__morphicToast('Translated · click ⟲ in the widget to restore.');
  };

  A.restoreTranslate = function () {
    originals.forEach((html, el) => { el.innerHTML = html; delete el.dataset.morphicTranslated; });
    originals.clear();
  };

  E.register({
    id: 'translate',
    category: 'language',
    label: 'Translate page',
    defaults: { target: 'en' },
    apply() {},
    revert() { A.restoreTranslate(); },
  });
})();
