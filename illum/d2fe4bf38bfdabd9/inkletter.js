// A letter laid and written by the ink engine (kit/medium.js): a typeface capital (or any letter given as its coverage)
// poured into the medium as one deposit, so its edge carries the ink's feathering and its rim the ink's pooling, as the
// pen's strokes round it do; and the same letter written as you watch, along its skeleton. Any typeface initial uses
// it (kit/illum.js lays a style's letter with it: { M, w, h, x0, y0, res, red? }, the red first, the black over it).
//   inkLetter(bake, L, rgb, { dpr })                    laid at once (flat in its colour if the engine is unavailable)
//   letterWriter(bake, L, { k, r }, { dpr, host, below })  written: .at(f) f 0..1, .done(); the black, then the red beneath
//   sweepIn(bake, mask, rgb, { dpr })                   a stencil's colour laid in beneath the page's ink as you watch
//   warmInk(dpr)                                        the shared medium made ahead (its shaders compiled)
//   dist(feat, w, h, nearest?)                          the distance transform the letter is read with
// (Moved from kit/styles/blackletter.js unchanged, so the approved letter is the same to the pixel.)
import { createMedium } from './medium.js';
import { supported } from './writer.js';
import { noise2, fnv } from './marks.js';

// Distance (cells) from every cell to the nearest cell where feat is set: two sweeps carrying the offset to the nearest
// set cell (8SSEDT, Danielsson 1980; exact but for rare configurations, a fraction of a cell off)
export function dist(feat, w, h, nearest = null) {
  const n = w * h, X = new Int16Array(n), Y = new Int16Array(n), D = new Int32Array(n);
  for (let q = 0; q < n; q++) if (!feat[q]) { X[q] = 4000; D[q] = 16e6; }
  let x = 0, y = 0, d = 0, o = 0;
  // (the neighbour checks written out: this runs before the engine has optimised anything, on the page's first letter)
  for (let j = 0; j < h; j++) { const r = j * w;
    for (let i = 0; i < w; i++) { const q = r + i; if (!D[q]) continue;
      if (i > 0) { o = q - 1; x = X[o] + 1; y = Y[o]; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } }
      if (j > 0) { o = q - w; x = X[o]; y = Y[o] + 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; }
        if (i > 0) { o = q - w - 1; x = X[o] + 1; y = Y[o] + 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } }
        if (i < w - 1) { o = q - w + 1; x = X[o] - 1; y = Y[o] + 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } } } }
    for (let i = w - 2; i >= 0; i--) { const q = r + i; if (!D[q]) continue; o = q + 1; x = X[o] - 1; y = Y[o]; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } } }
  for (let j = h - 1; j >= 0; j--) { const r = j * w;
    for (let i = w - 1; i >= 0; i--) { const q = r + i; if (!D[q]) continue;
      if (i < w - 1) { o = q + 1; x = X[o] - 1; y = Y[o]; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } }
      if (j < h - 1) { o = q + w; x = X[o]; y = Y[o] - 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; }
        if (i < w - 1) { o = q + w + 1; x = X[o] - 1; y = Y[o] - 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } }
        if (i > 0) { o = q + w - 1; x = X[o] + 1; y = Y[o] - 1; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } } } }
    for (let i = 1; i < w; i++) { const q = r + i; if (!D[q]) continue; o = q - 1; x = X[o] + 1; y = Y[o]; d = x * x + y * y; if (d < D[q]) { X[q] = x; Y[q] = y; D[q] = d; } } }
  if (nearest) for (let q = 0; q < n; q++) nearest[q] = q - Y[q] * w - X[q];   // (the offset runs from the feature to the cell)
  const out = new Float32Array(n); for (let q = 0; q < n; q++) out[q] = Math.sqrt(D[q]); return out;
}

