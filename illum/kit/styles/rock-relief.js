// PIE (research/24-pie.md): relief drawn live. Every piece is a list of MARKS, each one thing a hand did to a surface:
// a cord pressed into clay (a bead), a stick drawn through it (a groove), a hammer-stone's blow on rock (a pit), a
// punch or a raised line on sheet bronze (a punch, a ridge, a boss). The marks are summed into a height field at device
// resolution, in the order they were made, and the field is lit once from the upper left. Nothing is textured: every
// variation in the result is one of the marks.
//   field(w, h, dpr)                   an empty surface, w x h CSS px
//   apply(F, mark)                     one mark into the field (marks: see MARKS); returns its device bbox
//   shade(F, look, out?, bbox?)        the lit surface as premultiplied RGBA (an ImageData), the ground left clear
//   writer(F, marks, look, g, ...)     ?draw: the marks laid in their order (each at its own moment), only the changed
//                                      part relit each frame
// Not kit/gold.js: its fields are a gesso cushion with chance specks under a fixed gold ramp; these surfaces are cut and
// beaten, and their colours are the site's.

export function field(w, h, dpr = 2) {
  const cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr), n = cw * ch;
  return { w, h, dpr, cw, ch, H: new Float32Array(n), P: new Float32Array(n), S: new Float32Array(n) };
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function box(F, x0, y0, x1, y1) { const d = F.dpr;
  return [Math.max(0, Math.floor(x0 * d)), Math.max(0, Math.floor(y0 * d)), Math.min(F.cw - 1, Math.ceil(x1 * d)), Math.min(F.ch - 1, Math.ceil(y1 * d))]; }

