// Penwork: the hairline flourishing round a painted initial, grown from the letter's own shape.
// Pure geometry on grids (no canvas), so it can move to a worker. Page px throughout; grids carry their own resolution.
//
// After the pen-flourished Lombardic initials of a North Italian psalter, early 15th c. (Met 466773, at full size), with
// the staff of the French books (Met 466179, 467422). The flourisher's vocabulary is small and every mark is a
// decision: first the eyes (a ring with a dot, small lobes round it) set in the widest places; then hairlines ruled
// straight down, close and even, filling the counters and the panel beside the letter and stopping short of it; an
// arch over the panel with an eye on it; the panel's outer line running on down the margin as the staff; scallops
// strung along the edges; hooks with a bead at the ends. Regular in rhythm, irregular in execution.
import { tendril, resample, stream, noise1, noise2, PIGMENTS } from './marks.js';

// the letters' paints, flat and dense, pooling a little at the edge (as 466773's blue and vermilion); lapis in marks.js
// granulates too much for a letter body
PIGMENTS.azurite ??= { rgb: [38, 70, 160], gran: .03, rim: .42 };
PIGMENTS.minium ??= { rgb: [212, 76, 42], gran: .03, rim: .36 };

// ---- distance -----------------------------------------------------------------------------------------------------------
// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher 2012): distance in cells from every cell to the
// nearest cell where feat is set.
export function edt(feat, w, h) {
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const D = new Float64Array(w * h); for (let i = 0; i < w * h; i++) D[i] = feat[i] ? 0 : INF;
  const pass = (len) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) { let s; while ((s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--; k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; } };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = D[y * w + x]; pass(h); for (let y = 0; y < h; y++) D[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = D[y * w + x]; pass(w); for (let x = 0; x < w; x++) D[y * w + x] = d[x]; }
  const out = new Float32Array(w * h); for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(D[i]); return out;
}

// ---- the letter ------------------------------------------------------------------------------------------------------------
// A typeset glyph made to read as drawn: its edge moved in and out slowly (≈1 px at a 25 px wavelength), so the
// strokes swell and thin a little as a brush filling a drawn outline would, and a finer waver on top.
export function drawn({ M, w, h, x0, y0, res }, seed = 1, amp = .8) {
  const ink = new Uint8Array(w * h), paper = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { ink[i] = M[i] > .5; paper[i] = !ink[i]; }
  const Do = edt(ink, w, h), Di = edt(paper, w, h), slow = noise2(seed ^ 0x5d), fine = noise2(seed ^ 0x19), out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i, px = x0 + i / res, py = y0 + j / res;
    const sd = (Do[k] - Di[k]) / res, b = amp * (2 * slow(px / 25, py / 25) - 1) + .18 * (2 * fine(px / 5, py / 5) - 1);
    out[k] = Math.max(0, Math.min(1, .5 + (b - sd) * res * .5)); }
  return { M: out, w, h, x0, y0, res };
}