// ---- laying the letter with the ink engine -----------------------------------------------------------------------------
// The glyph's coverage poured into the medium (kit/medium.js) as one deposit, in one pass: the coverage, a little more
// ink near its rim (the pooling of a broad stroke's borders) with a slow mottle, and a little dryness at the rim, are
// drawn straight into the medium's stroke layer (as the nib's sweep would have laid them, MAX-blended); then the medium
// levels it, lets it creep into the paper's fibre at the edge, and dries it. The result is pressed into `bake` (a 2D
// context in page px at dpr) as the writer presses its windows. One medium serves every letter on the page.
let shared = null;
function mediumFor(w, h, dpr) {
  if (shared && shared.cv.width >= w && shared.cv.height >= h && shared.dpr === dpr && !shared.gl.isContextLost()) return shared;
  // (made again, as large as needed, when a larger letter comes: sized any other way, the sheet's arithmetic moves a few of
  // its pixels by a level or two, so the approved letters keep exactly this sequence of sizes; the context and its
  // compiled programs are kept, only the sheet is made anew)
  if (shared && shared.dpr === dpr && !shared.gl.isContextLost()) { shared.Md.resize(Math.max(w, 640), Math.max(h, 640)); shared.Md.settings.over = true; return shared; }
  shared?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  const cv = document.createElement('canvas'); cv.width = Math.max(w, 640); cv.height = Math.max(h, 640);
  const Md = createMedium(cv, { dpr, paper: [255, 255, 255] }), gl = Md.gl; Md.settings.over = true;
  return shared = { cv, Md, gl, dpr };
}
// make the shared medium now (loadFace does, while the font is on its way)
export function warmInk(dpr = Math.min(2, globalThis.devicePixelRatio || 1)) { if (!supported()) return; try { mediumFor(1, 1, dpr); } catch {} }
// If the ink engine is unavailable or fails (no WebGL2, a lost context), the letter is still laid, flat in its colour:
// a drop cap must never come out blank.
export function inkLetter(bake, L, rgb, opts = {}) {
  if (!supported()) return flatLetter(bake, L, rgb);
  try { inkLetterMedium(bake, L, rgb, opts); }
  catch (e) { console.warn('illum: ink engine unavailable, the letter is laid flat', e); flatLetter(bake, L, rgb); }
}
function flatLetter(bake, { M, w, h, x0, y0, res }, rgb) {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { im.data[i * 4] = rgb[0]; im.data[i * 4 + 1] = rgb[1]; im.data[i * 4 + 2] = rgb[2]; im.data[i * 4 + 3] = Math.round(Math.min(1, M[i]) * 255); }
  g.putImageData(im, 0, 0); bake.drawImage(c, x0, y0, w / res, h / res);
}
// the deposit, per cell: coverage; ink (halved, to fit a byte), a little more near the rim with a slow mottle; dryness
function deposit(L, dry) {
  const { M, w, h, res } = L, Bl = boxBlur(boxBlur(M, w, h, Math.round(1.6 * res)), w, h, Math.round(1.6 * res)), mot = noise2(97), D = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = j * w + i, m = M[q]; if (m <= .01) continue;
    const rim = Math.max(0, 1 - Bl[q]) * 1.6, ink = 1 + .38 * rim * rim + .14 * (mot((L.x0 + i / res) / 9, (L.y0 + j / res) / 9) - .5);
    D[q * 4] = Math.round(Math.min(1, m) * 255); D[q * 4 + 1] = Math.round(Math.min(1, ink / 2) * 255); D[q * 4 + 2] = Math.round(Math.min(1, dry * rim * rim) * 255); }
  return D;
}
// where the letter's medium window sits: its page origin (px) and size (device px)
const windowOf = (L, dpr, pad = 5) => { const ox = Math.floor(L.x0 * dpr) / dpr - pad, oy = Math.floor(L.y0 * dpr) / dpr - pad;
  return { ox, oy, cw: Math.ceil((L.w / L.res + pad * 2) * dpr), ch: Math.ceil((L.h / L.res + pad * 2) * dpr), rect: [pad * dpr + (L.x0 - Math.floor(L.x0 * dpr) / dpr) * dpr, pad * dpr + (L.y0 - Math.floor(L.y0 * dpr) / dpr) * dpr, L.w / L.res * dpr, L.h / L.res * dpr] }; };
function inkLetterMedium(bake, L, rgb, { dpr = 2, wet = L.wet ?? .1, dry = L.dry ?? .22 } = {}) {
  active?.done();   // a letter being written is finished first: they share the medium
  const { ox, oy, cw, ch, rect } = windowOf(L, dpr), { cv, Md } = mediumFor(cw, ch, dpr);
  Md.clear(); Md.wetness(wet); Md.settings.ink = rgb; Md.makePaper([ox * dpr, oy * dpr], [0, 0, cw, ch]);   // (paper and render: only the window)
  Md.pour(deposit(L, dry), L.w, L.h, rect);
  for (let k = 0; k < 24; k++) Md.step(16);
  Md.finish(); Md.render([0, 0, cw, ch]);
  bake.save(); bake.setTransform(1, 0, 0, 1, 0, 0); bake.globalCompositeOperation = 'source-over'; bake.drawImage(cv, 0, 0, cw, ch, Math.round(ox * dpr), Math.round(oy * dpr), cw, ch); bake.restore();
}

