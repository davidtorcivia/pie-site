// *PIE illumination: an ornament library drawn from the world the language came from, not from later manuscripts.
//   cord      the twisted-cord impressions of Corded Ware pottery (rules, frames)
//   comb      pit-and-comb stipple and incised herringbone (grounds)
//   wheel     the spoked sun wheel of the chariot peoples (corners, the hymns)
//   petroglyph horse, stag and wolf, pecked like steppe rock art (margins)
//   kurgan    the strata of a burial mound, with its red-ochre floor (the foot of a page)
//   steppe    feather grass (Stipa), wormwood and steppe tulips, the plants of the Pontic steppe (the margin garden)
//   initial   a letter in a cord-bordered square on an incised ground, with sun-wheel corners
// Everything is drawn in one ink and its washes, plus one accent; nothing is an image.
import { noise2, rng } from './hatch.js';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
export const ramp = (ink, paper) => t => mix(ink, paper, t);

// ochre, malachite, lapis, charcoal, bronze, madder: the inks of the leaves (paper is bone)
export const INKS = [
  { name: 'ochre', ink: '#8e2a17', accent: '#2f5e8e', paper: '#f1e8d8' },
  { name: 'malachite', ink: '#1f5a43', accent: '#a8361f', paper: '#eee9dc' },
  { name: 'lapis', ink: '#1f3478', accent: '#b07a2a', paper: '#efebe2' },
  { name: 'charcoal', ink: '#22201c', accent: '#b23a1e', paper: '#ece6d8' },
  { name: 'bronze', ink: '#5a3b18', accent: '#1f5a43', paper: '#f0e6d2' },
  { name: 'madder', ink: '#6e1f3a', accent: '#b07a2a', paper: '#f1e9df' },
];

// --- cord: a twisted-cord impression along a line -------------------------------------------------------------
export function cord(ctx, x0, y0, x1, y1, { w = 6, tone, t = .1, pitch = .9 } = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), step = w * pitch;
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(a);
  ctx.strokeStyle = tone(t); ctx.lineWidth = Math.max(.8, w * .22); ctx.lineCap = 'round';
  for (let s = 0; s < L - step * .5; s += step) {
    ctx.beginPath(); ctx.moveTo(s, w * .45); ctx.quadraticCurveTo(s + step * .2, -w * .05, s + step * 1.05, -w * .45); ctx.stroke();
  }
  ctx.restore();
}
export function cordRect(ctx, x, y, w, h, o) {
  cord(ctx, x, y, x + w, y, o); cord(ctx, x + w, y, x + w, y + h, o); cord(ctx, x + w, y + h, x, y + h, o); cord(ctx, x, y + h, x, y, o);
}

// --- comb: pit-comb stipple rows, and herringbone ---------------------------------------------------------------
export function comb(ctx, x, y, w, h, { tone, t = .5, gap = 7, seed = 2 } = {}) {
  const r = rng(seed);
  ctx.fillStyle = tone(t);
  for (let yy = y + gap / 2, row = 0; yy < y + h; yy += gap, row++)
    for (let xx = x + (row % 2) * gap / 2; xx < x + w; xx += gap) {
      ctx.beginPath(); ctx.ellipse(xx + (r() - .5), yy + (r() - .5), 1.1 + r() * .6, .8 + r() * .5, .4, 0, 7); ctx.fill();
    }
}
export function herringbone(ctx, x, y, w, h, { tone, t = .45, row = 9, gap = 4.5, lw = 1 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = tone(t); ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (let yy = y, k = 0; yy < y + h; yy += row, k++) {
    const d = k % 2 ? 1 : -1;
    for (let xx = x - row; xx < x + w + row; xx += gap) { ctx.beginPath(); ctx.moveTo(xx, yy + row - 1.5); ctx.lineTo(xx + d * row * .6, yy + 1.5); ctx.stroke(); }
  }
  ctx.restore();
}

// --- wheel: the spoked sun wheel ------------------------------------------------------------------------------------
export function wheel(ctx, x, y, R, { tone, t = .1, spokes = 4, rays = 0, fill = null } = {}) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = tone(t); ctx.lineWidth = Math.max(1, R * .12); ctx.lineCap = 'round';
  if (fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * .18, 0, 7); ctx.fillStyle = tone(t); ctx.fill();
  for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
  ctx.lineWidth = Math.max(.7, R * .06);
  for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25); ctx.lineTo(Math.cos(a) * R * 1.6, Math.sin(a) * R * 1.6); ctx.stroke(); }
  ctx.restore();
}

