# MorphicWeb Universal

On-device, privacy-first **web accessibility suite**. A Chrome (MV3) extension that adapts any
website to your visual, motor, cognitive, and reading needs — everything runs locally, nothing
leaves your machine.

> Status: **v1.0 — 50+ features across 10 categories**, including a computational-linguistics
> **Language Insights** engine (on-device, model-free) and an opt-in **Gemini cloud** escalation
> for heavy AI requests. Whisper-web media captions, a Vite+CRXJS build, and the formal evaluation
> harness remain on the roadmap.

## Demo in 60 seconds

1. Load unpacked → the **onboarding wizard** opens. Click **✨ Enable showcase demo** — it opens the
   test page with a dozen adaptations live.
2. On the article, the **📖 Readability** badge shows the Flesch-Kincaid grade; **parts of speech**
   are colour-coded, **named entities** highlighted, **passive voice** underlined, **key sentences**
   marked — all computed on-device with no model download.
3. Open the popup → enable **Easy reading** (or click **✦ Simplify** in the floating widget). Watch
   paragraphs rewrite and a panel report **"Grade 14 → 6 · ✓ meaning preserved in N/N"** — the
   meaning-preservation verifier guarding against drift.
4. Toggle **Show original** to instantly revert everything. Press **Alt+Shift+R** to hear the page
   read aloud with word highlighting.

The headline: *we turn an unreadable, inaccessible page into a personalised one — measurably (reading
grade), safely (meaning-checked), and privately (on-device) — in one click.*

## Install (development — no build step required)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. An **onboarding wizard** opens on first install (welcome → pick needs → calibrate → done).
   Then use the toolbar icon for the popup, or right-click → **Options** for full settings.

No bundler needed — this loads as plain classic scripts. A Vite + CRXJS build is added later when
larger model bundles (Transformers.js fallback) arrive.

## Features (50+, all reversible)

- **Vision** — high contrast (smart exclusions) · smart dark mode (media-preserving) · focus rings ·
  link emphasis · screen-reader assist (ARIA/landmark/heading repair) · **read aloud** (TTS w/ block
  highlight) · page zoom · text loupe · **AI image alt-text**.
- **Motor** — large cursor · enlarged click targets · skip-to-content · keyboard activation of
  div-buttons · **dwell click** · tremor smoothing · **voice control** (mic).
- **Cognitive** — remove distractions · reading mode · reading-time · focus-current-paragraph ·
  reading progress bar · **highlight key sentences** (extractive) · **simplify (AI)** ·
  **summarise (AI)** · **double-click definitions (AI)**.
- **Dyslexia** — readable font/spacing · bionic reading · reading-guide ruler · colour overlay.
- **Language Insights (computational linguistics, on-device)** — live **Flesch-Kincaid readability**
  badge · **part-of-speech colouring** · **named-entity highlighting** · **passive-voice detection** ·
  **complex/long-sentence flagging** · **rare/jargon-word flagging** · **syllable splitting**.
- **Language** — **translate page (AI)** + **hover-to-translate** into 12 languages.
- **Seizure & motion** — reduce motion · **flash guard** (luminance analysis) · freeze GIFs.
- **Hearing** — mute autoplay · audio→visual alerts · **live captions** (mic STT).
- **Colour vision** — daltonization (protan/deutan/tritan).
- **Calm & light** — calm mode · grayscale · hide images · brightness & warmth (photophobia).

**Convenience:** on-page **quick-launcher** handle · popup **feature search** · **per-site disable** ·
**saved named profiles** · presets per need · JSON profile export/import. **Keyboard shortcuts:**
`Alt+Shift+M` on/off · `Alt+Shift+R` read aloud · `Alt+Shift+O` show original. Everything is
**toggleable**, **tunable**, and **reversible** (global *Show original* + per-action ⟲).