// ---- writing the letter --------------------------------------------------------------------------------------------------
// The order a hand writes the letter in. Its skeleton (Zhang & Suen's thinning, 1984, at one cell a px) is walked as a pen
// would: from its top left, on along the way it is going (the least turn at a fork), and where a stroke ends the pen is
// lifted back to the last fork it left unfinished. Each cell of the letter takes the time of the nearest point of the
// skeleton, so the ink arrives along the strokes, square across them, as under a nib. T: 0..1 per cell; order: the ink
// cells sorted by it.
export function letterOrder(L) {
  if (L.order) return L.order;
  const { M, w, h, res } = L, k = Math.max(1, Math.round(res)), sw = Math.ceil(w / k) + 2, sh = Math.ceil(h / k) + 2, B = new Uint8Array(sw * sh);
  const R = L.red, inkAt = q => R ? Math.max(M[q], R[q]) : M[q];   // the whole letter, black and red: its strokes, not the halves of the split
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inkAt(j * w + i) > .5) B[(Math.floor(j / k) + 1) * sw + Math.floor(i / k) + 1]++;
  for (let q = 0; q < B.length; q++) B[q] = B[q] * 2 >= k * k ? 1 : 0;
  for (let changed = true; changed;) { changed = false;
    for (const pass of [0, 1]) { const del = [];
      for (let j = 1; j < sh - 1; j++) for (let i = 1; i < sw - 1; i++) { const q = j * sw + i; if (!B[q]) continue;
        const P = [B[q - sw], B[q - sw + 1], B[q + 1], B[q + sw + 1], B[q + sw], B[q + sw - 1], B[q - 1], B[q - sw - 1]], n = P.reduce((a, v) => a + v, 0);
        if (n < 2 || n > 6) continue; let a = 0; for (let t = 0; t < 8; t++) a += !P[t] && P[(t + 1) % 8];
        if (a !== 1) continue;
        if (pass ? P[0] * P[2] * P[6] || P[0] * P[4] * P[6] : P[0] * P[2] * P[4] || P[2] * P[4] * P[6]) continue;
        del.push(q); }
      for (const q of del) B[q] = 0; if (del.length) changed = true; } }
  // the walk
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], Ts = new Float32Array(sw * sh).fill(-1), lift = 6;
  const nbs = q => N8.map(([dx, dy]) => q + dy * sw + dx).filter(o => B[o] && Ts[o] < 0);
  // a branch from o (leaving cur) that ends within a few cells, without forking: its cells, else null
  const spur = (o, from) => { const seen = [o]; let prev = from, at = o;
    for (let n = 0; n < 6; n++) { const nx = N8.map(([dx, dy]) => at + dy * sw + dx).filter(x => B[x] && x !== prev && !seen.includes(x) && Ts[x] < 0);
      if (!nx.length) return seen; if (nx.length > 1) return null; prev = at; at = nx[0]; seen.push(at); }
    return null; };
  let s = 0;
  for (;;) { let start = -1, best = Infinity;   // a new stroke: the top-left-most end of what is left (a cell with one neighbour), else any
    for (let q = 0; q < B.length; q++) if (B[q] && Ts[q] < 0) { const i = q % sw, j = q / sw | 0, ends = N8.filter(([dx, dy]) => B[q + dy * sw + dx]).length <= 1, v = i + j * 1.3 - (ends ? 1e4 : 0); if (v < best) { best = v; start = q; } }
    if (start < 0) break; if (s) s += lift;
    let cur = start, d = null; const forks = []; Ts[cur] = s;
    for (;;) { const c = nbs(cur);
      if (!c.length) { let back = -1; while (forks.length) { const f = forks.pop(); if (nbs(f).length) { back = f; break; } } if (back < 0) break; s += lift; cur = back; d = null; continue; }
      // on along the way it is going, and down where it may (the stem before the bowls)
      const dir = o => [(o % sw) - (cur % sw), (o / sw | 0) - (cur / sw | 0)];
      const pick = c.reduce((a, o) => { const v = dir(o), l = Math.hypot(...v), sc = (d ? -(v[0] * d[0] + v[1] * d[1]) / l : 0) - .8 * v[1] / l; return !a || sc < a.sc ? { o, sc } : a; }, null).o;
      // the cells beside the one taken are the same stroke (a thinned line's stair); a short spur off it is part of it too
      for (const o of c) if (o !== pick) { const dx = Math.abs((o % sw) - (pick % sw)), dy = Math.abs((o / sw | 0) - (pick / sw | 0));
        if (dx <= 1 && dy <= 1) Ts[o] = s; else { const sp = spur(o, cur); if (sp) for (const x of sp) Ts[x] = s; } }
      if (nbs(cur).length) forks.push(cur);
      const v = dir(pick), l = Math.hypot(...v); s += l; d = [v[0] / l, v[1] / l]; cur = pick; Ts[cur] = s; } }
  // each cell the time of its nearest skeleton cell
  const feat = new Uint8Array(w * h), map = new Int32Array(w * h).fill(-1);
  for (let q = 0; q < B.length; q++) if (B[q]) { const i = Math.min(w - 1, ((q % sw) - 1) * k + (k >> 1)), j = Math.min(h - 1, (((q / sw) | 0) - 1) * k + (k >> 1)); if (i >= 0 && j >= 0) { feat[j * w + i] = 1; map[j * w + i] = q; } }
  // nearest along the ink, not across the paper (a stroke's tip must not take the time of the stroke beside it): every
  // skeleton cell floods the ink at once, a cell belongs to whichever reaches it first (Dijkstra by buckets, steps 10, 14)
  const own = new Int32Array(w * h).fill(-1), cost = new Int32Array(w * h).fill(1 << 30), Q = [];
  const push = (q, c, f) => { if (c >= cost[q]) return; cost[q] = c; own[q] = f; (Q[c] ??= []).push(q); };
  for (let q = 0; q < w * h; q++) if (feat[q]) push(q, 0, map[q]);
  const step = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
  for (let c = 0; c < Q.length; c++) { const b = Q[c]; if (!b) continue; Q[c] = null;
    for (const q of b) { if (cost[q] !== c) continue; const i = q % w, j = q / w | 0;
      for (const [dx, dy, sc] of step) { const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue; const o = y * w + x; if (inkAt(o) > .01) push(o, c + sc, own[q]); } } }
  const near = new Int32Array(w * h); dist(feat, w, h, near);   // (what the flood cannot reach, a fleck apart: the nearest across the paper)
  const T = new Float32Array(w * h), total = Math.max(1, s), ink = [];
  for (let q = 0; q < w * h; q++) { if (inkAt(q) <= .01) continue; const f = own[q] >= 0 ? own[q] : map[near[q]]; T[q] = f >= 0 ? Math.max(0, Ts[f]) / total : 1; if (M[q] > .01) ink.push(q); }
  ink.sort((a, b) => T[a] - T[b]);
  return L.order = { T, order: Int32Array.from(ink) };
}

