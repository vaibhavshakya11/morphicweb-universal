/*
 * MorphicWeb — Language Insights (computational-linguistics features).
 * Word/sentence-level layers share ONE reversible annotation pass so they never collide:
 * each feature toggles a flag and schedules relayout(). A readability badge runs separately.
 */
(() => {
  const E = globalThis.__morphicEngine;
  const U = globalThis.__morphicUtil;
  const NLP = globalThis.__morphicNLP;
  if (!E || !U || !NLP) return;

  const layers = { pos: false, ner: false, rare: false, syllable: false, complex: false, passive: false, key: false };
  let keySet = new Set();
  const normSent = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const anyWord = () => layers.pos || layers.ner || layers.rare || layers.syllable;
  const anySent = () => layers.complex || layers.passive || layers.key;
  const anyLayer = () => anyWord() || anySent();

  function opts() {
    return {
      decorateToken(word, isStart) {
        const cls = [];
        let title;
        if (layers.pos) cls.push('morphic-pos-' + NLP.posTag(word, isStart));
        if (layers.ner && NLP.isEntity(word, isStart)) cls.push('morphic-ner');
        if (layers.rare && NLP.isRare(word)) { cls.push('morphic-rare'); title = 'Uncommon word'; }
        return cls.length ? { cls, title } : null;
      },
      decorateSentence(sent) {
        const cls = [];
        const titles = [];
        if (layers.complex) {
          const words = NLP.tokenizeWords(sent).length;
          const commas = (sent.match(/,/g) || []).length;
          if (words > 25 || commas >= 3) { cls.push('morphic-complex'); titles.push(`long sentence (${words} words)`); }
        }
        if (layers.passive && NLP.isPassive(sent)) { cls.push('morphic-passive'); titles.push('passive voice'); }
        if (layers.key && keySet.has(normSent(sent))) { cls.push('morphic-key'); titles.push('key sentence'); }
        return cls.length ? { cls, title: titles.join(' · ') } : null;
      },
      transformWord: layers.syllable ? (w) => NLP.hyphenate(w) : null,
    };
  }

  let scheduled = false;
  function relayout() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      NLP.clear();
      if (anyLayer()) NLP.annotate(U.mainContent(), opts());
      legend();
    }, 16);
  }

  // POS legend
  function legend() {
    let el = document.getElementById('morphic-pos-legend');
    if (!layers.pos) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'morphic-pos-legend'; el.className = 'morphic-ui';
      el.style.cssText = 'position:fixed;left:10px;bottom:10px;background:#16181d;color:#fff;font:600 11px system-ui;padding:8px 10px;border-radius:10px;z-index:2147483646;display:flex;gap:8px;flex-wrap:wrap;max-width:60vw';
      el.innerHTML = ['noun', 'verb', 'adj', 'adv', 'propn', 'num'].map((t) =>
        `<span class="morphic-pos-${t}" style="padding:1px 4px;border-radius:4px">${t}</span>`).join('');
      document.documentElement.appendChild(el);
    }
  }

  // shared styles
  const style = document.createElement('style');
  style.className = 'morphic-ui';
  style.textContent = `
    .morphic-pos-noun{color:#1f6feb}.morphic-pos-verb{color:#cf222e}.morphic-pos-adj{color:#1a7f37}
    .morphic-pos-adv{color:#bc4c00}.morphic-pos-propn{color:#8250df}.morphic-pos-num{color:#0e7490}
    .morphic-pos-func{color:#6e7781}
    .morphic-ner{background:#e9d5ff;border-radius:3px;padding:0 2px;box-shadow:inset 0 -2px #8250df}
    .morphic-rare{background:#fff3b0;border-radius:3px;padding:0 2px;cursor:help}
    .morphic-complex{background:linear-gradient(transparent 60%, #ffd6d6 0)}
    .morphic-passive{text-decoration:underline wavy #cf222e}
    .morphic-key{background:#d6f5dd;border-radius:3px;box-shadow:inset 0 -2px #1a7f37}
  `;
  (document.head || document.documentElement).appendChild(style);

  function layerFeature(id, key, category, label) {
    E.register({
      id, category, label,
      apply() { layers[key] = true; relayout(); },
      onMutation(nodes) { if (anyLayer()) nodes.forEach((n) => n.querySelectorAll && NLP.annotate(n, opts())); },
      revert() { layers[key] = false; relayout(); },
    });
  }
  layerFeature('posColors', 'pos', 'linguistics', 'Parts of speech (colour)');
  layerFeature('entityHighlight', 'ner', 'linguistics', 'Highlight names & entities');
  layerFeature('rareWords', 'rare', 'linguistics', 'Flag uncommon words');
  layerFeature('syllableSplit', 'syllable', 'linguistics', 'Split long words');
  layerFeature('complexSentences', 'complex', 'linguistics', 'Flag long sentences');
  layerFeature('passiveVoice', 'passive', 'linguistics', 'Flag passive voice');

  // Key-sentence highlighting (extractive, frequency-scored) — a sentence layer.
  function computeKeys() {
    const text = U.readableBlocks(U.mainContent()).map((b) => b.textContent).join(' ');
    const sents = NLP.splitSentences(text).filter((s) => NLP.tokenizeWords(s).length >= 5);
    const freq = new Map();
    NLP.tokenizeWords(text).forEach((w) => { w = w.toLowerCase(); if (w.length >= 4) freq.set(w, (freq.get(w) || 0) + 1); });
    const scored = sents.map((s) => {
      const ws = NLP.tokenizeWords(s);
      const score = ws.reduce((n, w) => n + (freq.get(w.toLowerCase()) || 0), 0) / Math.sqrt(ws.length || 1);
      return { s, score };
    }).sort((a, b) => b.score - a.score);
    const take = Math.max(1, Math.ceil(scored.length * 0.22));
    keySet = new Set(scored.slice(0, take).map((x) => normSent(x.s)));
  }
  E.register({
    id: 'keySentences',
    category: 'cognitive',
    label: 'Highlight key sentences',
    apply() { computeKeys(); layers.key = true; relayout(); },
    onMutation(nodes) { if (anyLayer()) nodes.forEach((n) => n.querySelectorAll && NLP.annotate(n, opts())); },
    revert() { layers.key = false; relayout(); },
  });

  // Readability badge (independent of the annotation pass).
  E.register({
    id: 'readabilityScore',
    category: 'linguistics',
    label: 'Readability score',
    apply() {
      const text = U.readableBlocks(U.mainContent()).map((b) => b.textContent).join(' ');
      const r = NLP.readability(text);
      let badge = document.getElementById('morphic-readability');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'morphic-readability'; badge.className = 'morphic-ui';
        badge.style.cssText = 'position:fixed;left:10px;bottom:64px;background:#0e7490;color:#fff;font:600 12px system-ui;padding:7px 11px;border-radius:10px;z-index:2147483646;line-height:1.35;max-width:230px';
        document.documentElement.appendChild(badge);
      }
      if (!r) { badge.textContent = 'Readability: not enough text'; return; }
      const level = r.ease >= 70 ? 'Easy' : r.ease >= 50 ? 'Moderate' : r.ease >= 30 ? 'Hard' : 'Very hard';
      const sents = NLP.splitSentences(text);
      const passive = sents.length ? Math.round(100 * sents.filter((s) => NLP.isPassive(s)).length / sents.length) : 0;
      badge.innerHTML = `📖 <b>Grade ${r.grade}</b> · ${level}<br>${r.wps} words/sentence · ${passive}% passive`;
    },
    revert() { document.getElementById('morphic-readability')?.remove(); },
  });
})();
