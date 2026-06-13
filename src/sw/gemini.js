/*
 * MorphicWeb — Gemini cloud module (service-worker side).
 *
 * Privacy posture: cloud is an OPT-IN escalation only. On-device Gemini Nano stays primary;
 * the content AI layer calls here only when on-device is unavailable or the request is "complex"
 * (e.g. image alt-text, long text). Keys are pasted by the user into Settings and live in
 * chrome.storage.local — they are NEVER committed to the repo. We rotate across up to 5 keys on
 * rate-limit / quota errors so a demo doesn't die on a single key's limit.
 */
const CONFIG_KEY = 'morphic.config';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

async function getConfig() {
  const data = await chrome.storage.local.get(CONFIG_KEY);
  return Object.assign({ cloud: 'auto', geminiKeys: [], keyIndex: 0, model: DEFAULT_MODEL }, data[CONFIG_KEY] || {});
}

async function saveKeyIndex(idx) {
  const cfg = await getConfig();
  cfg.keyIndex = idx;
  await chrome.storage.local.set({ [CONFIG_KEY]: cfg });
}

export async function cloudEnabled() {
  const cfg = await getConfig();
  return cfg.cloud !== 'off' && cfg.geminiKeys.filter(Boolean).length > 0;
}

/**
 * Generate content. `parts` is the Gemini parts array (text and/or inline_data).
 * Returns { ok, text } | { ok:false, reason }. Rotates keys on 429/403 quota errors.
 */
export async function geminiGenerate(parts, { system, temperature = 0.3 } = {}) {
  const cfg = await getConfig();
  const keys = cfg.geminiKeys.filter(Boolean);
  if (!keys.length) return { ok: false, reason: 'no-keys' };

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, maxOutputTokens: 2048 },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  let idx = cfg.keyIndex % keys.length;
  let lastReason = 'unknown';
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[idx];
    try {
      const res = await fetch(ENDPOINT(cfg.model || DEFAULT_MODEL, key), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 403) { // quota / rate-limit → rotate
        lastReason = 'quota-' + res.status;
        idx = (idx + 1) % keys.length;
        continue;
      }
      if (!res.ok) { lastReason = 'http-' + res.status; break; }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
      await saveKeyIndex(idx); // remember the working key for next time
      if (!text) return { ok: false, reason: 'empty' };
      return { ok: true, text: text.trim(), via: 'cloud' };
    } catch (e) {
      lastReason = String(e);
      idx = (idx + 1) % keys.length;
    }
  }
  return { ok: false, reason: lastReason };
}

/** Quick reachability + key check used by the Settings "Test keys" button. */
export async function testKeys() {
  const r = await geminiGenerate([{ text: 'Reply with the single word: ok' }], { temperature: 0 });
  return r;
}
