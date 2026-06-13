/*
 * MorphicWeb — On-device NLP engine (computational-linguistics core).
 * Pure, model-free heuristics so they run on every page with zero download:
 *   tokenization · syllable counting · Flesch-Kincaid readability · rule-based POS tagging ·
 *   passive-voice detection · named-entity heuristic · rare-word (jargon) detection ·
 *   a reversible block annotator that layers all of the above.
 * Attaches to globalThis.__morphicNLP.
 */
(() => {
  if (globalThis.__morphicNLP) return;
  const U = globalThis.__morphicUtil;

  // ~180 most-frequent English words → anything outside this & longish = "rare/jargon".
  const COMMON = new Set(('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were has had said did get going down upon could should about where while every great little man old men day great much new own under last right move thing woman life child world still hand part eye place case point government company number group problem fact').split(/\s+/));

  const PRONOUN = new Set('i me my mine we us our ours you your yours he him his she her hers it its they them their theirs this that these those who whom whose which what'.split(' '));
  const DET = new Set('a an the some any each every no this that these those many much few several all both either neither'.split(' '));
  const PREP = new Set('in on at by for with about against between into through during before after above below to from up down of off over under near'.split(' '));
  const CONJ = new Set('and but or nor so yet for because although though while whereas since unless until if when where'.split(' '));
  const AUX = new Set('am is are was were be been being have has had do does did will would shall should can could may might must'.split(' '));
  const PARTICIPLES = 'done made given taken seen known written built held found told shown kept left sent put set brought become begun got gone said felt kept understood';

  function tokenizeWords(s) { return (s.match(/[A-Za-z][A-Za-z'-]*/g) || []); }
  function splitSentences(s) { return (s.match(/[^.!?]+[.!?]*\s*/g) || (s.trim() ? [s] : [])); }

  function syllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return word ? 1 : 0;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = word.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }

  function readability(text) {
    const sents = splitSentences(text).filter((x) => x.trim());
    const words = tokenizeWords(text);
    if (!sents.length || !words.length) return null;
    const syl = words.reduce((n, w) => n + syllables(w), 0);
    const wps = words.length / sents.length;
    const spw = syl / words.length;
    const grade = 0.39 * wps + 11.8 * spw - 15.59;
    const ease = 206.835 - 1.015 * wps - 84.6 * spw;
    return { grade: Math.max(0, +grade.toFixed(1)), ease: +ease.toFixed(0), words: words.length, sentences: sents.length, wps: +wps.toFixed(1) };
  }

  function posTag(raw, isStart) {
    const w = raw.toLowerCase();
    if (/^\d/.test(raw)) return 'num';
    if (PRONOUN.has(w) || DET.has(w) || PREP.has(w) || CONJ.has(w) || AUX.has(w)) return 'func';
    if (!isStart && /^[A-Z][a-z]/.test(raw)) return 'propn';
    if (/ly$/.test(w)) return 'adv';
    if (/(ous|ful|ive|al|ic|ish|less|able|ible|ant|ent)$/.test(w)) return 'adj';
    if (/(ing|ed|ize|ise|ate|ify|en)$/.test(w)) return 'verb';
    if (/(tion|sion|ment|ness|ity|ism|ship|hood|er|or|ist|ance|ence)$/.test(w)) return 'noun';
    return 'noun';
  }

  const PASSIVE_RE = new RegExp(`\\b(am|is|are|was|were|be|been|being)\\b\\s+(?:\\w+ly\\s+)?(\\w+ed|${PARTICIPLES.split(' ').join('|')})\\b`, 'i');
  const isPassive = (sentence) => PASSIVE_RE.test(sentence);

  const isEntity = (raw, isStart) => !isStart && /^[A-Z][a-z]{2,}/.test(raw);
  const isRare = (raw) => { const w = raw.toLowerCase(); return /^[a-z]{7,}$/.test(w) && !COMMON.has(w); };

  function hyphenate(word) {
    // light syllable-ish splitter for long words: insert soft breaks between vowel-consonant-consonant-vowel
    if (word.length < 8) return word;
    return word.replace(/([aeiouy])([^aeiouy])([^aeiouy])([aeiouy])/gi, '$1$2­$3$4');
  }

  // ---- reversible block annotator ----------------------------------------
  // decorateToken(word, isStart) -> {cls:[...], title?} | null   (word-level)
  // decorateSentence(text) -> {cls:[...], title?} | null         (sentence-level)
  // transformWord(word) -> string                                 (optional text rewrite, e.g. hyphenate)
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

  function eligibleTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || SKIP.has(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-morphic-annot], .morphic-ui, ' + U.SKIP_ANCESTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const out = []; let n; while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function buildWordNode(token, isStart, opts) {
    const deco = opts.decorateToken && opts.decorateToken(token, isStart);
    const text = opts.transformWord ? opts.transformWord(token) : token;
    if (!deco) return document.createTextNode(text);
    const span = document.createElement('span');
    span.className = (deco.cls || []).join(' ');
    if (deco.title) span.title = deco.title;
    span.textContent = text;
    return span;
  }

  function buildSentenceNode(sent, opts) {
    const frag = document.createDocumentFragment();
    const parts = sent.split(/(\s+)/);
    let started = false;
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
      const m = part.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'-]*)?([^A-Za-z0-9]*)$/);
      if (m && m[2]) {
        if (m[1]) frag.appendChild(document.createTextNode(m[1]));
        frag.appendChild(buildWordNode(m[2], !started, opts));
        if (m[3]) frag.appendChild(document.createTextNode(m[3]));
        started = true;
      } else { frag.appendChild(document.createTextNode(part)); }
    }
    const deco = opts.decorateSentence && opts.decorateSentence(sent);
    if (!deco) return frag;
    const span = document.createElement('span');
    span.className = (deco.cls || []).join(' ');
    if (deco.title) span.title = deco.title;
    span.appendChild(frag);
    return span;
  }

  function annotate(root, opts) {
    eligibleTextNodes(root || document.body).forEach((node) => {
      const text = node.nodeValue;
      const wrap = document.createElement('span');
      wrap.setAttribute('data-morphic-annot', '');
      wrap.dataset.morphicOrig = text;
      for (const sent of splitSentences(text)) wrap.appendChild(buildSentenceNode(sent, opts));
      node.parentNode.replaceChild(wrap, node);
    });
  }

  function clear() {
    document.querySelectorAll('[data-morphic-annot]').forEach((el) => {
      el.replaceWith(document.createTextNode(el.dataset.morphicOrig || el.textContent));
    });
  }

  globalThis.__morphicNLP = {
    tokenizeWords, splitSentences, syllables, readability, posTag, isPassive, isEntity, isRare, hyphenate,
    annotate, clear,
  };
})();
