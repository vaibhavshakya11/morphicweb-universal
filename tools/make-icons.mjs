/*
 * MorphicWeb — icon generator.
 * Renders the toolbar icon as real PNGs (16/32/48/128) with no design tools: a rounded-square
 * brand gradient (blue→orange) with a white "contrast lens" mark (ring + half-filled disc) that
 * reads as "we adapt how the page looks." Supersampled 4× then box-downsampled for smooth edges.
 *
 *   node tools/make-icons.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';

// ---- PNG encoding -------------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { raw[y * stride] = 0; rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing ------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const BLUE = [11, 92, 255], ORANGE = [255, 122, 0];

function renderAt(S) {
  const SS = S * 4;                       // supersample
  const px = new Float64Array(SS * SS * 4);
  const r = SS * 0.235;                   // corner radius
  const cx = SS / 2, cy = SS / 2;
  const R = SS * 0.30;                    // lens radius
  const ring = SS * 0.055;                // ring thickness
  for (let y = 0; y < SS; y++) {
    for (let x = 0; x < SS; x++) {
      const i = (y * SS + x) * 4;
      // rounded-rect mask
      const dx = Math.max(r - x, x - (SS - 1 - r), 0);
      const dy = Math.max(r - y, y - (SS - 1 - r), 0);
      if (Math.hypot(dx, dy) > r) { px[i + 3] = 0; continue; }
      // gradient background
      const t = (x + y) / (2 * (SS - 1));
      let col = [lerp(BLUE[0], ORANGE[0], t), lerp(BLUE[1], ORANGE[1], t), lerp(BLUE[2], ORANGE[2], t)];
      // contrast lens
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - R) <= ring) col = [255, 255, 255];          // ring
      else if (d < R - ring && x < cx) col = [255, 255, 255];      // left half disc
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }
  // box downsample SS -> S
  const out = Buffer.alloc(S * S * 4);
  const f = SS / S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let R0 = 0, G0 = 0, B0 = 0, A0 = 0;
      for (let yy = 0; yy < f; yy++) for (let xx = 0; xx < f; xx++) {
        const i = ((y * f + yy) * SS + (x * f + xx)) * 4;
        const a = px[i + 3];
        R0 += px[i] * a; G0 += px[i + 1] * a; B0 += px[i + 2] * a; A0 += a;
      }
      const o = (y * S + x) * 4;
      if (A0 === 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; }
      else { out[o] = Math.round(R0 / A0); out[o + 1] = Math.round(G0 / A0); out[o + 2] = Math.round(B0 / A0); out[o + 3] = Math.round(A0 / (f * f)); }
    }
  }
  return out;
}

fs.mkdirSync('icons', { recursive: true });
for (const S of [16, 32, 48, 128]) {
  fs.writeFileSync(`icons/icon${S}.png`, encodePNG(S, S, renderAt(S)));
  console.log('wrote icons/icon' + S + '.png');
}
