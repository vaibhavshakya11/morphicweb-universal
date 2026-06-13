/*
 * MorphicWeb — On-page quick launcher. A small handle (bottom-left) that opens a mini panel
 * with the master switch + the most-used toggles, so users don't need to find the toolbar icon.
 * Controlled by config.launcher (default on). Writes the same profile to chrome.storage.
 */
(() => {
  if (globalThis.__morphicLauncher) return;
  globalThis.__morphicLauncher = true;
  const PKEY = 'morphic.profile', CKEY = 'morphic.config';
  const QUICK = [
    ['readAloud', '🔊 Read aloud'], ['darkMode', '🌙 Dark mode'], ['highContrast', '◑ High contrast'],
    ['dyslexiaFont', '🔡 Readable font'], ['focusMode', '🧹 Declutter'], ['readabilityScore', '📖 Readability'],
  ];

  let profile = { enabled: true, showOriginal: false, settings: {} };
  let config = { launcher: true };
  let open = false, handle = null, panel = null;

  const save = () => chrome.storage.local.set({ [PKEY]: profile });
  const isOn = (id) => !!profile.settings?.[id]?.enabled;
  const setOn = (id, v) => { (profile.settings[id] ||= {}).enabled = v; save(); };

  function ensure() {
    if (config.launcher === false) { teardown(); return; }
    if (handle) return;
    const style = document.createElement('style'); style.className = 'morphic-ui';
    style.textContent = `
      #morphic-launch{position:fixed;left:16px;bottom:16px;z-index:2147483646;font:600 13px -apple-system,"Segoe UI",Roboto,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      #morphic-launch .ml-handle{width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;background:#4f46e5;box-shadow:0 6px 18px rgba(27,31,39,.28),0 1px 2px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .12s,background .12s}
      #morphic-launch .ml-handle:hover{background:#4338ca;transform:translateY(-1px)}
      #morphic-launch .ml-panel{position:absolute;left:0;bottom:58px;width:248px;background:#fff;color:#1b1f27;border:1px solid #e8eaed;border-radius:16px;padding:8px;box-shadow:0 16px 40px rgba(16,24,40,.22);display:none;overflow:hidden}
      #morphic-launch.open .ml-panel{display:block}
      #morphic-launch .ml-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;color:#1b1f27}
      #morphic-launch .ml-row:hover{background:#f6f7f9}
      #morphic-launch .ml-row[aria-pressed="true"]{color:#4f46e5;background:#eef0fd}
      #morphic-launch .ml-head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px 10px;border-bottom:1px solid #eceef1;margin-bottom:4px}
      #morphic-launch .ml-head strong{font-size:13px}
      #morphic-launch .ml-foot{display:flex;gap:7px;margin-top:4px;padding:6px 4px 2px}
      #morphic-launch button.mini{flex:1;background:#f6f7f9;color:#1b1f27;border:1px solid #e8eaed;border-radius:9px;padding:8px;cursor:pointer;font:600 12.5px inherit}
      #morphic-launch button.mini:hover{background:#eef0f3}
      @media (prefers-color-scheme:dark){
        #morphic-launch .ml-panel{background:#15181e;color:#e8eaef;border-color:#262b33;box-shadow:0 16px 40px rgba(0,0,0,.6)}
        #morphic-launch .ml-row{color:#e8eaef}
        #morphic-launch .ml-row:hover{background:#20252d}
        #morphic-launch .ml-row[aria-pressed="true"]{color:#9ea1f5;background:#1d2030}
        #morphic-launch .ml-head{border-color:#262b33}
        #morphic-launch button.mini{background:#20252d;color:#e8eaef;border-color:#2f353d}
      }
    `;
    document.head.appendChild(style);
    handle = document.createElement('div'); handle.id = 'morphic-launch'; handle.className = 'morphic-ui';
    handle.innerHTML = `<div class="ml-panel" role="dialog" aria-label="MorphicWeb quick panel"></div>
      <button class="ml-handle" aria-label="Open MorphicWeb quick panel" title="MorphicWeb">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 4a8 8 0 0 0 0 16z" fill="#fff"/></svg>
      </button>`;
    panel = handle.querySelector('.ml-panel');
    handle.querySelector('.ml-handle').onclick = () => { open = !open; handle.classList.toggle('open', open); render(); };
    document.documentElement.appendChild(handle);
    render();
  }
  function teardown() { handle?.remove(); handle = null; panel = null; }

  function row(label, pressed, onClick) {
    const d = document.createElement('div'); d.className = 'ml-row'; d.setAttribute('role', 'button'); d.tabIndex = 0;
    d.setAttribute('aria-pressed', String(pressed)); d.textContent = label;
    d.onclick = onClick; d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
    return d;
  }
  function render() {
    if (!panel || !open) return;
    panel.textContent = '';
    const head = document.createElement('div'); head.className = 'ml-head';
    head.innerHTML = '<strong>MorphicWeb</strong>';
    const master = row(profile.enabled ? 'On' : 'Off', profile.enabled, () => { profile.enabled = !profile.enabled; save(); render(); });
    master.style.cssText = 'background:#22262f;flex:0 0 auto;padding:4px 10px';
    head.appendChild(master); panel.appendChild(head);
    QUICK.forEach(([id, label]) => panel.appendChild(row(label, isOn(id), () => { setOn(id, !isOn(id)); render(); })));
    panel.appendChild(row(profile.showOriginal ? 'Showing original ✓' : 'Show original', profile.showOriginal,
      () => { profile.showOriginal = !profile.showOriginal; save(); render(); }));
    const foot = document.createElement('div'); foot.className = 'ml-foot';
    const settings = document.createElement('button'); settings.className = 'mini'; settings.textContent = 'All settings';
    settings.onclick = () => chrome.runtime.sendMessage({ type: 'morphic:openOptions' });
    const hide = document.createElement('button'); hide.className = 'mini'; hide.textContent = 'Hide';
    hide.onclick = () => { open = false; handle.classList.remove('open'); };
    foot.append(settings, hide); panel.appendChild(foot);
  }

  chrome.storage.local.get([PKEY, CKEY], (d) => {
    if (d[PKEY]) profile = d[PKEY]; if (!profile.settings) profile.settings = {};
    if (d[CKEY]) config = Object.assign(config, d[CKEY]);
    ensure();
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c[PKEY]) { profile = c[PKEY].newValue || profile; if (!profile.settings) profile.settings = {}; render(); }
    if (c[CKEY]) { config = Object.assign(config, c[CKEY].newValue || {}); ensure(); }
  });
})();