// The marks. Depths and heights in CSS px (they only steer the light, so their scale is the slope they make).
//   bead   {x, y, a, len, wid, d, lip}  a twisted cord's ply pressed in: an ellipse sunk d, its floor rounded, the clay it
//                                       pushed aside standing as a low lip on the side the cord rolled from
//   pit    {x, y, r, d, rim}            a blow: a bowl, steeper on the side the stone came from
//   groove {p: [[x,y]...], w, d}        a line drawn through the surface with a blunt point (a trough, its width w)
//   ridge  {p, w, h}                    a raised line chased up from behind (rounded, its top flattening a little)
//   boss   {x, y, r, h}                 a dome beaten up from behind
//   punch  {x, y, r, d}                 a punch's dent from the front
//   sheet  {mask, w}                    the sheet itself (S): a coverage function (x, y) => 0..1 over its bbox
//   paint  {x, y, r, v}                 pigment (P) laid into the surface at a point (the carver's red; the smith's gold)
export const MARKS = {
  bead(F, m) { const { x, y, a, len, wid, d, lip = .25 } = m, R = len / 2 + wid, [x0, y0, x1, y1] = box(F, x - R, y - R, x + R, y + R);
    const c = Math.cos(a), s = Math.sin(a), k = F.dpr, H = F.H;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = (X + .5) / k - x, py = (Y + .5) / k - y;
      const u = (px * c + py * s) / (len / 2), v = (-px * s + py * c) / (wid / 2), r2 = u * u + v * v, i = Y * F.cw + X;
      if (r2 < 1) { const h = -d * Math.sqrt(1 - r2) * (1 - .25 * u * u); if (h < H[i]) H[i] = h; }
      else if (r2 < 2.1 && H[i] >= 0) { const t = (Math.sqrt(r2) - 1) / .45, h = lip * d * Math.max(0, Math.sin(Math.PI * Math.min(1, t))) * (v > 0 ? 1 : .45); if (h > H[i]) H[i] = h; } }
    return [x0, y0, x1, y1]; },
  pit(F, m) { const { x, y, r, d, rim = .04, ax = -.35, ay = -.45 } = m, [x0, y0, x1, y1] = box(F, x - r * 1.3, y - r * 1.3, x + r * 1.3, y + r * 1.3), k = F.dpr, H = F.H;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = ((X + .5) / k - x) / r, py = ((Y + .5) / k - y) / r, r2 = px * px + py * py, i = Y * F.cw + X;
      if (r2 < 1) { const h = -d * (1 - r2) ** .6 * (1 + .35 * (px * ax + py * ay)); if (h < H[i]) H[i] = h; }
      else if (r2 < 1.69 && H[i] >= 0) { const h = rim * d * Math.sin(Math.PI * (Math.sqrt(r2) - 1) / .3); if (h > H[i]) H[i] = h; } }
    return [x0, y0, x1, y1]; },
  groove(F, m) { return line(F, m.p, m.w, -m.d, Array.isArray(m.wa) ? m.wa : null); },
  ridge(F, m) { return line(F, m.p, m.w, m.h, Array.isArray(m.wa) ? m.wa : null); },
  boss(F, m) { const { x, y, r, h } = m, [x0, y0, x1, y1] = box(F, x - r, y - r, x + r, y + r), k = F.dpr, H = F.H;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = ((X + .5) / k - x) / r, py = ((Y + .5) / k - y) / r, r2 = px * px + py * py, i = Y * F.cw + X;
      if (r2 < 1) { const v = h * (1 - r2) ** .75; if (v > H[i]) H[i] = v; } }
    return [x0, y0, x1, y1]; },
  punch(F, m) { const { x, y, r, d } = m, [x0, y0, x1, y1] = box(F, x - r, y - r, x + r, y + r), k = F.dpr, H = F.H;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = ((X + .5) / k - x) / r, py = ((Y + .5) / k - y) / r, r2 = px * px + py * py, i = Y * F.cw + X;
      if (r2 < 1) H[i] -= d * (1 - Math.sqrt(r2)); }
    return [x0, y0, x1, y1]; },
  sheet(F, m) { const [x0, y0, x1, y1] = box(F, ...m.bbox), k = F.dpr;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const i = Y * F.cw + X, v = m.mask((X + .5) / k, (Y + .5) / k); if (v > F.S[i]) F.S[i] = v; }
    return [x0, y0, x1, y1]; },
  // a line drawn round a letter: the letter's own edge (Mb: its coverage blurred to the line's width), only the part of it
  // between rows y0 and y1 (CSS px) so the hand can be seen drawing it down the letter; sign -1 cut in, +1 raised
  edge(F, m) { const { Mb, d, sign = -1, y0 = 0, y1 = F.h, band = .3 } = m, H = F.H, Y0 = Math.max(0, Math.floor(y0 * F.dpr)), Y1 = Math.min(F.ch - 1, Math.ceil(y1 * F.dpr));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = 0; X < F.cw; X++) { const i = Y * F.cw + X, q = (Mb[i] - .5) / band; if (q <= -1 || q >= 1) continue;
      const v = sign * d * Math.sqrt(1 - q * q); if (sign < 0 ? v < H[i] : v > H[i]) H[i] = v; }
    return [0, Y0, F.cw - 1, Y1]; },
  paint(F, m) { const { x, y, r, v = 1 } = m, [x0, y0, x1, y1] = box(F, x - r - 1, y - r - 1, x + r + 1, y + r + 1), k = F.dpr;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const i = Y * F.cw + X, e = clamp01(r - Math.hypot((X + .5) / k - x, (Y + .5) / k - y) + .5) * v; if (e > F.P[i]) F.P[i] = e; }
    return [x0, y0, x1, y1]; },
};
// a polyline swept with a rounded profile (h < 0 a trough, h > 0 a ridge); wa: its width at each point
function line(F, p, w, h, wa) {
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; const W = Math.max(w, ...(wa ?? [w]));
  for (const [x, y] of p) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const all = box(F, bx0 - W, by0 - W, bx1 + W, by1 + W), k = F.dpr, H = F.H;
  for (let s = 0; s + 1 < p.length; s++) { const [ax, ay] = p[s], [bx, by] = p[s + 1], wa0 = (wa ? wa[s] : w) / 2, wb0 = (wa ? wa[s + 1] : w) / 2, R = Math.max(wa0, wb0);
    const [x0, y0, x1, y1] = box(F, Math.min(ax, bx) - R, Math.min(ay, by) - R, Math.max(ax, bx) + R, Math.max(ay, by) + R);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const px = (X + .5) / k - ax, py = (Y + .5) / k - ay, t = clamp01((px * dx + py * dy) / L2);
      const ex = px - t * dx, ey = py - t * dy, hw = wa0 + (wb0 - wa0) * t, q = (ex * ex + ey * ey) / (hw * hw); if (q >= 1) continue;
      const i = Y * F.cw + X, v = h * Math.sqrt(1 - q) ** (h > 0 ? .8 : 1);
      if (h < 0 ? v < H[i] : v > H[i]) H[i] = v; } }
  return all;
}
export const apply = (F, m) => MARKS[m.k](F, m);

