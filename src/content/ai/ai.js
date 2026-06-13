/*
 * MorphicWeb — On-device AI layer with opt-in cloud escalation.
 *
 * Strategy (plan + user choice): on-device Chrome built-in AI (Gemini Nano) is PRIMARY. When it
 * is unavailable, or the request is "complex" (image alt-text, long text), we escalate to the
 * Gemini cloud API via the service worker (keys stored locally, rotated across up to 5). Every
 * method degrades gracefully to { ok:false } so features can show a friendly notice.
 *
 * Also ships the model-free meaning-preservation verifier used to guard text simplification.
 * Attaches to globalThis.__morphicAI.
 */
(() => {
  if (globalThis.__morphicAI) return;
  const G = globalThis;
  const sessions = {};
  const LANG_NAME = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', hi: 'Hindi', zh: 'Chinese', ar: 'Arabic', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', bn: 'Bengali', ur: 'Urdu' };

  // ---- cloud bridge (via service worker) ----------------------------------
  function sw(message) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage(message, (r) => resolve(chrome.runtime.lastError ? { ok: false, reason: 'sw' } : r)); }
      catch { resolve({ ok: false, reason: 'sw' }); }
    });
  }
  let _cloud = null;
  async function cloudOn() { if (_cloud === null) { const r = await sw({ type: 'morphic:cloud', op: 'enabled' }); _cloud = !!r?.enabled; } return _cloud; }
  function refreshCloud() { _cloud = null; }
  const cloudGenerate = (input, system) => sw({ type: 'morphic:cloud', op: 'generate', input, system });
  const cloudVision = (input, data, mime, system) => sw({ type: 'morphic:cloud', op: 'vision', input, data, mime, system });

  async function availability(NS, opts) {
    try { if (!G[NS]?.availability) return 'unavailable'; return await G[NS].availability(opts); } catch { return 'unavailable'; }
  }
  const monitor = (label) => (m) => m.addEventListener?.('downloadprogress', (e) => G.__morphicAI?._onProgress?.(label, e.loaded));

  // ---- Prompt (on-device) with cloud fallback -----------------------------
  async function promptLocal(input, system) {
    if (await availability('LanguageModel') === 'unavailable') return { ok: false, reason: 'no-local' };
    try {
      const s = await G.LanguageModel.create({ ...(system ? { initialPrompts: [{ role: 'system', content: system }] } : {}), monitor: monitor('LanguageModel') });
      const out = await s.prompt(input); s.destroy?.();
      return { ok: true, text: out.trim(), via: 'local' };
    } catch (e) { return { ok: false, reason: String(e) }; }
  }
  async function prompt(input, system, { complex = false } = {}) {
    if (!complex) { const local = await promptLocal(input, system); if (local.ok) return local; }
    if (await cloudOn()) { const c = await cloudGenerate(input, system); if (c?.ok) return c; }
    return complex ? { ok: false, reason: 'needs-cloud' } : promptLocal(input, system);
  }

  // ---- Summarize ----------------------------------------------------------
  async function summarize(text, { type = 'key-points', length = 'medium' } = {}) {
    if (await availability('Summarizer') !== 'unavailable') {
      try {
        sessions.summarizer ||= await G.Summarizer.create({ type, length, format: 'markdown', monitor: monitor('Summarizer') });
        return { ok: true, text: await sessions.summarizer.summarize(text), via: 'local' };
      } catch { /* fall through */ }
    }
    if (await cloudOn()) return cloudGenerate(text, 'Summarise the following text as a short markdown list of the key points. Keep it faithful and concise.');
    return { ok: false, reason: 'no-summarizer' };
  }

  // ---- Simplify (meaning-checked) -----------------------------------------
  async function simplify(text, { level = 'simple' } = {}) {
    const sys = `Rewrite the user's text in simple, plain ${level === 'simple' ? 'beginner-level' : 'clear'} English. Keep every fact, number and name. Do not add or remove information. Return only the rewritten text.`;
    if (await availability('Rewriter') !== 'unavailable') {
      try {
        sessions.rewriter ||= await G.Rewriter.create({ tone: 'more-casual', length: 'as-is', format: 'plain-text', sharedContext: sys, monitor: monitor('Rewriter') });
        return verify(text, (await sessions.rewriter.rewrite(text)).trim());
      } catch { /* fall through */ }
    }
    const r = await prompt(text, sys);
    if (!r.ok) return r;
    return verify(text, r.text);
  }

  async function define(word, context = '') {
    const sys = 'You are a concise dictionary. Define the requested word in one short, plain sentence a child could understand. If context is given, use the meaning that fits it.';
    return prompt(`Word: "${word}"${context ? `\nContext: "${context}"` : ''}`, sys);
  }

  // ---- Translate ----------------------------------------------------------
  async function detectLanguage(text) {
    if (await availability('LanguageDetector') === 'unavailable') return null;
    try { sessions.detector ||= await G.LanguageDetector.create({ monitor: monitor('LanguageDetector') }); return (await sessions.detector.detect(text))?.[0]?.detectedLanguage || null; } catch { return null; }
  }
  async function translate(text, target, sourceHint) {
    const source = sourceHint || (await detectLanguage(text)) || 'en';
    if (source === target) return { ok: true, text, skipped: true };
    if (await availability('Translator', { sourceLanguage: source, targetLanguage: target }) !== 'unavailable') {
      try {
        const key = `tr:${source}:${target}`;
        sessions[key] ||= await G.Translator.create({ sourceLanguage: source, targetLanguage: target, monitor: monitor('Translator') });
        return { ok: true, text: await sessions[key].translate(text), source, via: 'local' };
      } catch { /* fall through */ }
    }
    if (await cloudOn()) {
      const c = await cloudGenerate(text, `Translate the following text into ${LANG_NAME[target] || target}. Return only the translation, no notes.`);
      if (c?.ok) return { ...c, source };
    }
    return { ok: false, reason: 'no-translator' };
  }

  // ---- Image alt-text (complex → cloud vision) ----------------------------
  async function imageToBase64(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    const dataUrl = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(blob); });
    return { mime, data: String(dataUrl).split(',')[1] };
  }
  async function altText(url, context = '') {
    if (!(await cloudOn())) return { ok: false, reason: 'needs-cloud' };
    try {
      const { mime, data } = await imageToBase64(url);
      return cloudVision(
        `Write concise, useful alt text (one sentence, no "image of") for a screen-reader user.${context ? ` Page context: "${context.slice(0, 200)}"` : ''}`,
        data, mime, 'You write accurate, succinct image alt text.');
    } catch (e) { return { ok: false, reason: String(e) }; }
  }

  // ---- Meaning-preservation verifier (model-free) -------------------------
  const tokensOf = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []);
  const numbersOf = (s) => (s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, ''));
  const entitiesOf = (s) => [...new Set((s.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || []))];
  function verify(original, rewritten) {
    const result = { ok: true, text: rewritten, verified: true, warnings: [] };
    const lower = rewritten.toLowerCase();
    const missingNums = numbersOf(original).filter((n) => !rewritten.includes(n));
    if (missingNums.length) { result.verified = false; result.warnings.push('numbers changed: ' + missingNums.join(', ')); }
    const ents = entitiesOf(original);
    const missingEnts = ents.filter((e) => !lower.includes(e.toLowerCase()));
    if (ents.length && missingEnts.length / ents.length > 0.34) { result.verified = false; result.warnings.push('names changed: ' + missingEnts.slice(0, 4).join(', ')); }
    const ro = tokensOf(original).length, rw = tokensOf(rewritten).length;
    if (ro && rw / ro > 2.2) { result.verified = false; result.warnings.push('much longer than original'); }
    return result;
  }

  globalThis.__morphicAI = {
    summarize, simplify, define, translate, detectLanguage, prompt, altText, verify,
    cloudOn, refreshCloud,
    _onProgress: null, onProgress(cb) { this._onProgress = cb; },
  };
})();