// A letter written as you watch: the black poured into the medium along the order, slice by slice into the same wet ink
// (so it merges with no seam), the medium's window shown live over the page; then the red, poured beneath it (the window
// slipped under the page's ink layer while it flows, then laid under the black with destination-over). at(f) f in 0..1
// of the whole; done() finishes at once.
let active = null;
export function letterWriter(bake, L, { k, r }, { dpr = 2, host, below, wet = L.wet ?? .1, dry = L.dry ?? .22, split = .72 } = {}) {
  if (!supported()) { let fin = false; const lay = () => { if (fin) return; fin = true; if (L.red) flatLetter(bake, { ...L, M: L.red }, r); flatLetter(bake, L, k); };   // (laid flat, at once)
    return { at() {}, done: lay }; }
  const { order } = letterOrder(L), n = order.length, phases = [{ M: L.M, rgb: k, f0: 0, f1: L.red ? split : 1, op: 'source-over' }];
  if (L.red) { const T = letterOrder(L).T, red = []; for (let q = 0; q < L.w * L.h; q++) if (L.red[q] > .01) red.push(q); red.sort((a, b) => T[a] - T[b]);
    phases.push({ M: L.red, rgb: r, f0: split, f1: 1, op: 'destination-over', order: Int32Array.from(red) }); }
  phases[0].order = order;
  const { ox, oy, cw, ch, rect } = windowOf(L, dpr); let ph = -1, at = 0, D = null, F = null, last = 0, cv = null, Md = null;
  const open = i => { const P = phases[i]; ({ cv, Md } = mediumFor(cw, ch, dpr)); Md.clear(); Md.wetness(wet); Md.settings.ink = P.rgb; Md.makePaper([ox * dpr, oy * dpr]);
    D = deposit({ ...L, M: P.M }, dry); F = new Uint8Array(D.length); at = 0; last = performance.now(); ph = i;
    Object.assign(cv.style, { position: 'absolute', left: ox + 'px', top: oy + 'px', width: cv.width / dpr + 'px', height: cv.height / dpr + 'px', pointerEvents: 'none' }); cv.setAttribute('aria-hidden', 'true');
    // the black over the page; the red under the page's ink layer, so it flows in beneath the black
    if (P.op === 'destination-over' && below) below.before(cv); else host.append(cv); };
  const pourTo = u => { const P = phases[ph], o = P.order, upto = Math.min(o.length, Math.ceil(u * o.length)); if (upto <= at) return false;
    for (let x = at; x < upto; x++) { const q = o[x] * 4; F[q] = D[q]; F[q + 1] = D[q + 1]; F[q + 2] = D[q + 2]; }
    Md.pour(F, L.w, L.h, rect); for (let x = at; x < upto; x++) { const q = o[x] * 4; F[q] = F[q + 1] = F[q + 2] = 0; } at = upto; return true; };
  const close = () => { const P = phases[ph]; pourTo(1); for (let i = 0; i < 24; i++) Md.step(16); Md.finish(); Md.render();
    bake.save(); bake.setTransform(1, 0, 0, 1, 0, 0); bake.globalCompositeOperation = P.op; bake.drawImage(cv, 0, 0, cw, ch, Math.round(ox * dpr), Math.round(oy * dpr), cw, ch); bake.restore();
    cv.remove(); Md.clear(); };
  // the front moves at a hand's pace through each phase: a little slower at the start and the end
  const ease = u => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI) * .35;
  const self = {
    at(f) { if (ph >= phases.length) return; if (active && active !== self) active.done(); active = self;
      for (;;) { if (ph < 0) open(0); const P = phases[ph]; if (f < P.f1 || ph === phases.length - 1) break; close(); if (ph + 1 < phases.length) open(ph + 1); else { ph = phases.length; break; } }
      if (ph >= phases.length) return; const P = phases[ph], u = Math.max(0, Math.min(1, (f - P.f0) / (P.f1 - P.f0)));
      pourTo(ease(u)); const now = performance.now(); Md.step(Math.min(50, Math.max(1, now - last))); last = now; Md.render(); },
    done() { if (ph >= phases.length) return; if (active && active !== self) active.done(); active = self;
      if (ph < 0) open(0); for (;;) { close(); if (ph + 1 < phases.length) open(ph + 1); else break; } ph = phases.length; if (active === self) active = null; } };
  return self;
}