// ---- small geometry -------------------------------------------------------------------------------------------------------
export const arclen = p => p.reduce((a, q, i) => i ? a + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
const tangentAt = (p, i) => { const a = p[Math.max(0, i - 2)], b = p[Math.min(p.length - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// a hand does not hold a line exactly: drift it sideways a little, slowly
const wander = (p, amp, seed, scale = 26) => { const n = noise1(seed), q = resample(p, 1);
  return q.map((pt, i) => { const t = tangentAt(q, i), o = (n(i / scale) - .5) * 2 * amp; return [pt[0] - t[1] * o, pt[1] + t[0] * o]; }); };
// a ring as a pen goes round it: a little oval, closing just past where it began
const ring = (c, R, r, ov = .08, a0 = 0, turn = 1.04) => { const tilt = r() * Math.PI, out = [];
  for (let k = 0; k <= 40 * turn; k++) { const a = a0 + k / 40 * 2 * Math.PI, rr = R * (1 + ov * Math.cos(2 * (a - tilt)) + (r() - .5) * .03); out.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]); }
  return out; };

// ---- clearance --------------------------------------------------------------------------------------------------------------
// Distance from each cell (1 px) to the nearest thing already on the page: the letter, the words, the edge of the field,
// and every mark accepted so far (stamped in as it is accepted, so spacing is even by construction).
function clearance(x0, y0, w, h, blocked, cap) {
  const C = edt(blocked, w, h); for (let i = 0; i < C.length; i++) C[i] = Math.min(cap, C[i]);
  const get = (x, y) => { const i = Math.round(x - x0), j = Math.round(y - y0); return i < 0 || j < 0 || i >= w || j >= h ? 0 : C[j * w + i]; };
  const stamp = (pts, R = cap) => { for (const [px, py] of resample(pts, .8)) {
    const cx = px - x0, cy = py - y0, i0 = Math.max(0, Math.floor(cx - R)), i1 = Math.min(w - 1, Math.ceil(cx + R)), j0 = Math.max(0, Math.floor(cy - R)), j1 = Math.min(h - 1, Math.ceil(cy + R));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(i - cx, j - cy), k = j * w + i; if (d < C[k]) C[k] = d; } } };
  return { get, stamp, C };
}

// ---- budgets ---------------------------------------------------------------------------------------------------------------
// How much a scribe was paid to do. Not a density: each level is a different set of things a flourisher would make at
// that price, from the cheapest Book of Hours to the grandest choir book. (Levels 0..4; `rich` 0..1 rounds to one.)
//   plain:  one panel of hairlines on the margin side, a single eye, a short staff; the counters left bare.
//   modest: hairlines in the counters too, an eye in each, an arch with hooks over the panel, scallops down its edge.
//   usual:  a bay with an eye in the panel, an eye on the arch, a line over the letter, a foot, a pair of staff lines
//           with scallops in runs and eyes hung on them.
//   fine:   hairlines run longer, a small panel on the text side, teardrop hooks among the scallops, eyes strung
//           along the contour, the staff further down.
//   lavish: a third staff line, scallops all the way down, the staff ending in a little spray, and here and there a
//           dot in the letter's own colour.
export const BUDGETS = [
  { name: 'plain', counterEyes: 1, counterRules: false, bay: false, cap: 0, top: false, base: false, panelScallops: false, staffLines: 1, runs: null, staffEyes: 0, hooks: 0, contourEyes: 0, spray: false, accent: 0, textPanel: false },
  { name: 'modest', counterEyes: 9, counterRules: true, bay: false, cap: 1, top: false, base: false, panelScallops: true, staffLines: 1, runs: .6, staffEyes: 0, hooks: 0, contourEyes: 0, spray: false, accent: 0, textPanel: false },
  { name: 'usual', counterEyes: 9, counterRules: true, bay: true, cap: 2, top: true, base: true, panelScallops: true, staffLines: 2, runs: .42, staffEyes: .2, hooks: 0, contourEyes: 0, spray: false, accent: 0, textPanel: false },
  { name: 'fine', counterEyes: 9, counterRules: true, bay: true, cap: 2, top: true, base: true, panelScallops: true, staffLines: 2, runs: .3, staffEyes: .24, hooks: .2, contourEyes: .16, spray: false, accent: 0, textPanel: true },
  { name: 'lavish', counterEyes: 9, counterRules: true, bay: true, cap: 2, top: true, base: true, panelScallops: true, staffLines: 3, runs: -1, staffEyes: .28, hooks: .3, contourEyes: .3, spray: true, accent: .4, textPanel: true },
];
export const levelOf = rich => Math.max(0, Math.min(4, Math.round(+rich * 4)));

// ---- the flourish -------------------------------------------------------------------------------------------------------------
// glyph: { M, w, h, x0, y0, res } coverage of the painted letter (as painted). panel: [x0, y0, x1, y1] the field of
// hairlines beside the letter on the margin side (its left edge runs on down as the staff). keep: rects of words,
// padded. staff: null or { y1 } where the staff ends. g: the gap between ruled hairlines (px). cap: whether the panel
// gets an arch over it (with an eye standing on it where there is room) and a foot under it. Returns the marks in the order the pen made them: strokes { pts, kind, w, start,
// end } and dots { kind: 'dot', p, r, accent }. level: a budget (0..4, see above); right: how far past the letter, on
// the text side, the hairlines may go (px).
export function flourish({ glyph, panel, keep = [], staff = null, g = 2.6, cap = true, seed = 1, level = 2, right = g }) {
  const r = stream(seed, 'penwork'), out = [], B = BUDGETS[level];
  const { M, w: gw, h: gh, x0: gx, y0: gy, res } = glyph, ink = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) ink[i] = M[i] > .5;
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (ink[j * gw + i]) { bx0 = Math.min(bx0, i); bx1 = Math.max(bx1, i); by0 = Math.min(by0, j); by1 = Math.max(by1, j); }
  const box = [gx + bx0 / res, gy + by0 / res, gx + (bx1 + 1) / res, gy + (by1 + 1) / res];
  const [px0, py0, px1, py1] = panel, sy1 = staff ? staff.y1 : py1;
  const X0 = Math.floor(Math.min(px0, box[0]) - g * 8), Y0 = Math.floor(Math.min(py0, box[1]) - g * 9), X1 = Math.ceil(box[2] + g * 3), Y1 = Math.ceil(Math.max(sy1, box[3]) + g * 12), W = X1 - X0, H = Y1 - Y0;
  const onLetter = (x, y) => { const i = Math.round((x - gx) * res), j = Math.round((y - gy) * res); return i >= 0 && j >= 0 && i < gw && j < gh && ink[j * gw + i]; };
  const inWords = (x, y, pad = 0) => keep.some(k => x >= k[0] - pad && x <= k[2] + pad && y >= k[1] - pad && y <= k[3] + pad);
  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = X0 + i + .5, y = Y0 + j + .5; blocked[j * W + i] = onLetter(x, y) || inWords(x, y); }
  const CL = clearance(X0, Y0, W, H, blocked, 16);
  const accept = (pts, kind, o = {}) => { out.push({ pts, kind, ...o }); CL.stamp(pts); };
  const room = (pts, d) => pts.every(p => CL.get(p[0], p[1]) >= d);
  const C0 = Float32Array.from(CL.C), c0 = (x, y) => { const i = Math.round(x - X0), j = Math.round(y - Y0); return i < 0 || j < 0 || i >= W || j >= H ? 0 : C0[j * W + i]; };
  // the counters: paper enclosed by the letter
  const encl = (() => { const outside = new Uint8Array(gw * gh), st = [];
    for (let x = 0; x < gw; x++) st.push(x, (gh - 1) * gw + x); for (let y = 0; y < gh; y++) st.push(y * gw, y * gw + gw - 1);
    while (st.length) { const i = st.pop(); if (outside[i] || ink[i]) continue; outside[i] = 1; const x = i % gw;
      if (x > 0) st.push(i - 1); if (x < gw - 1) st.push(i + 1); if (i >= gw) st.push(i - gw); if (i < gw * (gh - 1)) st.push(i + gw); }
    return (x, y) => { const i = Math.round((x - gx) * res), j = Math.round((y - gy) * res); return i >= 0 && j >= 0 && i < gw && j < gh && !ink[j * gw + i] && !outside[j * gw + i]; }; })();

  // shapes the pen makes
  const hook = (p, h, size, sense) => tendril(p, h, size * 2 * Math.PI * .8, 0, sense / size, 1.6, .4);
  const eye = (c, R) => {
    accept(ring(c, R, r, .07, r() * 6.28), 'eye', { w: .5, start: 'cut', end: 'cut' });
    out.push({ kind: 'dot', p: c, r: Math.max(.7, R * .27), accent: !!B.accent && r() < B.accent });
    const nl = 4 + ((r() * 2) | 0), a0 = r() * 6.28;
    for (let k = 0; k < nl; k++) { const a = a0 + k / nl * 2 * Math.PI + (r() - .5) * .25, lr = R * (.36 + r() * .1), d = R + lr * .62;
      const lc = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d], pts = [];
      for (let i = 0; i <= 14; i++) { const b = a - 1.9 + i / 14 * 3.8; pts.push([lc[0] + Math.cos(b) * lr, lc[1] + Math.sin(b) * lr]); }
      if (room(pts.slice(3, -3), g * .55)) accept(pts, 'lobe', { w: .45, start: 'cut', end: 'cut' }); }
  };

  // 1. eyes: one in each counter that is wide enough, set at its widest place; the hairlines will keep round it
  const comps = [];
  { const seen = new Set(); for (let y = Math.ceil(box[1]); y < box[3]; y++) for (let x = Math.ceil(box[0]); x < box[2]; x++) { if (!encl(x, y)) continue;
      const key = Math.round((x - gx) * res) + ',' + Math.round((y - gy) * res); if (seen.has(key)) continue;
      // one representative per counter: the point of greatest clearance among its cells
      let best = null; const st = [[x, y]], mark = new Set([x + ',' + y]);
      while (st.length) { const [u, v] = st.pop(); const c = c0(u, v); if (!best || c > best.c) best = { c, p: [u, v] };
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = u + du, b = v + dv, k2 = a + ',' + b; if (!mark.has(k2) && encl(a, b)) { mark.add(k2); st.push([a, b]); } } }
      for (const k2 of mark) { const [a, b] = k2.split(',').map(Number); seen.add(Math.round((a - gx) * res) + ',' + Math.round((b - gy) * res)); }
      comps.push(best); } }
  for (const b of B.counterEyes >= comps.length ? comps : [...comps].sort((u, v) => v.c - u.c).slice(0, B.counterEyes)) { const R = Math.min(g * 2.2, (b.c - g * .8) / 1.7); if (R >= g * .8) eye([b.p[0] + (r() - .5) * .4, b.p[1] + (r() - .5) * .4], R); }

  // and, where the panel is wide enough, a bay of bare paper down its inner side (next to the letter) with an eye at
  // its middle: the hairlines part for it, and scallops along their edge face into it (as beside 466773's O)
  let bay = null;
  { const R = Math.min(g * 2.2, (px1 - px0) * .14), bw = 2 * R * 1.45 + g * .8;
    if (B.bay && px1 - px0 > bw + g * 5 && R >= g * 1.1) { bay = [px1 - bw, px1]; const ec = [(bay[0] + bay[1]) / 2 + (r() - .5) * .5, (py0 + py1) / 2 + (r() - .5) * g];
      eye(ec, R); bay.eye = ec; } }

  // 2. the panel's outer hairline, which is also the staff: down beside the panel and on down the margin, a curl at
  // its foot; a second beside it for the staff's run
  const sx = px0, lines = [];
  const outer = wander([[sx, py0 + g * .5], [sx, sy1]], .32, seed + 3, 46), foot = hook(outer.at(-1), Math.PI / 2, g * (1.6 + r() * .4), 1);
  // with no arch over the panel, the line's head turns over outward and ends in a bead, so no line just stops
  const head = cap && B.cap ? [outer[0]] : hook(outer[0], -Math.PI / 2, g * (1 + r() * .3), -1).reverse();
  const staff1 = [...head.slice(0, -1), ...outer, ...foot.slice(1)]; accept(staff1, 'staff', { w: .58, start: head.length > 1 ? 'pool' : 'cut', end: 'ball' }); lines.push(staff1);
  out.push({ kind: 'dot', p: foot.at(-1), r: 1.15 });
  // the second (and on a lavish page a third, shorter) hairline beside it down the staff
  if (staff) for (let k = 1; k < B.staffLines; k++) { const x2 = sx - g * 1.1 * k, ya = py1 + g * (2 + 5 * (k - 1)), yb = sy1 - g * (3 + 7 * (k - 1));
    if (yb - ya < g * 8) break;
    const s2 = wander([[x2, ya], [x2, yb]], .35, seed + 5 * k, 50), sf = hook(s2.at(-1), Math.PI / 2, g * (1.1 + .3 * (k - 1)), 1);
    const pair = [...s2, ...sf.slice(1)]; accept(pair, 'staff', { w: .48, start: 'pool', end: 'ball' }); lines.push(pair); }
  // the foot of a lavish staff ends in a little spray: two more hooks leave the outer line just above its curl
  if (staff && B.spray && lines.length > 1) { const L = resample(lines.at(-1), 1), i = Math.max(0, L.length - Math.round(g * 9));
    for (const [h, s] of [[Math.PI / 2 + .75, 1], [Math.PI / 2 + 1.35, -1]]) { const hk = hook(L[i - Math.round(g * 2.5 * (s < 0))] ?? L[i], h, g * (1 + r() * .3), s);
      if (room(hk.slice(5), g * .55)) { accept(hk, 'hook', { w: .48, start: 'cut', end: 'ball' }); out.push({ kind: 'dot', p: hk.at(-1), r: 1.15 + r() * .3, accent: !!B.accent && r() < B.accent }); } } }

  const topLines = [];
  // 3. the cap: an arch over the panel, an eye standing on it, a hook curling out from each end with a bead; from its
  // inner end a hairline runs on along the letter's top and ends in a hook over the shoulder
  if (cap && B.cap) {
    const cx0 = sx, cx1 = Math.min(px1, box[0] - g * .6), mid = (cx0 + cx1) / 2, span = cx1 - cx0, rise = span * (.22 + r() * .06), base = py0 + g * .5;
    const archP = []; for (let k = 0; k <= 24; k++) { const u = k / 24; archP.push([cx0 + span * u, base - rise * Math.sin(Math.PI * u) - (r() - .5) * .15]); }
    accept(archP, 'cap', { w: .5, start: 'cut', end: 'cut' });
    const er = Math.min(g * 1.8, span * .18), ec = [mid + (r() - .5), base - rise - er - g * .7];
    if (B.cap > 1 && room(ring(ec, er + g * .25, r), g * .35)) eye(ec, er);
    for (const [p, h, s] of [[archP[0], Math.PI * 1.15, 1], [archP.at(-1), -.1, -1]]) { const hk = hook(p, h, g * (1 + r() * .3), s);
      if (room(hk.slice(4), g * .6)) { accept(hk, 'hook', { w: .48, start: 'cut', end: 'ball' }); out.push({ kind: 'dot', p: hk.at(-1), r: 1.05 + r() * .25 }); } }
    // along the letter's top, a gap above it
    const ty = box[1] - g * 1.05, top = []; if (B.top) for (let x = cx1 + g * 1.5; x < box[2] - g * 2; x += 1) { if (c0(x, ty) >= g * .8 && !onLetter(x, ty + g * .6)) top.push([x, ty + (r() - .5) * .1]); else if (top.length > 4) break; }
    if (top.length > g * 4) { const tl = wander(top, .2, seed + 9, 30), hk = hook(tl.at(-1), 0, g * 1.1, -1), tline = [...tl, ...hk.slice(1)];
      if (room(tline, g * .5)) { accept(tline, 'top', { w: .48, start: 'cut', end: 'ball' }); topLines.push(tl); } }
  }

  // 4. the ruled hairlines: straight down, close and even, in the panel, the counters and every open place inside
  // the letter's box; each stops a little short of whatever it meets, never quite where its neighbour did
  const C1 = Float32Array.from(CL.C), c1 = (x, y) => { const i = Math.round(x - X0), j = Math.round(y - Y0); return i < 0 || j < 0 || i >= W || j >= H ? 0 : C1[j * W + i]; };
  const inPanel = (x, y) => x > sx && x < px1 && y > py0 && y < py1;
  const inBox = (x, y) => B.counterRules && x > box[0] && x < box[2] + right && y > box[1] - g * .3 && y < box[3];
  const inBay = (x, y) => bay && x > bay[0] && x < bay[1] + g && y > py0 - g && y < py1 + g;
  const open = (x, y) => (inPanel(x, y) || inBox(x, y)) && !inBay(x, y) && !onLetter(x, y) && !inWords(x, y) && c1(x, y) >= g * .62;
  const spacing = noise1(seed ^ 0x71), lineRows = [];
  for (let x0 = sx + g * .95, k = 0; x0 < box[2] + right; x0 += g * (.82 + .38 * spacing(x0 / 7)), k++) {
    const x = x0 + (r() - .5) * g * .12; let y0 = -1;
    for (let y = Math.min(py0, box[1]) - g; y <= Math.max(py1, box[3]) + .5; y += .5) {
      const ok = y < Math.max(py1, box[3]) && open(x, y);
      if (ok && y0 < 0) y0 = y;
      if (!ok && y0 >= 0) { const a = y0 + r() * g * .6, b = y - .5 - r() * g * .6;
        if (b - a > g * 1.6) { const pts = wander([[x, a], [x + (r() - .5) * .6, b]], .32, seed + 100 + k * 7 + (y | 0), 9); accept(pts, 'rule', { w: .5 + r() * .14, start: 'cut', end: 'taper', rho: .8 + r() * .25 }); lineRows.push({ x, pts }); }
        y0 = -1; }
    }
  }

  // 5. scallops strung down the outer side, the panel's edge first and then the staff, nearly touching so they read as
  // a border (rhythm regular, the hand not); now and then down the staff an eye hung on a short stalk. Then the
  // bay's edges: scallops on the last hairline each side, facing into the bay, above and below its eye.
  // side +1: the left of the line's travel as seen on the page (west of a line going down, below one going right)
  const chain = (line, keepY, side, { eyes = 0, runs = null, hooks = B.hooks, onStaff = false } = {}) => { const P = resample(line, 1), gate = noise1(seed ^ (line.length * 31));
    for (let i = 0, next = Math.round(g * 1.5); i < P.length - g * 4; i++) {
      if (i < next || !keepY(P[i])) continue; next = i + g * (2.25 + r() * .35);
      if (runs != null && gate(i / (g * 9)) < runs) continue;   // down the staff they come in runs, with bare stretches between
      const p = P[i], t = tangentAt(P, i), n = [-t[1] * side, t[0] * side], sr = g * (.82 + r() * .2), c = [p[0] + n[0] * sr * .45, p[1] + n[1] * sr * .45], a0 = Math.atan2(n[1], n[0]), pts = [];
      for (let q = 0; q <= 14; q++) { const b = a0 - 2.1 + q / 14 * 4.2; pts.push([c[0] + Math.cos(b) * sr, c[1] + Math.sin(b) * sr]); }
      if (eyes && (!onStaff || p[1] > py1 + g * 6) && r() < eyes) { const R = g * (onStaff ? 1.3 : 1), L = g * 1.3, ec = [p[0] + n[0] * (L + R), p[1] + n[1] * (L + R)];
        if (room(ring(ec, R * 1.7, r), g * .6)) { accept([p, [p[0] + n[0] * L, p[1] + n[1] * L]], 'stalk', { w: .45, start: 'cut', end: 'cut' }); eye(ec, R); next = i + g * 6; continue; } }
      // on a richer page some of the scallops are hooks instead, curling off with a dropped bead
      if (hooks && r() < hooks) { const hk = hook(p, Math.atan2(n[1], n[0]) + (r() < .5 ? .5 : -.5), g * (.85 + r() * .25), r() < .5 ? 1 : -1);
        if (room(hk.slice(4), g * .55)) { accept(hk, 'hook', { w: .46, start: 'cut', end: 'ball' }); out.push({ kind: 'dot', p: hk.at(-1), r: 1.1 + r() * .35, accent: !!B.accent && r() < B.accent }); next = i + g * 3; continue; } }
      if (room(pts.slice(3, -3), g * .5)) { accept(pts, 'scallop', { w: .5, start: 'cut', end: 'cut' }); if (B.accent && r() < B.accent * .35) out.push({ kind: 'dot', p: [c[0] + n[0] * sr * .2, c[1] + n[1] * sr * .2], r: .75, accent: true }); }
    } };
  if (B.panelScallops) chain(staff1, p => p[1] < py1 + g * 2.5, 1, { eyes: B.contourEyes * .5 });
  for (const line of lines.slice(1)) chain(line, () => true, 1, { eyes: staff ? B.staffEyes : 0, runs: B.runs, onStaff: true });
  // a text-side panel: the hairlines past the letter's right edge get scallops on their outer side
  if (B.textPanel) { const edge = lineRows.filter(l => l.x > box[2]).sort((u, v) => v.x - u.x)[0]; if (edge) chain(edge.pts, () => true, -1, { hooks: 0 }); }
  if (bay) for (const [pick, side] of [[l => l.x < bay[0], -1], [l => l.x > bay[1], 1]]) {
    const cand = lineRows.filter(l => pick(l) && l.pts[0][1] < bay.eye[1] && l.pts.at(-1)[1] > bay.eye[1]);
    const edge = cand.sort((u, v) => side < 0 ? v.x - u.x : u.x - v.x)[0]; if (edge) chain(edge.pts, () => true, side); }
  for (const tl of topLines) chain(tl, () => true, -1, { eyes: B.contourEyes });
  // the panel's foot: a hairline under it from the staff to the letter, scallops hanging below
  if (cap && B.base) { const by = py1 + g * .9, x1 = Math.min(px1, box[0] - g * .5), base = wander([[sx + g * .4, by], [x1, by + (r() - .5) * .6]], .2, seed + 13, 30);
    if (room(base.slice(2), g * .45)) { accept(base, 'base', { w: .48, start: 'cut', end: 'ball' }); chain(base, () => true, 1); } }
  return out;
}
