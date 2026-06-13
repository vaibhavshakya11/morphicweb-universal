/* MorphicWeb — Onboarding wizard. Writes the chosen profile to chrome.storage. */
(() => {
  const { PRESETS, STORAGE_KEY } = window.MorphicCatalog;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const profile = { enabled: true, showOriginal: false, settings: {} };
  const enable = (id, extra) => { profile.settings[id] = { enabled: true, ...(extra || {}) }; };

  const DALTON = {
    protanopia: '0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0',
    deuteranopia: '0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0',
    tritanopia: '0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0',
    none: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0',
  };

  // ---- step nav -----------------------------------------------------------
  let step = 0;
  const steps = $$('.step');
  const dots = $('#dots');
  steps.forEach(() => { const i = document.createElement('i'); dots.appendChild(i); });
  function show(n) {
    step = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s) => (s.hidden = +s.dataset.step !== step));
    $$('.steps i').forEach((d, i) => d.classList.toggle('on', i === step));
    if (step === steps.length - 1) finishSetup();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-next]')) show(step + 1);
    if (e.target.matches('[data-back]')) show(step - 1);
  });

  // ---- step 2: needs ------------------------------------------------------
  const needs = $('#needs');
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const b = document.createElement('button');
    b.className = 'need'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<strong>${preset.label}</strong><span>${preset.on.length} adjustments</span>`;
    b.addEventListener('click', () => {
      const pressed = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!pressed));
      preset.on.forEach((id) => { if (!pressed) enable(id); else delete profile.settings[id]; });
    });
    needs.appendChild(b);
  });

  // ---- step 3: calibration (live preview) ---------------------------------
  const sample = $('#sample');
  const dMatrix = $('#ob-dalton-m');
  function applyDaltonPreview(type) {
    dMatrix.setAttribute('values', DALTON[type] || DALTON.none);
    document.documentElement.style.filter = type === 'none' ? '' : 'url(#ob-dalton)';
  }
  $('#calDalton').addEventListener('change', (e) => {
    const v = e.target.value;
    applyDaltonPreview(v);
    if (v === 'none') delete profile.settings.daltonize; else enable('daltonize', { type: v });
  });
  function applyReadingPreview() {
    sample.style.lineHeight = $('#calLine').value;
    sample.style.letterSpacing = $('#calLetter').value + 'em';
    sample.style.fontFamily = 'Atkinson Hyperlegible, Comic Sans MS, Verdana, sans-serif';
  }
  ['calLine', 'calLetter'].forEach((id) => $('#' + id).addEventListener('input', () => {
    applyReadingPreview();
    if ($('#calDyslexia').checked) saveReading();
  }));
  function saveReading() {
    enable('dyslexiaFont', { line: +$('#calLine').value, letter: +$('#calLetter').value, word: 0.16 });
  }
  $('#calDyslexia').addEventListener('change', (e) => {
    if (e.target.checked) saveReading(); else delete profile.settings.dyslexiaFont;
  });
  applyReadingPreview();

  // ---- step 4: finish -----------------------------------------------------
  function finishSetup() {
    // clear the page-level preview filter so it doesn't linger
    document.documentElement.style.filter = '';
    const count = Object.keys(profile.settings).length;
    $('#summary').textContent = count
      ? `MorphicWeb is on with ${count} feature${count === 1 ? '' : 's'} active. Adjust anything from the toolbar icon.`
      : `MorphicWeb is ready. Turn on features any time from the toolbar icon.`;
    chrome.storage.local.set({ [STORAGE_KEY]: profile });
  }

  $('#tryIt').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/test/playground.html') });
  });
  $('#showcase').addEventListener('click', () => {
    (window.MorphicCatalog.SHOWCASE || []).forEach((id) => enable(id));
    chrome.storage.local.set({ [STORAGE_KEY]: profile });
    chrome.tabs.create({ url: chrome.runtime.getURL('src/test/playground.html') });
  });
  $('#openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());

  show(0);
})();