// A box blur, r cells each way, the edge cell repeated (running sums along the rows, then down the columns). Only what the
// content reaches is run: in each row, from where the window meets ink to where its sum is back to exactly zero with no
// ink ahead; down the columns, a row at a time, only the columns whose sums are live or take ink in or out. All that is
// skipped is exactly zero in a full run too (a running sum of zeros), so the result is the same to the bit; a mask with
// a little ink in a large box (a piece's one colour, a thin whip across it) costs only that little. The result carries
// where it can be non-zero, O.reach [x0, y0, x1, y1) (outside it, exactly zero), for a caller's loops over it.
export function boxBlur(A, w, h, r) {
  if (r < 1) return A; const T = new Float32Array(w * h), O = new Float32Array(w * h), k = 2 * r + 1;
  // each row's ink [c0, c1] (none: c1 < 0), and how far its sum ran (e: past it, the row's blur is empty)
  const c0 = new Int32Array(h), c1 = new Int32Array(h).fill(-1), e = new Int32Array(h); let r0 = h, r1 = -1;
  for (let y = 0; y < h; y++) { const o = y * w; let a = 0; while (a < w && A[o + a] === 0) a++; if (a === w) continue;
    let b = w - 1; while (A[o + b] === 0) b--; c0[y] = a; c1[y] = b; if (y < r0) r0 = y; r1 = y; }
  O.reach = [0, 0, 0, 0]; if (r1 < 0) return O;
  for (let y = r0; y <= r1; y++) { if (c1[y] < 0) continue; const o = y * w; let s = 0, x = c0[y] > r + 1 ? c0[y] - r - 1 : 0;
    if (!x) for (let i = -r; i <= r; i++) s += A[o + Math.min(w - 1, Math.max(0, i))];
    for (; x < w; x++) { T[o + x] = s / k; s += A[o + Math.min(w - 1, x + r + 1)] - A[o + Math.max(0, x - r)];
      // (an empty window: on to where the next ink comes into it; none, the rest of the row is empty)
      if (s === 0) { let n = Math.max(0, x + 1 - r); while (n < w && A[o + n] === 0) n++; if (n === w) break; if (n - r - 2 > x) x = n - r - 2; } }
    e[y] = Math.min(w - 1, x); }
  // down the columns: their running sums side by side, a row at a time (the same sums in the same order, read along the rows)
  const S = new Float64Array(w), R = O.reach = [w, h, 0, 0]; let s0 = w, s1 = -1, y = r0 > r + 1 ? r0 - r - 1 : 0;
  const span = (yy, f) => { if (c1[yy] >= 0) f(Math.max(0, c0[yy] - r), e[yy]); };
  if (!y) for (let i = -r; i <= r; i++) { const yy = Math.min(h - 1, Math.max(0, i)), o = yy * w;
    span(yy, (a, b) => { for (let x = a; x <= b; x++) S[x] += T[o + x]; s0 = Math.min(s0, a); s1 = Math.max(s1, b); }); }
  for (; y < h; y++) { const ya = Math.min(h - 1, y + r + 1), yb = Math.max(0, y - r), o = y * w, a = ya * w, b = yb * w; let x0 = s0, x1 = s1;
    span(ya, (p, q) => { x0 = Math.min(x0, p); x1 = Math.max(x1, q); }); span(yb, (p, q) => { x0 = Math.min(x0, p); x1 = Math.max(x1, q); });
    s0 = w; s1 = -1; if (x0 <= x1) { R[0] = Math.min(R[0], x0); R[1] = Math.min(R[1], y); R[2] = Math.max(R[2], x1 + 1); R[3] = y + 1; }
    for (let x = x0; x <= x1; x++) { O[o + x] = S[x] / k; if ((S[x] += T[a + x] - T[b + x]) !== 0) { if (x < s0) s0 = x; s1 = x; } }
    if (s1 < 0 && y + 1 - r > r1) break; }
  return O;
}