// --- petroglyphs: silhouettes pecked as dots ---------------------------------------------------------------------
const GLYPHS = {
  horse: { body: [[.18,.36],[.3,.3],[.5,.31],[.66,.3],[.74,.18],[.79,.1],[.81,.05],[.84,.09],[.95,.18],[.93,.23],[.84,.2],[.79,.33],[.73,.44],[.73,.62],[.69,.62],[.66,.47],[.6,.48],[.59,.63],[.55,.63],[.54,.48],[.34,.48],[.32,.63],[.28,.63],[.28,.48],[.24,.47],[.23,.62],[.19,.62],[.18,.46],[.14,.4],[.06,.54],[.04,.52],[.12,.36]] },
  stag: { body: [[.2,.38],[.32,.33],[.52,.34],[.66,.32],[.73,.22],[.77,.16],[.8,.17],[.9,.22],[.89,.26],[.8,.25],[.76,.36],[.71,.46],[.72,.68],[.69,.68],[.66,.5],[.6,.5],[.6,.68],[.57,.68],[.55,.5],[.36,.5],[.34,.68],[.31,.68],[.3,.5],[.26,.49],[.25,.68],[.22,.68],[.2,.48],[.17,.44],[.14,.39]],
    lines: [[[.77,.16],[.72,.04],[.66,-.06]], [[.72,.04],[.78,-.04]], [[.69,-.01],[.62,0]], [[.79,.16],[.86,.04],[.9,-.06]], [[.86,.04],[.94,.0]]] },
  wolf: { body: [[.15,.36],[.35,.32],[.6,.33],[.72,.28],[.77,.19],[.79,.12],[.82,.19],[.95,.26],[.93,.3],[.82,.31],[.76,.4],[.72,.6],[.69,.6],[.66,.44],[.56,.45],[.54,.6],[.51,.6],[.5,.45],[.34,.45],[.31,.6],[.28,.6],[.27,.44],[.22,.44],[.2,.6],[.17,.6],[.16,.42],[.1,.46],[.02,.58],[.02,.53],[.1,.4]] },
};
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
export function petroglyph(ctx, kind, x, y, size, { tone, t = .12, seed = 5, flip = false } = {}) {
  const g = GLYPHS[kind], r = rng(seed);
  ctx.save(); ctx.translate(x, y); if (flip) { ctx.translate(size, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = tone(t);
  const d = Math.max(1.6, size / 70);
  for (let yy = -.1; yy < .72; yy += d / size * 1.1) for (let xx = 0; xx < 1; xx += d / size * 1.1) {
    const jx = xx + (r() - .5) * d / size, jy = yy + (r() - .5) * d / size;
    if (inPoly(jx, jy, g.body) && r() < .82) { ctx.beginPath(); ctx.arc(jx * size, jy * size, d * (.42 + r() * .3), 0, 7); ctx.fill(); }
  }
  for (const L of g.lines || []) for (let i = 1; i < L.length; i++) {
    const [ax, ay] = L[i - 1], [bx, by] = L[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) * size / d);
    for (let k = 0; k <= n; k++) { const u = k / n; ctx.beginPath(); ctx.arc((ax + (bx - ax) * u) * size + (r() - .5), (ay + (by - ay) * u) * size + (r() - .5), d * .5, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

// --- kurgan: the layered mound at the foot of a page --------------------------------------------------------------
export function kurgan(ctx, x, y, w, h, { tone, ochre = '#a8361f', seed = 4 } = {}) {
  const n = noise2(seed), cx = x + w * .5;
  const arc = (k, ww) => { ctx.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, xx = cx - ww / 2 + ww * u; ctx.lineTo(xx, y + h - Math.sin(u * Math.PI) * h * k * (1 + n(u * 3, k * 5) * .06)); } };
  ctx.save();
  arc(1, w); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.clip();
  for (let i = 0; i < 9; i++) { const k = 1 - i * .1; arc(k, w * (1 - i * .03)); ctx.strokeStyle = i === 7 ? ochre : tone(.25 + i * .06); ctx.lineWidth = i === 7 ? 3.2 : 1; ctx.stroke(); }
  comb(ctx, x, y, w, h, { tone, t: .55, gap: 9, seed });
  ctx.restore();
  arc(1, w); ctx.strokeStyle = tone(.08); ctx.lineWidth = 1.4; ctx.stroke();
}

// --- steppe flora ---------------------------------------------------------------------------------------------------
// feather grass: a fine stem and a long silky awn that bends with the wind
function featherGrass(ctx, x, y, H, lean, tone, r) {
  const pts = []; let px = x, py = y, a = -Math.PI / 2 + lean * .2;
  for (let d = 0; d < H; d += 4) { a += lean * .012 + (r() - .5) * .03; px += Math.cos(a) * 4; py += Math.sin(a) * 4; pts.push([px, py, a]); }
  ctx.strokeStyle = tone(.18); ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(x, y); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
  const start = Math.floor(pts.length * .45);
  for (let i = start; i < pts.length; i++) {
    const [qx, qy, qa] = pts[i], k = (i - start) / (pts.length - start), L = 5 + 9 * Math.sin(k * Math.PI);
    ctx.strokeStyle = tone(.45 + k * .3); ctx.lineWidth = .5;
    for (const s of [1, -1]) { const b = qa + s * .5 + lean * .3; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + Math.cos(b) * L, qy + Math.sin(b) * L); ctx.stroke(); }
  }
}
// wormwood: a silvery spray of finely divided leaves
function wormwood(ctx, x, y, H, tone, r) {
  const grow = (sx, sy, a, L, depth) => {
    const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    ctx.strokeStyle = tone(.3 + depth * .08); ctx.lineWidth = Math.max(.5, 1.6 - depth * .35);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a + .3) * L * .5, sy + Math.sin(a + .3) * L * .5, ex, ey); ctx.stroke();
    if (depth > 3) { for (let i = 0; i < 3; i++) { ctx.fillStyle = tone(.5); ctx.beginPath(); ctx.ellipse(ex + (r() - .5) * 3, ey + (r() - .5) * 3, 2.2, .8, a + r(), 0, 7); ctx.fill(); } return; }
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) grow(sx + (ex - sx) * (.4 + i * .25), sy + (ey - sy) * (.4 + i * .25), a + (r() < .5 ? -1 : 1) * (.45 + r() * .4), L * (.5 + r() * .15), depth + 1);
  };
  grow(x, y, -Math.PI / 2 + (r() - .5) * .3, H * .42, 0);
}
// steppe tulip: a cup of three visible tepals on a bare stem, two strap leaves
function tulip(ctx, x, y, H, tone, accent, r) {
  const tx = x + (r() - .5) * 14, ty = y - H;
  ctx.strokeStyle = tone(.15); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - H * .5, tx, ty); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 12, y - H * .3, x + s * 6, y - H * .55); ctx.quadraticCurveTo(x + s * 3, y - H * .3, x, y);
    ctx.fillStyle = tone(.55); ctx.fill(); ctx.strokeStyle = tone(.15); ctx.lineWidth = .6; ctx.stroke();
  }
  const R = 7 + r() * 3;
  for (const [dx, k] of [[-.55, .35], [.55, .35], [0, 0]]) {
    ctx.beginPath(); ctx.moveTo(tx + dx * R * .4, ty + R * .2); ctx.bezierCurveTo(tx + dx * R * 1.4, ty - R * .2, tx + dx * R * .9, ty - R * 1.4, tx + dx * R * .3, ty - R * 1.5);
    ctx.bezierCurveTo(tx + dx * R * .1 - R * .3, ty - R * .8, tx - R * .2 + dx * R, ty, tx + dx * R * .4, ty + R * .2);
    ctx.fillStyle = k ? mixAccent(accent, .25) : accent; ctx.fill(); ctx.strokeStyle = tone(.1); ctx.lineWidth = .6; ctx.stroke();
  }
}
const mixAccent = (a, t) => mix(a, '#ffffff', t);