### Language Insights — the computational-linguistics core
[`src/content/nlp.js`](src/content/nlp.js) is a pure, **model-free** NLP engine (tokenisation,
syllable counting, Flesch-Kincaid, rule-based POS tagging, passive-voice & named-entity heuristics,
frequency-based rare-word and extractive key-sentence scoring) feeding
[`features/linguistics.js`](src/content/features/linguistics.js). All layers share one reversible
annotation pass so they compose without colliding. Zero download, runs on every page.

### AI: on-device first, opt-in cloud escalation
Simplify / summarise / translate / define / alt-text use **Chrome built-in AI (Gemini Nano)** first.
For complex requests (image alt-text, long text) or when on-device AI is unavailable, MorphicWeb can
escalate to the **Gemini cloud API** using keys **you** paste in Settings → AI (stored in
`chrome.storage.local`, **never committed**, rotated across up to 5 on rate-limits, proxied through
the service worker so they never touch page context). Leave it blank to stay **100% on-device**.
Simplification is gated by a model-free **meaning-preservation verifier** (numbers + salient
entities + length sanity) that flags rewrites which may have drifted — the comp-ling rigor anchor;
a real NLI/embedding verifier (Transformers.js) is a later milestone.

## Architecture

```
manifest.json                 MV3: content scripts (document_start), SW, popup, options, commands
src/
  content/
    engine.js                 registry + apply/revert + cloak/reveal + MutationObserver (≤30Hz)
    util.js                   main-content / readable-block extraction, attr tracker
    nlp.js                    model-free NLP engine (FK, POS, passive, NER, annotator)
    ai/ai.js                  built-in AI + cloud escalation + meaning-preservation verifier
    features/visual.js        contrast, dark mode, focus, links, cursor, targets, daltonize
    features/vision2.js       page zoom, grayscale, hide images, text loupe, AI alt-text
    features/reading.js       dyslexia font/spacing, bionic, reading guide, colour overlay
    features/linguistics.js   Language Insights (readability, POS, NER, passive, rare, key sents)
    features/motor.js         skip-link, keyboard assist, SR assist, dwell, stabiliser, voice
    features/media.js         flash guard, freeze GIFs, mute autoplay, audio→visual alerts
    features/cognitive.js     focus mode, reading mode, reading time, AI simplify/summarise/define
    features/cognitive2.js    focus-paragraph dimming, reading progress bar
    features/language.js      AI translate
    features/hearing2.js      live mic captions, hover-to-translate
    features/calm.js          calm mode, brightness & warmth
    features/speech.js        read-aloud TTS engine (__morphicTTS)
    features/widget.js        floating assistant (read-aloud + AI actions)
    features/launcher.js      on-page quick-launcher handle + mini panel
    bootstrap.js              storage ⇆ engine wiring, per-site rules, smart cloak, shortcut relay
  sw/service-worker.js        install/onboarding, commands, cloud AI proxy, open-options
  sw/gemini.js                Gemini cloud module: 5-key rotation, REST calls (worker-only)
  shared/catalog.js           canonical feature/preset list for the UI
  ui/popup/ ui/settings/ ui/onboarding/   toolbar popup · options (+AI keys, profiles) · wizard
  test/playground.html        page to exercise every feature
```

### Design notes
- **No network interception / no SharedArrayBuffer** (not feasible in MV3 on third-party pages).
  We use `MutationObserver` + CSS injection with a `document_start` cloak→reveal to avoid flashes.
- **Colour/contrast** use SVG `feColorMatrix` / CSS filters (GPU-accelerated by the browser), not
  whole-page WebGPU.
- Every feature implements `{ id, category, label, apply, revert, onMutation? }` and self-registers
  into the engine, so adding features is local and isolated.

## Roadmap

See [`plan`](../../.claude/plans/) — full 12-month milestones. Next up (M3+): motor/structure
(skip-link, keyboard-nav, screen-reader assist), read-aloud (Web Speech), seizure flash-detection,
then the on-device AI layer (Chrome built-in AI / Gemini Nano with a Transformers.js fallback) for
simplification, summaries, alt-text, captions, and translation — each with an on-device
**meaning-preservation verifier** for text.

**Privacy:** 100% on-device. No analytics, no servers, no account.
