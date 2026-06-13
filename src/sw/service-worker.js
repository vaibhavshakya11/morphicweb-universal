/*
 * MorphicWeb — Service worker (MV3, module). Thin coordinator:
 *  - seeds defaults + opens onboarding on install,
 *  - handles keyboard-shortcut commands (mutates stored profile; content reacts),
 *  - proxies opt-in Gemini cloud calls (keys never touch page context).
 */
import { geminiGenerate, cloudEnabled, testKeys } from './gemini.js';

const STORAGE_KEY = 'morphic.profile';
const DEFAULT_PROFILE = { enabled: true, showOriginal: false, settings: {} };

async function getProfile() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || { ...DEFAULT_PROFILE };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_PROFILE });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/onboarding/onboarding.html') }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-master') {
    const p = await getProfile(); p.enabled = !p.enabled;
    await chrome.storage.local.set({ [STORAGE_KEY]: p });
  } else if (command === 'show-original') {
    const p = await getProfile(); p.showOriginal = !p.showOriginal;
    await chrome.storage.local.set({ [STORAGE_KEY]: p });
  } else if (command === 'read-aloud') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'morphic:readAloud' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'morphic:openOptions') chrome.runtime.openOptionsPage().catch(() => {});
});

// Cloud AI proxy. Content scripts message here; keys stay in the worker/storage.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'morphic:cloud') return;
  (async () => {
    try {
      if (msg.op === 'enabled') { sendResponse({ ok: true, enabled: await cloudEnabled() }); return; }
      if (msg.op === 'test') { sendResponse(await testKeys()); return; }
      if (msg.op === 'generate') { sendResponse(await geminiGenerate([{ text: msg.input }], { system: msg.system })); return; }
      if (msg.op === 'vision') {
        const parts = [{ text: msg.input }, { inline_data: { mime_type: msg.mime || 'image/jpeg', data: msg.data } }];
        sendResponse(await geminiGenerate(parts, { system: msg.system }));
        return;
      }
      sendResponse({ ok: false, reason: 'unknown-op' });
    } catch (e) { sendResponse({ ok: false, reason: String(e) }); }
  })();
  return true; // async response
});