// a steppe margin: grasses, wormwood and tulips rising from a ground line, staged so it can grow in
export function steppe({ x, y, w, h, tone, accent, seed = 1, wind = .6 }) {
  const r = rng(seed), ops = [];
  const add = (t, f) => ops.push({ t, f });
  const base = y + h;
  for (let i = 0; i < Math.max(6, w / 9); i++) { const gx = x + r() * w, H = h * (.35 + r() * .6); add(r() * .5, ctx => featherGrass(ctx, gx, base, H, wind + (r() - .5) * .4, tone, rng(seed + i))); }
  for (let i = 0; i < Math.max(2, w / 60); i++) { const gx = x + w * (.1 + r() * .8), H = h * (.25 + r() * .25); add(.3 + r() * .3, ctx => wormwood(ctx, gx, base, H, tone, rng(seed * 7 + i))); }
  for (let i = 0; i < Math.max(1, w / 90); i++) { const gx = x + w * (.15 + r() * .7), H = h * (.18 + r() * .2); add(.6 + r() * .3, ctx => tulip(ctx, gx, base, H, tone, accent, rng(seed * 13 + i))); }
  ops.sort((a, b) => a.t - b.t);
  return (ctx, k = 1) => { for (const o of ops) { if (o.t > k) break; o.f(ctx); } };
}

