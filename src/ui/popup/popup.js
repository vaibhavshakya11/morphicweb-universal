/* MorphicWeb — Popup logic. Renders the catalog, persists to chrome.storage.local;
   the content engine reacts to storage changes live. */
(() => {
  const { CATEGORIES, FEATURES, PRESETS, STORAGE_KEY, CONFIG_KEY } = window.MorphicCatalog;

  let profile = { enabled: true, showOriginal: false, settings: {} };
  let config = { siteRules: {} };
  let origin = null;
  let query = '';

  const $ = (sel) => document.querySelector(sel);

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: profile });
  }
  function saveConfig() {
    chrome.storage.local.set({ [CONFIG_KEY]: config });
  }

  function featState(id) {
    return profile.settings[id] || (profile.settings[id] = { enabled: false });
  }

  function controlValue(ctrl, id) {
    const v = featState(id)[ctrl.key];
    if (v !== undefined) return v;
    if (ctrl.type === 'range') return +((+ctrl.min + +ctrl.max) / 2).toFixed(2);
    if (ctrl.type === 'select') return ctrl.options[0].value;
    return '';
  }

  // ---- rendering ----------------------------------------------------------

  function renderHeader() {
    $('#master').checked = profile.enabled;
    const n = Object.values(profile.settings || {}).filter((s) => s && s.enabled).length;
    $('#count').textContent = n ? `${n} on` : '';
    const so = $('#showOriginal');
    so.setAttribute('aria-pressed', String(!!profile.showOriginal));
    so.textContent = profile.showOriginal ? 'Showing original' : 'Show original';
    const off = config.siteRules?.[origin]?.mode === 'off';
    const sb = $('#siteOff');
    sb.setAttribute('aria-pressed', String(off));
    sb.textContent = off ? 'Enable on this site' : 'Disable on this site';
    sb.disabled = !origin;
  }

  function renderPresets() {
    const box = $('#presets');
    box.textContent = '';
    for (const [key, preset] of Object.entries(PRESETS)) {
      const b = document.createElement('button');
      b.className = 'preset';
      b.textContent = preset.label;
      b.addEventListener('click', () => {
        preset.on.forEach((id) => { featState(id).enabled = true; });
        profile.enabled = true;
        save(); render();
      });
      box.appendChild(b);
    }
  }

  function renderControls(feat) {
    const wrap = document.createElement('div');
    wrap.className = 'controls';
    for (const ctrl of feat.controls) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = ctrl.label;
      let input;
      if (ctrl.type === 'select') {
        input = document.createElement('select');
        for (const opt of ctrl.options) {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.label;
          input.appendChild(o);
        }
      } else {
        input = document.createElement('input');
        input.type = 'range';
        input.min = ctrl.min; input.max = ctrl.max; input.step = ctrl.step;
      }
      input.value = controlValue(ctrl, feat.id);
      input.addEventListener('input', () => {
        featState(feat.id)[ctrl.key] = ctrl.type === 'range' ? +input.value : input.value;
        save();
      });
      label.append(span, input);
      wrap.appendChild(label);
    }
    return wrap;
  }

  function renderFeature(feat) {
    const st = featState(feat.id);
    const el = document.createElement('div');
    el.className = 'feat';

    const head = document.createElement('div');
    head.className = 'feat-head';

    const text = document.createElement('div');
    text.className = 'feat-text';
    const name = document.createElement('strong');
    name.textContent = feat.label;
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = feat.hint || '';
    text.append(name, hint);

    const sw = document.createElement('span');
    sw.className = 'switch';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!st.enabled;
    cb.setAttribute('aria-label', feat.label);
    cb.addEventListener('change', () => { st.enabled = cb.checked; save(); render(); });
    const track = document.createElement('span'); track.className = 'track';
    const thumb = document.createElement('span'); thumb.className = 'thumb';
    sw.append(cb, track, thumb);

    head.append(text, sw);
    el.appendChild(head);

    if (feat.controls && st.enabled) el.appendChild(renderControls(feat));
    return el;
  }

  function matches(f) {
    if (!query) return true;
    return (f.label + ' ' + (f.hint || '')).toLowerCase().includes(query);
  }

  function renderFeatures() {
    const box = $('#features');
    box.textContent = '';
    for (const cat of CATEGORIES) {
      const feats = FEATURES.filter((f) => f.category === cat.id && matches(f));
      if (!feats.length) continue;
      const group = document.createElement('div');
      group.className = 'cat';
      const lbl = document.createElement('div');
      lbl.className = 'cat-label';
      lbl.textContent = cat.label;
      group.appendChild(lbl);
      feats.forEach((f) => group.appendChild(renderFeature(f)));
      box.appendChild(group);
    }
  }

  function render() {
    renderHeader();
    renderFeatures();
  }

  // ---- events -------------------------------------------------------------

  $('#master').addEventListener('change', (e) => { profile.enabled = e.target.checked; save(); });
  $('#showOriginal').addEventListener('click', () => {
    profile.showOriginal = !profile.showOriginal; save(); renderHeader();
  });
  $('#siteOff').addEventListener('click', () => {
    if (!origin) return;
    config.siteRules ||= {};
    if (config.siteRules[origin]?.mode === 'off') delete config.siteRules[origin];
    else config.siteRules[origin] = { mode: 'off' };
    saveConfig(); renderHeader();
  });
  $('#showcase').addEventListener('click', () => {
    window.MorphicCatalog.SHOWCASE.forEach((id) => { (profile.settings[id] ||= {}).enabled = true; });
    profile.enabled = true; profile.showOriginal = false; save(); render();
  });
  $('#search').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderFeatures(); });
  $('#openSettings').addEventListener('click', (e) => {
    e.preventDefault(); chrome.runtime.openOptionsPage();
  });

  // ---- init ---------------------------------------------------------------

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try { origin = tabs[0]?.url ? new URL(tabs[0].url).origin : null; } catch { origin = null; }
    renderHeader();
  });

  chrome.storage.local.get([STORAGE_KEY, CONFIG_KEY], (data) => {
    if (data && data[STORAGE_KEY]) profile = data[STORAGE_KEY];
    if (!profile.settings) profile.settings = {};
    if (data && data[CONFIG_KEY]) config = Object.assign(config, data[CONFIG_KEY]);
    renderPresets();
    render();
  });
})();
