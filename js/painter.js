// The painter: a silhouette (a mask image) painted in combed strokes, after the owner's reference paintings.
// Strokes follow each part's own axis (the structure tensor of the shape's distance field: a leg's length, the
// barrel, the neck), laid in two passes over a dark underpainting, broken by dry brush on the canvas tooth.
// The horse silhouettes are Eadweard Muybridge's The Horse in Motion (1878, public domain), rider removed
// (art/horse/frame-01..11.png).
import { noise2, rng } from './hatch.js';

export async function loadMask(url) {
  const img = new Image(); img.src = url; await img.decode();
  return img;
}
// silhouette mask at w×h (1 inside), its distance field and contour-tangent angle field
function fields(img, w, h) {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, M = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) M[i] = d[i * 4] < 128 ? 1 : 0;
  // chamfer distance to the outside
  const D = new Float32Array(w * h).fill(1e9);
  for (let i = 0; i < w * h; i++) if (!M[i]) D[i] = 0;
  const pass = (x, y, dx, dy, c) => { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) D[y * w + x] = Math.min(D[y * w + x], D[j] + c); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { pass(x, y, -1, 0, 1); pass(x, y, 0, -1, 1); pass(x, y, -1, -1, 1.414); pass(x, y, 1, -1, 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { pass(x, y, 1, 0, 1); pass(x, y, 0, 1, 1); pass(x, y, 1, 1, 1.414); pass(x, y, -1, 1, 1.414); }
  // a blurred copy for smooth gradients
  const B = new Float32Array(w * h), R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += D[y * w + xx]; n++; } } B[y * w + x] = s / n; }
  const B2 = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += B[yy * w + x]; n++; } } B2[y * w + x] = s / n; }
  // the structure tensor of the distance field, smoothed wide: each region's axis (the neck's, the barrel's, a leg's)
  const Jxx = new Float32Array(w * h), Jxy = new Float32Array(w * h), Jyy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = B2[i + 1] - B2[i - 1], gy = B2[i + w] - B2[i - w];
    Jxx[i] = gx * gx; Jxy[i] = gx * gy; Jyy[i] = gy * gy;
  }
  const blur = (A, R) => { const T = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x < w; x++) { if (x + R < w) s += A[y * w + x + R]; if (x - R - 1 >= 0) s -= A[y * w + x - R - 1]; if (x >= 0) T[y * w + x] = s; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y < h; y++) { if (y + R < h) s += T[(y + R) * w + x]; if (y - R - 1 >= 0) s -= T[(y - R - 1) * w + x]; if (y >= 0) A[y * w + x] = s; } } };
  const R2 = Math.max(5, Math.round(h * .075));
  for (const A of [Jxx, Jxy, Jyy]) { blur(A, R2); blur(A, R2); blur(A, R2); }
  const O = new Float32Array(w * h);
  const C = new Float32Array(w * h);   // coherence: how clearly a region has one axis
  for (let i = 0; i < w * h; i++) { O[i] = .5 * Math.atan2(2 * Jxy[i], Jxx[i] - Jyy[i]) + Math.PI / 2; const t = Jxx[i] + Jyy[i]; C[i] = t > 1e-9 ? Math.hypot(Jxx[i] - Jyy[i], 2 * Jxy[i]) / t : 0; }
  return { M, D, B: B2, O, C, w, h };
}