// --- initial: a letter in a cord-bordered square, on an incised ground, with sun-wheel corners ---------------------
export function initial(canvas, letter, { extra = '', ink, paper, accent, font = 'serif', weight = 900, variation = 'normal', size = 120, seed = 1, ground = 'herringbone' } = {}) {
  const d = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(size * d);
  canvas.style.width = canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  const tone = ramp(ink, paper), m = size * .07, s = size - m * 2;
  ctx.fillStyle = paper; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = tone(.82); ctx.fillRect(m, m, s, s);
  if (ground === 'comb') comb(ctx, m + 4, m + 4, s - 8, s - 8, { tone, t: .45, gap: size / 16, seed });
  else herringbone(ctx, m + 3, m + 3, s - 6, s - 6, { tone, t: .5, row: size / 12, gap: size / 30, lw: Math.max(.8, size / 140) });
  cordRect(ctx, m, m, s, s, { w: size * .055, tone, t: .08 });
  // the letter: an accent shadow a hair off register, then the ink, then a paper keyline to lift it off the ground
  ctx.font = `${weight} ${s * .78}px ${font}`;
  try { ctx.fontVariationSettings = variation; } catch {}
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const mtr = ctx.measureText(letter), by = size / 2 + (mtr.actualBoundingBoxAscent - mtr.actualBoundingBoxDescent) / 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = paper; ctx.lineWidth = size * .06; ctx.strokeText(letter, size / 2, by);
  ctx.fillStyle = accent; ctx.fillText(letter, size / 2 + size * .022, by + size * .018);
  ctx.fillStyle = ink; ctx.fillText(letter, size / 2, by);
  // the rest of the first sound: a modifier letter raised (kʷ, dʰ), a laryngeal digit lowered (h₂)
  if (extra) {
    const right = size / 2 + mtr.width / 2, small = s * .3;
    ctx.font = `${weight} ${small}px ${font}`; ctx.textAlign = 'left';
    const sup = extra.replace(/[₁₂₃]/g, ''), sub = extra.replace(/[^₁₂₃]/g, '').replace(/[₁₂₃]/g, c => ({ '₁': '1', '₂': '2', '₃': '3' })[c]);
    const put = (t, y) => { ctx.strokeStyle = paper; ctx.lineWidth = size * .04; ctx.strokeText(t, right - size * .02, y); ctx.fillStyle = ink; ctx.fillText(t, right - size * .02, y); };
    if (sup) put(sup.replace('ʷ', 'w').replace('ʰ', 'h'), by - mtr.actualBoundingBoxAscent * .55);
    if (sub) put(sub, by + small * .3);
  }
  for (const [cx, cy] of [[m, m], [size - m, m], [m, size - m], [size - m, size - m]]) wheel(ctx, cx, cy, size * .055, { tone, t: .05, fill: paper });
  return canvas;
}