// ---- a stencil swept in -------------------------------------------------------------------------------------------------------
// A mask poured as a colour (a stencil: { M, w, h, x0, y0, res, col, wet?, dry? }) laid in as you watch: poured once into a
// scratch layer of the page's size there, then laid on the page beneath what is there (destination-over; a print's own
// solid black, col 'k', over it) as a stencil brush sweeps across its longer side, a dab at a time, each cell once.
// (Moved from tests/tarot.html unchanged.) .at(f) f 0..1, .done()
// (a window laid over the page after those already there, so a piece's later inks show over its earlier ones as they will
// when laid)
const stack = (el, ov) => { let at = el; while (at.nextSibling?.dataset?.grow) at = at.nextSibling; ov.dataset.grow = '1'; at.after(ov); };
export function sweepIn(bake, p, rgb, { dpr = 2 } = {}) {
  let sc = null, T = null, order = null, at = 0, tmp = null, X0 = 0, Y0 = 0, TT = null, CL = null, ov = null, fin = false, gk = null, solid = null, faceOf = null;
  const open = () => { const pad = 8; X0 = Math.floor((p.x0 - pad) * dpr); Y0 = Math.floor((p.y0 - pad) * dpr); const w = Math.ceil((p.w / p.res + 2 * pad) * dpr), h = Math.ceil((p.h / p.res + 2 * pad) * dpr);
    const cv = new OffscreenCanvas(w, h), g = cv.getContext('2d', { willReadFrequently: true });
    const proxy = { save() {}, restore() {}, setTransform() {}, set globalCompositeOperation(v) {},
      drawImage(c, ...a) { if (a.length === 8) g.drawImage(c, a[0], a[1], a[2], a[3], a[4] - X0, a[5] - Y0, a[6], a[7]); else g.drawImage(c, a[0] * dpr - X0, a[1] * dpr - Y0, a[2] * dpr, a[3] * dpr); } };
    if (p.paint) p.paint(proxy, { dpr }); else inkLetter(proxy, p, rgb, { dpr });   // (p.paint: a pour that lays itself)
    sc = g.getImageData(0, 0, w, h); tmp = new OffscreenCanvas(w, h);
    // (p.grow: the piece printed whole beneath, and its garden grown over it frame by frame: p.grow.fn(ctx, f, mode) draws in
    // page px what has not grown ('cover', in the ink, over a block) or what has ('reveal', the mask an ink piece is seen through))
    if (p.grow) { T = { w, h }; tmp.getContext('2d').putImageData(sc, 0, 0); gk = new OffscreenCanvas(w, h); const el = bake.canvas;
      // (what is not yet grown is covered with the block's own ink: the face, its holes filled, printed the same way, so the
      // cover has the impression's grain and is not a flat patch on it)
      // (the holes filled with the ink round them: a normalized blur of the print, so the cover carries the print's own tone
      // and pooling and does not show as a patch; held to the block's face, so it never reaches past the block)
      if (p.grow.face) faceOf = () => { if (solid || fin) return; const n = w * h, d = sc.data, A = new Float32Array(n), C = [0, 1, 2].map(() => new Float32Array(n));
        for (let q = 0; q < n; q++) { const a = d[q * 4 + 3] / 255; A[q] = a; for (let k = 0; k < 3; k++) C[k][q] = d[q * 4 + k] * a; }
        const r = Math.max(2, Math.round(3 * dpr)), Ab = boxBlur(boxBlur(A, w, h, r), w, h, r), Cb = C.map(c => boxBlur(boxBlur(c, w, h, r), w, h, r)), F = p.grow.face, fw = p.w, fr = p.res;
        const im = new ImageData(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = j * w + i, a = Ab[q]; if (a < 1e-3) continue;
          const fx = Math.floor(((i + X0) / dpr - p.x0) * fr), fy = Math.floor(((j + Y0) / dpr - p.y0) * fr), fv = fx >= 0 && fy >= 0 && fx < fw && fy < p.h ? F[fy * fw + fx] : 0; if (fv <= 0) continue;
          for (let k = 0; k < 3; k++) im.data[q * 4 + k] = Cb[k][q] / a; im.data[q * 4 + 3] = Math.round(255 * Math.min(1, fv)); }
        solid = new OffscreenCanvas(w, h); solid.getContext('2d').putImageData(im, 0, 0); };   // (made in an idle moment of its own)
      if (el?.parentNode) { ov = document.createElement('canvas'); ov.width = w; ov.height = h; ov.setAttribute('aria-hidden', 'true');
        Object.assign(ov.style, { position: 'absolute', left: el.offsetLeft + X0 / dpr + 'px', top: el.offsetTop + Y0 / dpr + 'px', width: w / dpr + 'px', height: h / dpr + 'px', pointerEvents: 'none' }); stack(el, ov); }
      return; }
    // the brush's way: across the stencil's longer side, in dabs (a cell's time: how far along, and a dab's jitter)
    // (p.press: a printed block's impression, not a stencil brush: the ink comes up as the platen rolls across it, along
    // p.press.ang, grain first, a fine paper-scale mottle deciding which cells take the ink a moment early or late)
    const pr = p.press, ang = pr ? pr.ang ?? 0 : (fnv(p.x0 + ':' + p.y0) % 628) / 100, dx = Math.cos(ang), dy = Math.sin(ang), cells = [], t = [], gn = pr ? noise2(fnv(p.x0 + ':' + p.y0) % 9973) : null;
    let lo = Infinity, hi = -Infinity; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = sc.data[(j * w + i) * 4 + 3]; if (!a) continue; const v = i * dx + j * dy; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const span = Math.max(1, hi - lo), dab = pr ? 1 : 3.2 * dpr, jw = pr ? (pr.grain ??= .2) : .18; if (pr) pr.roll ??= .5;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!sc.data[(j * w + i) * 4 + 3]) continue; const v = (i * dx + j * dy - lo) / span, jit = ((Math.sin(Math.floor(i / dab) * 12.9898 + Math.floor(j / dab) * 78.233) * 43758.5453) % 1 + 1) % 1;
      cells.push(j * w + i); t.push(pr ? v * pr.roll + (gn(i / (5 * dpr), j / (5 * dpr)) * .6 + gn(i / (1.4 * dpr) + 50, j / (1.4 * dpr)) * .4) * jw : v * (1 - jw) + jit * jw); }
    order = Int32Array.from(cells.map((c, k) => k).sort((a, b) => t[a] - t[b]).map(k => cells[k])); T = { w, h };
    if (pr) { TT = Float32Array.from(t); CL = Int32Array.from(cells); const el = bake.canvas;   // (the impression shown in a window of its own over the page, laid when it is done)
      if (el?.parentNode) { ov = document.createElement('canvas'); ov.width = w; ov.height = h; ov.setAttribute('aria-hidden', 'true');
        Object.assign(ov.style, { position: 'absolute', left: el.offsetLeft + X0 / dpr + 'px', top: el.offsetTop + Y0 / dpr + 'px', width: w / dpr + 'px', height: h / dpr + 'px', pointerEvents: 'none' }); stack(el, ov); } } };
  // the impression: each cell's ink comes up over a short while about its moment (smoothstep), so the block darkens evenly
  // from the paper, in soft clouds of the grain, behind the roll's front; then laid once into the page, exactly as a still
  const SOFT = .36, press = f => { if (fin) return; if (!sc) open(); if (!ov) return; const { w, h } = T, im = new ImageData(w, h), F = Math.min(1, f) * (p.press.roll + p.press.grain + SOFT);
    for (let k = 0; k < CL.length; k++) { let a = (F - TT[k]) / SOFT; if (a <= 0) continue; if (a > 1) a = 1; a = a * a * (3 - 2 * a); const q = CL[k] * 4;
      im.data[q] = sc.data[q]; im.data[q + 1] = sc.data[q + 1]; im.data[q + 2] = sc.data[q + 2]; im.data[q + 3] = sc.data[q + 3] * a; }
    ov.getContext('2d').putImageData(im, 0, 0); };
  const pressDone = () => { if (fin) return; if (!sc) open(); fin = true; tmp.getContext('2d').putImageData(sc, 0, 0);
    bake.save(); bake.setTransform(1, 0, 0, 1, 0, 0); bake.globalCompositeOperation = 'source-over'; bake.drawImage(tmp, X0, Y0); bake.restore(); ov?.remove(); ov = null; };
  if (p.press) return { at: press, done: pressDone };
  // the growth: the block (and its letter) laid in a moment (APP of the run), then the garden over the rest
  const APP = .09, grown = f => { if (fin) return; if (!sc) open(); if (!ov) return; const o = ov.getContext('2d'), k = gk.getContext('2d'), { w, h } = T, cover = p.grow.mode === 'cover';
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, w, h); k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, w, h);
    const g = cover ? Math.max(0, (f - APP) / (1 - APP)) : Math.min(1, f);
    k.setTransform(dpr, 0, 0, dpr, -X0, -Y0); p.grow.fn(k, g, p.grow.mode); k.setTransform(1, 0, 0, 1, 0, 0);
    // (the block comes in with a crisp edge, laid from its head down in a moment, as a sheet meets the forme: no fade)
    if (cover) { const a = Math.min(1, f / APP), e = 1 - (1 - a) ** 2; o.save(); o.beginPath(); o.rect(0, 0, w, Math.ceil(h * e)); o.clip(); o.drawImage(tmp, 0, 0);
      k.globalCompositeOperation = 'source-in'; if (solid) k.drawImage(solid, 0, 0); else { k.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; k.fillRect(0, 0, w, h); } o.drawImage(gk, 0, 0); o.restore(); }
    else { o.drawImage(tmp, 0, 0); o.globalCompositeOperation = 'destination-in'; o.drawImage(gk, 0, 0); o.globalCompositeOperation = 'source-over'; } };
  if (p.grow) { try { const idle = globalThis.requestIdleCallback ?? (f => setTimeout(f, 1)); idle(() => { if (!sc && !fin) open(); idle(() => faceOf?.()); }); } catch {}   // (its printing made ahead, in idle time, not in its first frame)
    return { at: grown, done: pressDone }; }
  const self = { at(f) { if (!sc) open(); const upto = Math.min(order.length, Math.ceil(Math.min(1, f) * order.length)); if (upto <= at) return;
      const { w, h } = T, im = new ImageData(w, h);
      for (let x = at; x < upto; x++) { const q = order[x] * 4; im.data[q] = sc.data[q]; im.data[q + 1] = sc.data[q + 1]; im.data[q + 2] = sc.data[q + 2]; im.data[q + 3] = sc.data[q + 3]; }
      tmp.getContext('2d').putImageData(im, 0, 0);
      bake.save(); bake.setTransform(1, 0, 0, 1, 0, 0); bake.globalCompositeOperation = p.col === 'k' || p.press ? 'source-over' : 'destination-over'; bake.drawImage(tmp, X0, Y0); bake.restore(); at = upto; },
    done() { self.at(1); } };
  return self;
}
// a letter being written is finished now (a page drawn again does not leave it half-written over the new drawing)
export const settle = () => active?.done();
