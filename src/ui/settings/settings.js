/* MorphicWeb — Settings page. Controls always visible; adds profile export/import/reset. */
(() => {
  const { CATEGORIES, FEATURES, PRESETS, STORAGE_KEY } = window.MorphicCatalog;
  let profile = { enabled: true, showOriginal: false, settings: {} };
  const $ = (s) => document.querySelector(s);

  const save = () => chrome.storage.local.set({ [STORAGE_KEY]: profile });
  const featState = (id) => profile.settings[id] || (profile.settings[id] = { enabled: false });

  function controlValue(ctrl, id) {
    const v = featState(id)[ctrl.key];
    if (v !== undefined) return v;
    if (ctrl.type === 'range') return +((+ctrl.min + +ctrl.max) / 2).toFixed(2);
    if (ctrl.type === 'select') return ctrl.options[0].value;
    return '';
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
        input.type = 'range'; input.min = ctrl.min; input.max = ctrl.max; input.step = ctrl.step;
      }
      input.value = controlValue(ctrl, feat.id);
      input.disabled = !featState(feat.id).enabled;
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
    const name = document.createElement('strong'); name.textContent = feat.label;
    const hint = document.createElement('span'); hint.className = 'hint'; hint.textContent = feat.hint || '';
    text.append(name, hint);
    const sw = document.createElement('span'); sw.className = 'switch';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!st.enabled;
    cb.setAttribute('aria-label', feat.label);
    cb.addEventListener('change', () => { st.enabled = cb.checked; save(); render(); });
    const track = document.createElement('span'); track.className = 'track';
    const thumb = document.createElement('span'); thumb.className = 'thumb';
    sw.append(cb, track, thumb);
    head.append(text, sw);
    el.appendChild(head);
    if (feat.controls) el.appendChild(renderControls(feat));
    return el;
  }

  function renderPresets() {
    const box = $('#presets'); box.textContent = '';
    for (const preset of Object.values(PRESETS)) {
      const b = document.createElement('button');
      b.className = 'preset'; b.textContent = preset.label;
      b.addEventListener('click', () => {
        preset.on.forEach((id) => { featState(id).enabled = true; });
        profile.enabled = true; save(); render();
      });
      box.appendChild(b);
    }
  }

  function render() {
    const box = $('#features'); box.textContent = '';
    for (const cat of CATEGORIES) {
      const feats = FEATURES.filter((f) => f.category === cat.id);
      if (!feats.length) continue;
      const group = document.createElement('div'); group.className = 'cat';
      const lbl = document.createElement('div'); lbl.className = 'cat-label'; lbl.textContent = cat.label;
      group.appendChild(lbl);
      feats.forEach((f) => group.appendChild(renderFeature(f)));
      box.appendChild(group);
    }
  }

  // ---- profile import / export / reset -----------------------------------

  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'morphicweb-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(reader.result);
        if (typeof next !== 'object' || !next.settings) throw new Error('bad profile');
        profile = { enabled: true, showOriginal: false, settings: {}, ...next };
        save(); renderPresets(); render();
      } catch (err) {
        alert('That file is not a valid MorphicWeb profile.');
      }
    };
    reader.readAsText(file);
  });

  $('#reset').addEventListener('click', () => {
    if (!confirm('Reset all MorphicWeb settings?')) return;
    profile = { enabled: true, showOriginal: false, settings: {} };
    save(); renderPresets(); render();
  });

  // ---- AI key management + cloud toggle -----------------------------------
  const CONFIG_KEY = window.MorphicCatalog.CONFIG_KEY;
  let config = { cloud: 'auto', model: '', geminiKeys: [], siteRules: {} };
  const saveConfig = () => chrome.storage.local.set({ [CONFIG_KEY]: config });

  function renderKeys() {
    const box = $('#keys'); box.textContent = '';
    const keys = config.geminiKeys.length ? config.geminiKeys.slice(0, 5) : [];
    while (keys.length < 5) keys.push('');
    keys.forEach((k, i) => {
      const inp = document.createElement('input');
      inp.type = 'password'; inp.value = k; inp.placeholder = `Gemini API key ${i + 1} (optional)`;
      inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.addEventListener('change', () => {
        config.geminiKeys = [...$('#keys').querySelectorAll('input')].map((x) => x.value.trim()).filter(Boolean);
        saveConfig();
      });
      box.appendChild(inp);
    });
  }

  function renderAI() {
    $('#cloudMode').value = config.cloud || 'auto';
    $('#model').value = config.model || '';
    renderKeys();
  }
  $('#cloudMode').addEventListener('change', (e) => { config.cloud = e.target.value; saveConfig(); });
  $('#model').addEventListener('change', (e) => { config.model = e.target.value.trim(); saveConfig(); });
  $('#testKeys').addEventListener('click', () => {
    $('#keyStatus').textContent = 'Testing…';
    chrome.runtime.sendMessage({ type: 'morphic:cloud', op: 'test' }, (r) => {
      $('#keyStatus').textContent = r?.ok ? '✓ Cloud reachable — keys work.' : `✗ ${r?.reason || 'failed'} (need at least one valid key)`;
    });
  });

  // ---- saved (named) profiles ---------------------------------------------
  const PROFILES_KEY = 'morphic.profiles';
  let saved = {};
  const saveProfiles = () => chrome.storage.local.set({ [PROFILES_KEY]: saved });

  function renderSaved() {
    const box = $('#savedList'); box.textContent = '';
    Object.keys(saved).forEach((name) => {
      const row = document.createElement('div'); row.className = 'saved-row';
      const lbl = document.createElement('span');
      lbl.textContent = `${name} · ${Object.keys(saved[name] || {}).length} features`;
      const acts = document.createElement('div'); acts.className = 'acts';
      const apply = document.createElement('button'); apply.textContent = 'Apply';
      apply.onclick = () => { profile = { enabled: true, showOriginal: false, settings: structuredClone(saved[name]) }; save(); renderPresets(); render(); };
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.onclick = () => { delete saved[name]; saveProfiles(); renderSaved(); };
      acts.append(apply, del); row.append(lbl, acts); box.appendChild(row);
    });
  }
  $('#saveProfile').addEventListener('click', () => {
    const name = $('#profileName').value.trim();
    if (!name) { $('#profileName').focus(); return; }
    saved[name] = structuredClone(profile.settings || {});
    saveProfiles(); $('#profileName').value = ''; renderSaved();
  });

  try { $('#version').textContent = 'v' + chrome.runtime.getManifest().version; } catch {}

  try { const mv = chrome.runtime.getManifest().version; const vEl = $('#version'); if (vEl) vEl.textContent = 'v' + mv; } catch {}

  chrome.storage.local.get([STORAGE_KEY, CONFIG_KEY, PROFILES_KEY], (data) => {
    if (data[STORAGE_KEY]) profile = data[STORAGE_KEY];
    if (!profile.settings) profile.settings = {};
    if (data[CONFIG_KEY]) config = Object.assign(config, data[CONFIG_KEY]);
    if (data[PROFILES_KEY]) saved = data[PROFILES_KEY];
    renderPresets(); render(); renderAI(); renderSaved();
  });
})();