// ---- light -----------------------------------------------------------------------------------------------------------------
// one light from the upper left, raking (a photographer's light on a sherd, a rock face at evening, a bronze in a case).
// A look says what the surface is:
//   clay   {shadow, lip, paste?, ks, kh, kc}   impressions are cast shadow and a burnished lip, the ground the page's own;
//                                             paste: the white lime pressed into the impressions (dark grounds)
//   rock   {paint, shadow, light}             the furrow's floor filled with the carver's red (the modern repainting; the
//                                             real carvings are grey), its walls shadowed and lit
//   metal  {ramp, patina, gold, spec}         the sheet's colour from its slope, verdigris in its punches, gold where painted
const L = (() => { const v = [-.52, -.62, .58], l = Math.hypot(...v); return v.map(c => c / l); })();
export function shade(F, look, out = null, bb = null) {
  const { cw, ch, H, P, S, dpr } = F, img = out ?? new ImageData(cw, ch), o = img.data, px = 1 / dpr;
  const [x0, y0, x1, y1] = bb ?? [0, 0, cw - 1, ch - 1];
  for (let Y = Math.max(1, y0); Y <= Math.min(ch - 2, y1); Y++) for (let X = Math.max(1, x0); X <= Math.min(cw - 2, x1); X++) {
    const i = Y * cw + X, h = H[i];
    const gx = (H[i + 1] - H[i - 1]) / (2 * px), gy = (H[i + cw] - H[i - cw]) / (2 * px), l = Math.hypot(gx, gy, 1);
    const ndl = (-gx * L[0] - gy * L[1] + L[2]) / l, dd = ndl - L[2];
    let r = 0, g = 0, b = 0, a = 0;
    const over = (c, al) => { if (al <= 0) return; al = Math.min(1, al); r = c[0] * al + r * (1 - al); g = c[1] * al + g * (1 - al); b = c[2] * al + b * (1 - al); a = al + a * (1 - al); };
    if (look.kind === 'clay') {
      const cav = Math.max(0, -h) / look.dref;
      if (look.paste) over(look.paste, clamp01((cav - .18) / .25) * look.pk);
      over(look.shadow, look.ks * Math.max(0, -dd) + look.kc * cav * (look.paste ? .15 : 1));
      over(look.lip, look.kh * Math.max(0, dd));
    } else if (look.kind === 'rock') {
      const dep = Math.max(0, -h) / look.dref, fill = clamp01((dep - .08) / .14) * look.pk;
      over(look.paint, fill * (1 - .15 * clamp01(-dd * 3)));        // the paint lies in the pits: thinner on their steep sunward walls
      over(look.shadow, look.ks * Math.max(0, -dd) * (1 - .5 * fill));
      over(look.light, look.kh * Math.max(0, dd) * (1 - fill));
    } else {
      const s = S[i]; if (s <= 0) { continue; }
      const nz = 1 / l, rz = 2 * nz * ndl - L[2];                      // the light's reflection off the sheet, toward the eye
      let e = look.base + look.kd * dd + look.spec * Math.max(0, rz) ** 18;
      const c = ramp(look.ramp, e), gold = P[i];
      over(c, s);
      if (gold > 0) over(ramp(look.gold, e + .08), gold * s);
      const hol = clamp01((-h - .8 * look.pref) / (.7 * look.pref));   // only in the punches (the planishing's broad dents are too shallow to hold it)          // verdigris gathers where the sheet lies below its surroundings
      if (look.patina && hol > 0) over(look.patina, hol * look.pk * s * (1 - gold));
      a = s;
    }
    const q = i * 4; o[q] = r * 255; o[q + 1] = g * 255; o[q + 2] = b * 255; o[q + 3] = a * 255;
  }
  return img;
}
function ramp(R, e) { e = clamp01(e) * (R.length - 1); const i = Math.min(R.length - 2, e | 0), f = e - i; return R[i].map((v, j) => v + (R[i + 1][j] - v) * f); }
// the whole piece, still: every mark, then the light
export function render(F, marks, look) { for (const m of marks) apply(F, m); return shade(F, look); }

