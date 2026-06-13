/*
 * MorphicWeb — Shared catalog (source of truth for the UI).
 * `id`s must match the features registered in src/content/features/* and content modules.
 * Loaded as a classic script — attaches to window.MorphicCatalog.
 */
(() => {
  const CATEGORIES = [
    { id: 'vision', label: 'Vision' },
    { id: 'motor', label: 'Motor' },
    { id: 'cognitive', label: 'Cognitive & focus' },
    { id: 'dyslexia', label: 'Dyslexia & reading' },
    { id: 'linguistics', label: 'Language insights' },
    { id: 'language', label: 'Language' },
    { id: 'seizure', label: 'Seizure & motion' },
    { id: 'hearing', label: 'Hearing' },
    { id: 'color', label: 'Colour vision' },
    { id: 'calm', label: 'Calm & light' },
  ];

  const LANGS = [
    ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'],
    ['hi', 'Hindi'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['pt', 'Portuguese'],
    ['ru', 'Russian'], ['ja', 'Japanese'], ['bn', 'Bengali'], ['ur', 'Urdu'],
  ].map(([value, label]) => ({ value, label }));

  const AI_FEATURES = ['simplify', 'summarize', 'translate', 'defineOnClick', 'altText', 'hoverTranslate'];
  const WIDGET_FEATURES = ['readAloud', 'simplify', 'summarize', 'translate'];

  const FEATURES = [
    // Vision
    { id: 'highContrast', category: 'vision', label: 'High contrast', hint: 'White-on-black text; photos preserved.' },
    { id: 'darkMode', category: 'vision', label: 'Smart dark mode', hint: 'Dark UI; images stay normal.' },
    { id: 'focusRings', category: 'vision', label: 'Enhanced focus rings', hint: 'Bold, always-visible focus outline.' },
    { id: 'linkEmphasis', category: 'vision', label: 'Emphasise links', hint: 'Underline + bold every link.' },
    { id: 'screenReaderAssist', category: 'vision', label: 'Screen-reader assist', hint: 'Repair roles, landmarks & headings.' },
    { id: 'readAloud', category: 'vision', label: 'Read aloud', hint: 'Speak the page/selection; highlights as it reads.' },
    { id: 'pageZoom', category: 'vision', label: 'Page zoom', hint: 'Magnify the whole page.', controls: [{ key: 'level', label: 'Zoom', type: 'range', min: 1, max: 2.5, step: 0.1 }] },
    { id: 'magnifier', category: 'vision', label: 'Text loupe', hint: 'Large-print reader of whatever you point at.' },
    { id: 'altText', category: 'vision', label: 'AI image alt-text', hint: 'Caption unlabeled images (needs cloud key).', ai: true },
    // Motor
    { id: 'bigCursor', category: 'motor', label: 'Large cursor', hint: 'Big high-visibility pointer.' },
    { id: 'bigTargets', category: 'motor', label: 'Enlarge click targets', hint: 'Pad small buttons and links.' },
    { id: 'skipLink', category: 'motor', label: 'Skip-to-content link', hint: 'Keyboard link to main content.' },
    { id: 'keyboardAssist', category: 'motor', label: 'Keyboard activation', hint: 'Make div-buttons Enter/Space clickable.' },
    { id: 'dwellClick', category: 'motor', label: 'Dwell click', hint: 'Hover to click.', controls: [{ key: 'ms', label: 'Dwell time', type: 'range', min: 400, max: 2500, step: 100 }] },
    { id: 'clickStabilizer', category: 'motor', label: 'Tremor smoothing', hint: 'Ignore accidental double-clicks.' },
    { id: 'voiceControl', category: 'motor', label: 'Voice control', hint: 'Speak commands. Needs mic.', perm: 'mic' },
    // Cognitive
    { id: 'focusMode', category: 'cognitive', label: 'Remove distractions', hint: 'Hide ads, sidebars, comments, popups.' },
    { id: 'readingMode', category: 'cognitive', label: 'Reading mode', hint: 'Clean single-column article view.' },
    { id: 'readingTime', category: 'cognitive', label: 'Reading-time estimate', hint: 'How long the page takes to read.' },
    { id: 'focusParagraph', category: 'cognitive', label: 'Focus current paragraph', hint: 'Dim everything but what you point at.' },
    { id: 'progressBar', category: 'cognitive', label: 'Reading progress bar', hint: 'Top bar tracks scroll position.' },
    { id: 'keySentences', category: 'cognitive', label: 'Highlight key sentences', hint: 'Extractive highlight of the important lines.' },
    { id: 'simplify', category: 'cognitive', label: 'Simplify text (AI)', hint: 'Plainer language, meaning-checked.', ai: true },
    { id: 'summarize', category: 'cognitive', label: 'Summarise (AI)', hint: 'Key-points summary.', ai: true },
    { id: 'defineOnClick', category: 'cognitive', label: 'Double-click definitions (AI)', hint: 'Double-click a word for a plain definition.', ai: true },
    // Dyslexia
    { id: 'dyslexiaFont', category: 'dyslexia', label: 'Readable font & spacing', hint: 'Legible font, looser spacing.', controls: [
      { key: 'line', label: 'Line height', type: 'range', min: 1.2, max: 2.6, step: 0.1 },
      { key: 'letter', label: 'Letter spacing', type: 'range', min: 0, max: 0.2, step: 0.01 },
      { key: 'word', label: 'Word spacing', type: 'range', min: 0, max: 0.5, step: 0.02 },
    ] },
    { id: 'bionic', category: 'dyslexia', label: 'Bionic reading', hint: 'Bold the start of each word.' },
    { id: 'readingGuide', category: 'dyslexia', label: 'Reading guide ruler', hint: 'Tinted bar follows the cursor.', controls: [{ key: 'opacity', label: 'Strength', type: 'range', min: 0.05, max: 0.6, step: 0.05 }] },
    { id: 'colorOverlay', category: 'dyslexia', label: 'Colour overlay', hint: 'Whole-page calming tint.', controls: [{ key: 'opacity', label: 'Strength', type: 'range', min: 0.05, max: 0.5, step: 0.05 }] },
    // Language insights (computational linguistics)
    { id: 'readabilityScore', category: 'linguistics', label: 'Readability score', hint: 'Live Flesch-Kincaid grade, sentence length, passive %.' },
    { id: 'posColors', category: 'linguistics', label: 'Parts of speech (colour)', hint: 'Colour nouns, verbs, adjectives, adverbs.' },
    { id: 'entityHighlight', category: 'linguistics', label: 'Highlight names & entities', hint: 'Mark proper nouns / named entities.' },
    { id: 'complexSentences', category: 'linguistics', label: 'Flag long sentences', hint: 'Highlight overly long/complex sentences.' },
    { id: 'passiveVoice', category: 'linguistics', label: 'Flag passive voice', hint: 'Underline passive constructions.' },
    { id: 'rareWords', category: 'linguistics', label: 'Flag uncommon words', hint: 'Highlight rare/jargon words.' },
    { id: 'syllableSplit', category: 'linguistics', label: 'Split long words', hint: 'Insert soft syllable breaks.' },
    // Language
    { id: 'translate', category: 'language', label: 'Translate page (AI)', hint: 'Translate the article on-device/cloud.', ai: true, controls: [{ key: 'target', label: 'Into', type: 'select', options: LANGS }] },
    { id: 'hoverTranslate', category: 'language', label: 'Hover to translate (AI)', hint: 'Hover a paragraph to see a translation.', ai: true, controls: [{ key: 'target', label: 'Into', type: 'select', options: LANGS }] },
    // Seizure & motion
    { id: 'reduceMotion', category: 'seizure', label: 'Reduce motion', hint: 'Stop animations, parallax & smooth-scroll.' },
    { id: 'flashGuard', category: 'seizure', label: 'Flash guard', hint: 'Detect & freeze rapidly flashing video.' },
    { id: 'freezeGifs', category: 'seizure', label: 'Freeze animations', hint: 'Pause GIFs; play on click.' },
    // Hearing
    { id: 'muteAutoplay', category: 'hearing', label: 'Mute autoplay', hint: 'Silence and flag auto-playing media.' },
    { id: 'soundAlerts', category: 'hearing', label: 'Audio → visual alerts', hint: 'Flash a banner when the page makes sound.' },
    { id: 'micCaptions', category: 'hearing', label: 'Live captions (mic)', hint: 'Transcribe what the microphone hears.', perm: 'mic' },
    // Colour vision
    { id: 'daltonize', category: 'color', label: 'Colour-blind filter', hint: 'Daltonization correction.', controls: [{ key: 'type', label: 'Type', type: 'select', options: [
      { value: 'deuteranopia', label: 'Deuteranopia (green)' }, { value: 'protanopia', label: 'Protanopia (red)' }, { value: 'tritanopia', label: 'Tritanopia (blue)' },
    ] }] },
    // Calm & light
    { id: 'calmMode', category: 'calm', label: 'Calm mode', hint: 'Hide badges, counts & comment noise.' },
    { id: 'grayscale', category: 'calm', label: 'Grayscale', hint: 'Desaturate the page.' },
    { id: 'hideImages', category: 'calm', label: 'Hide images', hint: 'Remove images & video for focus/bandwidth.' },
    { id: 'brightnessWarmth', category: 'calm', label: 'Brightness & warmth', hint: 'Dim glare; warm tint for light sensitivity.', controls: [
      { key: 'brightness', label: 'Brightness', type: 'range', min: 0.4, max: 1, step: 0.05 },
      { key: 'warmth', label: 'Warmth', type: 'range', min: 0, max: 0.6, step: 0.05 },
    ] },
  ];

  const PRESETS = {
    lowVision: { label: 'Low vision', on: ['highContrast', 'focusRings', 'linkEmphasis', 'bigCursor', 'bigTargets', 'readAloud', 'pageZoom', 'altText'] },
    blind: { label: 'Screen-reader', on: ['screenReaderAssist', 'skipLink', 'keyboardAssist', 'readAloud', 'altText'] },
    dyslexia: { label: 'Dyslexia', on: ['dyslexiaFont', 'bionic', 'readingGuide', 'colorOverlay', 'readAloud', 'syllableSplit'] },
    adhd: { label: 'Focus / ADHD', on: ['focusMode', 'readingMode', 'readingTime', 'focusParagraph', 'progressBar', 'summarize'] },
    cognitive: { label: 'Easy reading', on: ['simplify', 'summarize', 'readingMode', 'defineOnClick', 'keySentences'] },
    languageLearner: { label: 'Language learner', on: ['translate', 'defineOnClick', 'hoverTranslate', 'rareWords', 'readabilityScore'] },
    linguist: { label: 'Linguistics', on: ['posColors', 'entityHighlight', 'passiveVoice', 'complexSentences', 'readabilityScore', 'keySentences'] },
    colorBlind: { label: 'Colour-blind', on: ['daltonize'] },
    photosensitive: { label: 'Seizure-safe', on: ['reduceMotion', 'flashGuard', 'freezeGifs'] },
    motor: { label: 'Motor', on: ['bigTargets', 'bigCursor', 'focusRings', 'keyboardAssist', 'dwellClick', 'clickStabilizer'] },
    deaf: { label: 'Deaf / HoH', on: ['muteAutoplay', 'soundAlerts', 'micCaptions'] },
    nightCalm: { label: 'Night / calm', on: ['darkMode', 'reduceMotion', 'calmMode', 'brightnessWarmth'] },
  };

  // A curated, non-conflicting set that shows breadth in one click (needs no AI keys).
  const SHOWCASE = ['readabilityScore', 'posColors', 'entityHighlight', 'passiveVoice', 'focusMode', 'dyslexiaFont', 'readingGuide', 'daltonize', 'progressBar', 'linkEmphasis', 'focusRings', 'keySentences'];

  window.MorphicCatalog = { CATEGORIES, FEATURES, PRESETS, PRESET_LIST: Object.values(PRESETS), AI_FEATURES, WIDGET_FEATURES, LANGS, SHOWCASE, STORAGE_KEY: 'morphic.profile', CONFIG_KEY: 'morphic.config' };
})();