export function paintSilhouette(outCtx, img, x0, y0, W, H, { ground, mids, lights, paper, accent, seed = 1, density = 1, flip = false, mane = null } = {}) {
  const PAD = H * .12, layer = new OffscreenCanvas(Math.ceil(W + PAD * 2) * 2, Math.ceil(H + PAD * 2) * 2), ctx = layer.getContext('2d');
  ctx.scale(2, 2); const x = PAD, y = PAD;
  const S = 1;   // field resolution = CSS px
  const F = fields(img, Math.round(W * S), Math.round(H * S)), r = rng(seed), n = noise2(seed), tooth = noise2(seed + 99);
  const inside = (X, Y) => { const i = Math.floor((Y - y) * S), j = Math.floor((flip ? x + W - X : X - x) * S); return i >= 0 && j >= 0 && i < F.h && j < F.w && F.M[i * F.w + j] === 1; };
  const angle = (X, Y) => {
    const i = Math.max(1, Math.min(F.h - 2, Math.floor((Y - y) * S))), j = Math.max(1, Math.min(F.w - 2, Math.floor((flip ? x + W - X : X - x) * S)));
    let a = F.O[i * F.w + j];
    const c = F.C[i * F.w + j], k = Math.min(1, Math.max(0, (c - .15) / .35));   // ambiguous: fall back to the body's run
    let d = a - 0; d = Math.atan2(Math.sin(2 * d), Math.cos(2 * d)) / 2; a = d * k;
    if (flip) a = Math.PI - a;
    return a + n(X * .03, Y * .03) * .3;
  };
  const dist = (X, Y) => { const i = Math.floor((Y - y) * S), j = Math.floor((flip ? x + W - X : X - x) * S); return i >= 0 && j >= 0 && i < F.h && j < F.w ? F.D[i * F.w + j] / S : 0; };
  const jit = (c, t) => { const v = parseInt(c.slice(1), 16), k = (t - .5) * 26; const ch = sh => Math.max(0, Math.min(255, ((v >> sh) & 255) + k)); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  const silhouette = () => { ctx.save(); if (flip) { ctx.translate(x + W, y); ctx.scale(-1, 1); } else ctx.translate(x, y); ctx.drawImage(maskCanvas(img, W, H, ground), 0, 0, W, H); ctx.restore(); };
  // aura and underpainting
  ctx.save(); ctx.filter = `blur(${H * .035}px)`; ctx.globalAlpha = .4; silhouette(); ctx.restore();
  ctx.save(); silhouette(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < W * H / 90; i++) { const X = x + r() * W, Y = y + r() * H; ctx.globalAlpha = .22; ctx.fillStyle = mids[Math.floor(r() * mids.length)]; ctx.beginPath(); ctx.ellipse(X, Y, H * .012 * (.3 + r()), H * .006 * (.3 + r()), r() * 3, 0, 7); ctx.fill(); }
  ctx.restore();
  // strokes
  const sp = Math.max(1.6, H / 110) / density, step = H / 240;
  const brush = (pts, w) => {
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length, [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (tooth(x1 * .35, y1 * .35) > .55) continue;        // dry brush: the hair skips on the tooth
      ctx.lineWidth = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) + .2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  };
  ctx.lineCap = 'round';
  for (const [pal, dens, wmul, lenMul] of [[mids, .6, .9, 1], [lights, .16, .55, .8]]) {
    const g = sp / Math.sqrt(dens);
    for (let Y = y; Y < y + H; Y += g) for (let X = x; X < x + W; X += g) {
      let px = X + (r() - .5) * g * 2, py = Y + (r() - .5) * g * 2;
      if (!inside(px, py)) continue;
      const L = H * .09 * lenMul * (.45 + r() * .9), pts = [[px, py]];
      let prev = null;
      for (let d = 0; d < L; d += step) {
        let a = angle(px, py);
        if (prev !== null && Math.cos(a - prev) < 0) a += Math.PI;   // keep going the same way
        prev = a; px += Math.cos(a) * step; py += Math.sin(a) * step;
        if (!inside(px, py) && r() < .5) break;
        pts.push([px, py]);
      }
      if (pts.length < 3) continue;
      const v = (pts[0][1] - y) / H, shade = Math.max(0, Math.min(1, (v - .15) / .6)), edge = Math.min(1, dist(pts[0][0], pts[0][1]) / (H * .05));
      const idx = Math.min(pal.length - 1, Math.floor((1 - shade) * pal.length * .75 + r() * pal.length * .45));
      const t = r();
      ctx.strokeStyle = t < .01 ? accent : (pal === mids && r() < shade * .3) ? ground : jit(pal[idx], r());
      ctx.globalAlpha = (.65 + r() * .35) * (.55 + .45 * edge);
      brush(pts, H / 230 * (.6 + r() * 1.1) * wmul);
    }
  }
  // the mane: strands streaming back and up off the crest, in the wind of the gallop, and a forelock at the poll
  if (mane) {
    const [u0, u1] = mane, top = j => { for (let i = 0; i < F.h; i++) if (F.M[i * F.w + j]) return i; return -1; };
    for (let k = 0; k < 260 * density; k++) {
      const u = u0 + (u1 - u0) * Math.pow(r(), .8), j = Math.floor(u * F.w), i = top(j);
      if (i < 0) continue;
      const along = (u - u0) / (u1 - u0), L = H * (.05 + .11 * (1 - along) * (.5 + r())), a = Math.PI + .55 + (r() - .5) * .5 - along * .3;
      let X = flip ? x + W - j / S : x + j / S, Y = y + i / S + H * .012;
      const pts = [[X, Y]];
      for (let t = 0; t < 12; t++) { const aa = a + Math.sin(t * .5 + k) * .12; X += (flip ? -1 : 1) * Math.cos(aa) * L / 12; Y += Math.sin(aa) * L / 12; pts.push([X, Y]); }
      const t = r(); ctx.strokeStyle = jit((t < .55 ? mids : lights)[Math.floor(r() * 3)] || mids[0], r());
      ctx.globalAlpha = .8; brush(pts, H / 260 * (.7 + r()));
    }
  }
  ctx.globalAlpha = 1;
  outCtx.drawImage(layer, x0 - PAD, y0 - PAD, W + PAD * 2, H + PAD * 2);
}
const masks = new Map();
function maskCanvas(img, W, H, color) {
  const k = img.src + W + H + color; if (masks.has(k)) return masks.get(k);
  const c = new OffscreenCanvas(Math.round(W), Math.round(H)), g = c.getContext('2d');
  g.drawImage(img, 0, 0, W, H); const id = g.getImageData(0, 0, c.width, c.height), d = id.data, v = parseInt(color.slice(1), 16);
  for (let i = 0; i < d.length; i += 4) { const a = 255 - d[i]; d[i] = (v >> 16) & 255; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255; d[i + 3] = a; }
  g.putImageData(id, 0, 0); masks.set(k, c); return c;
}
// canvas grain: fine noise and a faint weave, multiplied
export function grain(ctx, w, h, amt = .07) {
  const g = document.createElement('canvas'); g.width = 256; g.height = 256; const gc = g.getContext('2d'), im = gc.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const y = (i / 4 / 256) | 0, x = (i / 4) % 256, v = 200 + Math.random() * 55 - ((x % 3 === 0) ? 14 : 0) - ((y % 3 === 0) ? 10 : 0); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  gc.putImageData(im, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = amt * 4; ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.fillRect(0, 0, w, h); ctx.restore();
}