// ?draw: the marks in their order, each landing at its own moment t (0..1 of dur); each frame relights only the part the
// new marks touched. (A press, a blow and a punch are each instant; the work grows mark by mark, never fades.)
export function writer(F, marks, look, g, { dur = 1600 } = {}) {
  const img = new ImageData(F.cw, F.ch); let k = 0;
  const step = f => { let bb = null;
    while (k < marks.length && (marks[k].t ?? k / marks.length) <= f) { const b = apply(F, marks[k++]); bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : b; }
    if (!bb) return; const e = 2; bb = [bb[0] - e, bb[1] - e, bb[2] + e, bb[3] + e];
    shade(F, look, img, bb); g.putImageData(img, 0, 0, Math.max(0, bb[0]), Math.max(0, bb[1]), bb[2] - bb[0] + 1, bb[3] - bb[1] + 1); };
  return { dur, at: step, done: () => step(1.01) };
}

// a seeded generator (mulberry32) for the hand's measured spread: every draw is a property of one mark
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const gauss = r => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) * 1.732; };

// a coverage blurred r CSS px (two box passes each way: near a gaussian)
export function blurMask(F, M, r) { const { cw, ch } = F, R = Math.max(1, Math.round(r * F.dpr)); let A = M;
  for (let pass = 0; pass < 2; pass++) { const T = new Float32Array(cw * ch), B = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) { let s = 0; for (let x = -R; x <= R; x++) s += A[y * cw + Math.min(cw - 1, Math.max(0, x))];
      for (let x = 0; x < cw; x++) { T[y * cw + x] = s / (2 * R + 1); s += A[y * cw + Math.min(cw - 1, x + R + 1)] - A[y * cw + Math.max(0, x - R)]; } }
    for (let x = 0; x < cw; x++) { let s = 0; for (let y = -R; y <= R; y++) s += T[Math.min(ch - 1, Math.max(0, y)) * cw + x];
      for (let y = 0; y < ch; y++) { B[y * cw + x] = s / (2 * R + 1); s += T[Math.min(ch - 1, y + R + 1) * cw + x] - T[Math.max(0, y - R) * cw + x]; } }
    A = B; }
  return A; }
// sample a device-grid field at CSS (x, y)
export const at = (F, A, x, y) => { const X = Math.round(x * F.dpr), Y = Math.round(y * F.dpr); return X < 0 || Y < 0 || X >= F.cw || Y >= F.ch ? 0 : A[Y * F.cw + X]; };
// a capital no wider than maxW (a wide face's M or W is set smaller than its I)
export function fitGlyph(glyph, ch, face, cap, maxW, cx, cy) { let d = glyph(ch, face, cap, cx, cy); const w = d.box[2] - d.box[0];
  if (w > maxW) d = glyph(ch, face, cap * maxW / w, cx, cy); return d; }
// a capital's coverage on the field's grid (device px): M[i] 0..1
export function letterMask(F, draw) { const c = new OffscreenCanvas(F.cw, F.ch).getContext('2d', { willReadFrequently: true });
  c.setTransform(F.dpr, 0, 0, F.dpr, 0, 0); c.fillStyle = '#000'; draw(c);
  const d = c.getImageData(0, 0, F.cw, F.ch).data, M = new Float32Array(F.cw * F.ch); for (let i = 0; i < M.length; i++) M[i] = d[i * 4 + 3] / 255; return M; }
