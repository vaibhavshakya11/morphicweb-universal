/*
 * MorphicWeb — Seizure protection + media/hearing features.
 */
(() => {
  const E = globalThis.__morphicEngine;
  if (!E) return;

  // 1) Flash guard — sample readable <video> luminance; freeze if it flashes (>3/s, WCAG).
  const samplers = new Map();
  function attachSampler(video) {
    if (samplers.has(video)) return;
    const cvs = document.createElement('canvas'); cvs.width = 32; cvs.height = 32;
    const cx = cvs.getContext('2d', { willReadFrequently: true });
    let prev = null; let transitions = [];
    const tick = () => {
      if (!video.isConnected) return teardown();
      if (!video.paused && video.readyState >= 2) {
        try {
          cx.drawImage(video, 0, 0, 32, 32);
          const d = cx.getImageData(0, 0, 32, 32).data;
          let lum = 0;
          for (let i = 0; i < d.length; i += 4) lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          lum /= (d.length / 4) * 255;
          if (prev !== null && Math.abs(lum - prev) > 0.2) {
            const now = performance.now();
            transitions = transitions.filter((t) => now - t < 1000);
            transitions.push(now);
            if (transitions.length > 3) return freeze(video);
          }
          prev = lum;
        } catch { return teardown(); /* cross-origin: can't read, give up quietly */ }
      }
      timer = setTimeout(() => requestAnimationFrame(tick), 100);
    };
    let timer = setTimeout(() => requestAnimationFrame(tick), 100);
    const teardown = () => { clearTimeout(timer); samplers.delete(video); };
    samplers.set(video, teardown);
  }
  function freeze(video) {
    samplers.get(video)?.(); // stop sampling
    try { video.pause(); } catch {}
    if (video.parentElement?.querySelector('.morphic-flash-cover')) return;
    const r = video.getBoundingClientRect();
    const cover = document.createElement('div');
    cover.className = 'morphic-flash-cover morphic-ui';
    cover.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:2147483646;font:600 14px system-ui;text-align:center;padding:8px`;
    cover.innerHTML = '<div>⚠ Flashing content paused</div>';
    const btn = document.createElement('button');
    btn.textContent = 'Play anyway';
    btn.style.cssText = 'padding:6px 12px;border-radius:6px;border:0;cursor:pointer';
    btn.onclick = () => { cover.remove(); video.play?.(); };
    cover.appendChild(btn);
    document.documentElement.appendChild(cover);
  }
  E.register({
    id: 'flashGuard',
    category: 'seizure',
    label: 'Flash guard',
    apply() { document.querySelectorAll('video').forEach(attachSampler); },
    onMutation(nodes) { nodes.forEach((n) => { if (n.tagName === 'VIDEO') attachSampler(n); n.querySelectorAll?.('video').forEach(attachSampler); }); },
    revert() { samplers.forEach((stop) => stop()); samplers.clear(); document.querySelectorAll('.morphic-flash-cover').forEach((c) => c.remove()); },
  });

  // 2) Freeze animated images (GIFs) — draw a still frame; click to play.
  const frozen = new Map();
  function freezeGif(img) {
    if (frozen.has(img) || !img.complete || !img.naturalWidth) return;
    const cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    cvs.className = 'morphic-frozen-gif morphic-ui';
    cvs.style.cssText = getComputedStyle(img).cssText;
    cvs.style.width = img.clientWidth + 'px'; cvs.style.height = img.clientHeight + 'px';
    cvs.title = 'Click to play';
    try { cvs.getContext('2d').drawImage(img, 0, 0); } catch {}
    img.style.display = 'none';
    img.after(cvs);
    const restore = () => { cvs.remove(); img.style.display = ''; frozen.delete(img); };
    cvs.addEventListener('click', restore, { once: true });
    frozen.set(img, restore);
  }
  function scanGifs(root) {
    root.querySelectorAll?.('img[src*=".gif" i]').forEach((img) => {
      if (img.complete) freezeGif(img); else img.addEventListener('load', () => freezeGif(img), { once: true });
    });
  }
  E.register({
    id: 'freezeGifs',
    category: 'seizure',
    label: 'Freeze animations',
    apply() { scanGifs(document); },
    onMutation(nodes) { nodes.forEach((n) => scanGifs(n)); },
    revert() { frozen.forEach((restore) => restore()); frozen.clear(); },
  });

  // 3) Mute autoplay media.
  const mutedByUs = new Set();
  function muteMedia(el) {
    if (!el.muted) { el.muted = true; mutedByUs.add(el); }
  }
  function onPlayMute(e) { const el = e.target; if (el.matches?.('video,audio')) muteMedia(el); }
  E.register({
    id: 'muteAutoplay',
    category: 'hearing',
    label: 'Mute autoplay',
    apply() { document.querySelectorAll('video,audio').forEach(muteMedia); document.addEventListener('play', onPlayMute, true); },
    revert() { document.removeEventListener('play', onPlayMute, true); mutedByUs.forEach((el) => { el.muted = false; }); mutedByUs.clear(); },
  });

  // 4) Audio → visual alerts.
  let banner = null, hideT = null, onPlayAlert = null;
  function flashBanner(label) {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'morphic-ui';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff7a00;color:#111;font:700 14px system-ui;padding:8px 12px;text-align:center;z-index:2147483647;transition:transform .15s;transform:translateY(-100%)';
      document.documentElement.appendChild(banner);
    }
    banner.textContent = '🔊 ' + label;
    banner.style.transform = 'translateY(0)';
    clearTimeout(hideT);
    hideT = setTimeout(() => { banner.style.transform = 'translateY(-100%)'; }, 1800);
  }
  E.register({
    id: 'soundAlerts',
    category: 'hearing',
    label: 'Audio → visual alerts',
    apply() {
      onPlayAlert = (e) => { const el = e.target; if (el.matches?.('video,audio') && !el.muted) flashBanner('Media is playing sound'); };
      document.addEventListener('play', onPlayAlert, true);
      document.addEventListener('volumechange', onPlayAlert, true);
    },
    revert() {
      if (onPlayAlert) { document.removeEventListener('play', onPlayAlert, true); document.removeEventListener('volumechange', onPlayAlert, true); }
      clearTimeout(hideT); banner?.remove(); banner = null;
    },
  });
})();
