// PIE · B, the rock, stage 2 (research/24-pie.md): red paint laid with a brush on pecked granite. Three surfaces, each from
// its cause, and a brush that lays pigment by them; no texture, no noise layered on top.
//   the granite   a mosaic of crystals (pink and white feldspar, grey quartz, dark mica) at their size relative to the
//                 figure (~.12 of a stroke's width, measured), each grain a facet with its own tilt; the harder quartz
//                 weathered proud, the mica sunk, the grain boundaries opened a little; across it, the ice's
//                 striations, shallow and parallel (by eye)
//   the pecking   the hammer-stone's pits (kit/styles/rock-relief.js `pit` marks), which crush the crystals' faces to
//                 a paler, rougher floor
//   the paint     a brush along the figure's strokes, its load running down along each stroke (reloaded at the next),
//                 its bristles carrying a little more or less in lanes; where it is wet it fills the hollows and pools
//                 in the pits and striations, where it runs dry it catches only the grains' high points
// field(w, h, dpr) from rock-relief.js carries H (the pits); this adds G (the granite), T (the paint's thickness), K
// (pecked), S (the panel: where polished rock shows at all).
import { apply } from './rock-relief.js';

const TAU = Math.PI * 2, clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v, sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (i, j, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
// the granite's minerals (Bohus granite: grey-red, medium grained): fraction, colour (sRGB 0..1), weathered height
const MIN = [[.34, [.8, .67, .61], 0], [.2, [.82, .77, .72], 0], [.32, [.71, .68, .67], .18], [.14, [.55, .5, .48], -.25]];   // (as Tanumshede's rock, warm pinkish grey, L p10/50/90 ~ .8/1/1.2 of the median)
{ const mu = [0, 1, 2].map(k => MIN.reduce((a, m) => a + m[0] * m[1][k], 0)); for (const m of MIN) m[1] = m[1].map((v, k) => mu[k] + (v - mu[k]) * .45); }   // (the photographs' grain is fine and low in contrast: halfway to the mean)

const mineral = (i, j) => { const u = hash(i, j, 3); let m = 0, acc = MIN[0][0]; while (u > acc && m < 3) acc += MIN[++m][0]; return m; };
// the granite under a piece: G (height, CSS px) and C (the crystal's colour index), at device resolution.
// g: the grain size (CSS px); stri: the striations' spacing (CSS px) and angle
export function granite(F, g, { stri = 0, ang = -.32, seed = 1, need = null } = {}) {
  const { cw, ch, dpr } = F, n = cw * ch, G = new Float32Array(n), C = new Uint8Array(n), B = new Uint8Array(n), N = new Uint8Array(n), ca = Math.cos(ang), sa = Math.sin(ang), ox = seed * 101.3, oy = seed * 57.1;
  // the crystals, once each: centre, mineral, facet tilt, height
  const gi0 = Math.floor(ox) - 2, gj0 = Math.floor(oy) - 2, gw = Math.ceil(cw / dpr / g) + 5, gh = Math.ceil(ch / dpr / g) + 5, nc = gw * gh;
  const CX = new Float32Array(nc), CY = new Float32Array(nc), CM = new Uint8Array(nc), TX = new Float32Array(nc), TY = new Float32Array(nc), H0 = new Float32Array(nc);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const I = i + gi0, J = j + gj0, c = j * gw + i, m = mineral(I, J);
    CX[c] = I + .5 + (hash(I, J, 1) - .5) * .9; CY[c] = J + .5 + (hash(I, J, 2) - .5) * .9; CM[c] = m; TX[c] = (hash(I, J, 4) - .5) * .3; TY[c] = (hash(I, J, 5) - .5) * .3; H0[c] = (hash(I, J, 6) - .5) * .25 + MIN[m][2]; }
  // the larger crystals: here and there a feldspar three grains across (porphyritic granite)
  const BG = 3.2, bi0 = Math.floor(ox / BG) - 2, bj0 = Math.floor(oy / BG) - 2, bw = Math.ceil(cw / dpr / g / BG) + 5, bh = Math.ceil(ch / dpr / g / BG) + 5, BX = new Float32Array(bw * bh), BY = new Float32Array(bw * bh), BR = new Float32Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const I = i + bi0, J = j + bj0, c = j * bw + i; BX[c] = (I + .5 + (hash(I, J, 11) - .5) * .6) * BG; BY[c] = (J + .5 + (hash(I, J, 12) - .5) * .6) * BG; BR[c] = hash(I, J, 13) < .16 ? (.8 + .5 * hash(I, J, 14)) : 0; }
  // the outcrop's whaleback: the ice left it in broad swells; water lies in the lows and weathers them darker
  const Wc = cw / dpr, Hc = ch / dpr, sg = .45 * Math.max(Wc, Hc), bumps = [0, 1, 2].map(k => [hash(seed, k, 21) * Wc, hash(seed, k, 22) * Hc, (hash(seed, k, 23) - .3) * 4 * g]), Lo = new Float32Array(n), Wb = new Float32Array(n), EX = bumps.map(([bx]) => Float32Array.from({ length: cw }, (_, X) => Math.exp(-(((X + .5) / dpr - bx) ** 2) / (2 * sg * sg)))), EY = bumps.map(([, by]) => Float32Array.from({ length: ch }, (_, Y) => Math.exp(-(((Y + .5) / dpr - by) ** 2) / (2 * sg * sg))));
  for (let Y = 0; Y < ch; Y++) for (let X = 0; X < cw; X++) {
    const q = Y * cw + X; if (need && !need[q]) continue;
    let wb = 0; for (let k = 0; k < 3; k++) wb += bumps[k][2] * EX[k][X] * EY[k][Y]; Lo[q] = -wb / (4 * g);
    const x = (X + .5) / dpr / g + ox, y = (Y + .5) / dpr / g + oy, i0 = Math.floor(x) - gi0, j0 = Math.floor(y) - gj0;
    let d1 = 9, d2 = 9, b1 = 0, b2 = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const c = j * gw + i, d = (x - CX[c]) ** 2 + (y - CY[c]) ** 2;
      if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = c; } else if (d < d2) { d2 = d; b2 = c; } }
    const gap = Math.sqrt(d2) - Math.sqrt(d1);
    let h = (H0[b1] + TX[b1] * (x - CX[b1]) + TY[b1] * (y - CY[b1])) * g * .35 - .05 * g * Math.exp(-gap / .06);   // the facet; the grain boundary, opened
    if (stri) { const v = ((X + .5) / dpr * -sa + (Y + .5) / dpr * ca) / stri, k = Math.round(v), e = (v - k) * stri;   // a striation every ~stri, not every one cut
      if (hash(k, 7, seed) < .55) h -= .045 * g * Math.exp(-(e * e) / (.04 * g * g + .02)); }
    let mm = CM[b1], mn = CM[b2], bb = .5 * Math.exp(-gap / .12);
    { const I = Math.floor(x / BG) - bi0, J = Math.floor(y / BG) - bj0; for (let j = J - 1; j <= J + 1; j++) for (let i = I - 1; i <= I + 1; i++) { const c = j * bw + i; if (!BR[c]) continue;
      const e = Math.hypot(x - BX[c], (y - BY[c]) * 1.3) - BR[c]; if (e < .15) { const v = clamp01(.5 - e / .3); mn = mm; mm = 0; bb = .5 * (1 - v); h = (h * (1 - v) + v * (.1 + .05 * (x - BX[c])) * g * .35); } } }
    G[q] = h; Wb[q] = wb; C[q] = mm; N[q] = mn; B[q] = bb * 255;
  }
  F.G = G; F.C = C; F.B = B; F.N = N; F.g = g; F.Lo = Lo; F.Wb = Wb; F.T = new Float32Array(n); return F;   // (the whaleback only lights the rock; the brush feels the grains)
}

// ---- the brush ---------------------------------------------------------------------------------------------------------------
// a stroke: a polyline p, its width w (number or per point), a brush load at its start; returns its pixels as
// [index, s (CSS px along), cov, lane] in the order the brush passes them, so ?draw can lay them as it goes
export function strokePixels(F, st, sorted = true) { const { p, w } = st, k = F.dpr, L = [0]; let tot = 0;
  for (let i = 1; i < p.length; i++) L.push(tot += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const W = Math.max(...(Array.isArray(w) ? w : [w])), ww = i => Array.isArray(w) ? w[i] : w, n = F.cw * F.ch;
  const own = F.own ?? (F.own = new Int32Array(n).fill(-1)), pos = F.pos ?? (F.pos = new Int32Array(n)), sid = F.sc = (F.sc ?? 0) + 1;
  const I = [], Sv = [], Cv = [], Ev = [];
  for (let s = 0; s + 1 < p.length; s++) { const [ax, ay] = p[s], [bx, by] = p[s + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, l = Math.sqrt(l2), wa = ww(s), wb = ww(s + 1);
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - W) * k)), x1 = Math.min(F.cw - 1, Math.ceil((Math.max(ax, bx) + W) * k)), y0 = Math.max(0, Math.floor((Math.min(ay, by) - W) * k)), y1 = Math.min(F.ch - 1, Math.ceil((Math.max(ay, by) + W) * k));
    for (let Y = y0; Y <= y1; Y++) { const py = (Y + .5) / k - ay; for (let X = x0; X <= x1; X++) { const px = (X + .5) / k - ax, t = clamp01((px * dx + py * dy) / l2);
      const ex = px - t * dx, ey = py - t * dy, hw = (wa + (wb - wa) * t) / 2, e = (ex * dy - ey * dx) / l, q = Math.abs(e) / hw;
      if (q > 1.15) continue; const i = Y * F.cw + X, cov = 1 - sm(.78, 1.15, q);
      if (own[i] !== sid) { own[i] = sid; pos[i] = I.length; I.push(i); Sv.push(L[s] + t * l); Cv.push(cov); Ev.push(e / hw); }
      else { const j = pos[i]; if (cov > Cv[j]) { Cv[j] = cov; Ev[j] = e / hw; } } } } }
  const order = sorted ? Uint32Array.from(I.keys()).sort((a, b) => Sv[a] - Sv[b]) : null;
  return { I, Sv, Cv, Ev, order, n: I.length, len: tot, w: W };
}
// lay a stroke's pixels with s ≤ upto. The brush: load runs down along the stroke over ~decay; bristle lanes carry
// ±12 %; the first touch puts down more (where the brush was set down it pools). Pigment settles by the surface:
//   film  where the brush passes, caught by the grain's high points as the load runs dry, by everything while wet
//   pool  into the pits and striations (anything below its surroundings), more while wet
// returns the bbox of what it touched
export function lay(F, S, from, upto, { load = 1, decay = 18, inPeck = 1, seed = 1, sid = 0 } = {}) {
  const { G, H, T, K, cw, g } = F, { I, Sv, Cv, Ev, order } = S, pd = .55 * F.rp; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = from;
  for (; n < S.n; n++) { const j = order ? order[n] : n, s = Sv[j]; if (s > upto) break; const i = I[j], cov = Cv[j], e = Ev[j];
    const ld = load * Math.max(.12, Math.exp(-s / (decay * S.w)));
    const lane = Math.floor((e + 1) * 3.5), lf = .94 + .12 * hash(sid, lane, seed);
    const pk = G[i] / (.35 * g), cav = clamp01((-H[i] - .3 * pd) / (.5 * pd)) + clamp01((-G[i] - .03 * g) / (.06 * g)) * .5;   // a peak's height; a hollow's depth (a pit's floor, a striation)
    const catchK = sm(-.08, .08, pk - (.4 - .6 * ld * lf)), pecked = K[i];   // a full brush skips only the lowest grains (~15 %, measured); a dry one only the high points take it
    // the edge is a zone, not a line (stage 7): toward the groove's shoulder (D falling) the film thins and, where the brush
    // was no longer fresh, takes only the high grains, grain by grain, over ~1-2 grains (measured: rock to full red over
    // .07-.2 of a stroke's width, Vitlycke and Tanumshede); where the brush was fresh it pooled against the wall: a crisp,
    // darker rim. The interior's thickness follows the groove's depth.
    const z = F.z ?? 0, Dp = F.D ? F.D[i] : pecked, core = 1 - z + z * sm(.45, .85, Dp), crisp = sm(.8, .95, ld), mw = (1 - core) * (1 - crisp);   // (z: how far the edge zone is open, by how large a grain is on screen)
    // (where the edge falls, grain by grain: a grain at the margin takes paint if it stands high enough for how shallow the
    // groove is there, so the boundary steps from grain to grain instead of running as a line; a fresh brush ignores it)
    const presence = (1 - z) * sm(.15, .6, pecked) + z * (crisp * sm(.2, .3, Dp) + (1 - crisp) * sm(-.04, .04, pk * .8 + 2.4 * (Dp - .3)));
    const film = cov * (.78 + .22 * ld) * lf * (.45 + .55 * core) * (.6 + .4 * catchK) * presence * inPeck * (1 + z * .35 * (cav - .35)) /* (at 4x and up the film a little thicker over the pits' floors, thinner over their rims: never flat; at 1x, not at all) */, pool = cov * (cav * (.03 + .1 * ld) * pecked + (z * .38 * crisp * (1 - Math.abs(2 * Dp - 1)) ** 2 * sm(.12, .3, Dp) + (1 - z) * .32 * (1 - Math.abs(2 * pecked - 1)) ** 2 * sm(.1, .3, pecked)) * ld);
    T[i] = Math.min(2.4, Math.max(T[i], film + pool));
    const X = i % cw, Y = (i / cw) | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
  S.next = n; return x1 >= 0 ? [x0, y0, x1, y1] : null;
}

// ---- the light -----------------------------------------------------------------------------------------------------------------
// look: {panel: rock tone, pecked: the crushed floor, paint: [dry, body, pooled], ground: 'light'|'dark'}
const LV = (() => { const v = [-.52, -.62, .58], l = Math.hypot(...v); return v.map(c => c / l); })();
export function shadeRock(F, look, img, bb = null) {
  const { cw, ch, G, H, T, K, S, C, dpr } = F, o = img.data, px = 1 / dpr, [x0, y0, x1, y1] = bb ?? [0, 0, cw - 1, ch - 1];
  for (let Y = Math.max(1, y0); Y <= Math.min(ch - 2, y1); Y++) for (let X = Math.max(1, x0); X <= Math.min(cw - 2, x1); X++) {
    const i = Y * cw + X, slab = S ? S[i] : 0, pk = K[i], t = T[i], q = i * 4;
    const ab = Math.max(slab, sm(.65, .92, pk) * (F.D && F.z ? 1 - F.z + F.z * sm(.6, .9, F.D[i]) : 1));                       // the rock shows where it is a panel, or inside the pecked figure where the paint skipped (never as a halo round it)
    if (ab <= 0 && t <= 0) { o[q + 3] = 0; continue; }
    const hk = .12 + .88 * (1 - sm(.15, .7, t)), h = (j) => G[j] + F.Wb[j] + H[j] * hk;   // (under a coat of paint the pits' relief softens)
    const gx = (h(i + 1) - h(i - 1)) / (2 * px), gy = (h(i + cw) - h(i - cw)) / (2 * px), l = Math.hypot(gx, gy, 1);
    const ndl = (-gx * LV[0] - gy * LV[1] + LV[2]) / l, lit = .8 + .4 * (ndl - LV[2]);
    // the rock: the crystal's colour; pecked, its faces crushed paler and its contrast lost
    const mc = MIN[C[i]][1], mn = MIN[F.N[i]][1], bl = F.B[i] / 255; let r = mc[0] + (mn[0] - mc[0]) * bl, g = mc[1] + (mn[1] - mc[1]) * bl, b = mc[2] + (mn[2] - mc[2]) * bl;   // (a grain's edge shares its neighbour's colour: crystals meet, they are not cut)
    const pe = sm(.05, .5, pk); r += (look.pecked[0] - r) * .7 * pe; g += (look.pecked[1] - g) * .7 * pe; b += (look.pecked[2] - b) * .7 * pe;
    const wl = 1 - .07 * clamp01(F.Lo[i]); r *= look.tone[0] * lit * wl; g *= look.tone[1] * lit * wl; b *= look.tone[2] * lit * wl;
    if (F.lift && look.paper) { const lf = look.lift * (1 - pe); r += (look.paper[0] - r) * lf; g += (look.paper[1] - g) * lf; b += (look.paper[2] - b) * lf; }
    // the paint: thin film is the dry red, a body of it the fresh red, a pool the dark; its cover by Beer's law, over the
    // rock where there is rock, over nothing (the page) where the brush strayed onto unpecked, unshown ground
    let a = 0, cr = 0, cg = 0, cb = 0, gloss = 0;
    if (t > 0) { const [d, f, p] = look.paint, m1 = sm(.12, .7, t), m2 = sm(1.1, 2.2, t); a = 1 - Math.exp(-3.6 * t);
      // the film has body: its own edge lit on the sunward side and shadowed on the other, a little sheen on its top
      const tx = (T[i + 1] - T[i - 1]) / (2 * px), ty = (T[i + cw] - T[i - cw]) / (2 * px), fe = Math.max(-1, Math.min(1, -(tx * LV[0] + ty * LV[1]) * .35 * F.g));
      const pr = d[0] + (f[0] - d[0]) * m1, pg = d[1] + (f[1] - d[1]) * m1, pb = d[2] + (f[2] - d[2]) * m1, sh = (.7 + .3 * lit) * (1 + .06 * fe);
      // its gloss: the film's own surface (its thickness over the softened rock) catching the light where it faces it
      const fnx = -(gx * .5 + tx * .25 * F.g), fny = -(gy * .5 + ty * .25 * F.g), fl = Math.hypot(fnx, fny, 1), hx = LV[0], hy = LV[1], hz = LV[2] + 1, hl = Math.hypot(hx, hy, hz);
      gloss = .08 * sm(.8, 1.3, t) * Math.max(0, (fnx * hx + fny * hy + hz) / (fl * hl)) ** 60;
      cr = (pr + (p[0] - pr) * m2) * sh + gloss; cg = (pg + (p[1] - pg) * m2) * sh + gloss * .9; cb = (pb + (p[2] - pb) * m2) * sh + gloss * .85; }
    const oa = a + ab * (1 - a);
    o[q] = clamp01(cr * a + r * ab * (1 - a)) * 255; o[q + 1] = clamp01(cg * a + g * ab * (1 - a)) * 255; o[q + 2] = clamp01(cb * a + b * ab * (1 - a)) * 255; o[q + 3] = oa * 255;
  }
  return img;
}

// the panel: a slab of polished rock with a weathered, rounded outline (the outcrop's own edge: two slow undulations)
// the outcrop: rock that does not end in an edge but thins out into the page: its boundary weathered and irregular, its
// cover fading over a fifth of the panel; its tone lifted most of the way to the paper (look.paper, look.lift)
export function outcrop(F, x0, y0, x1, y1, seed = 1) {
  const { cw, ch, dpr } = F, S = F.S ?? (F.S = new Float32Array(cw * ch)), W = x1 - x0, H = y1 - y0, m = Math.min(W, H), ph = [1, 2, 3, 4, 5].map(k => hash(seed, k, 31) * TAU), fade = .26 * m;
  for (let Y = 0; Y < ch; Y++) for (let X = 0; X < cw; X++) { const x = (X + .5) / dpr - (x0 + x1) / 2, y = (Y + .5) / dpr - (y0 + y1) / 2, a = Math.atan2(y / H, x / W);
    const rr = Math.hypot(x / (W / 2), y / (H / 2)) ** 1.0, edge = .98 + .07 * Math.sin(ph[0] + a * 3) + .05 * Math.sin(ph[1] + a * 5) + .03 * Math.sin(ph[2] + a * 9);
    const d = (rr - edge) * m / 2, v = .92 * sm(fade * .35, -fade, d), i = Y * cw + X; if (v > S[i]) S[i] = v; }
  F.lift = 1;
}
export function slab(F, x0, y0, x1, y1, seed = 1, rad = .2) {
  const { cw, ch, dpr } = F, S = F.S ?? (F.S = new Float32Array(cw * ch)), W = x1 - x0, H = y1 - y0, R = rad * Math.min(W, H), ph = [1, 2, 3, 4].map(k => hash(seed, k) * TAU), a = .028 * Math.min(W, H);
  const wx = Float32Array.from({ length: cw }, (_, X) => a * Math.sin(ph[0] + (X + .5) / dpr / W * 4.1)), wy = Float32Array.from({ length: ch }, (_, Y) => a * Math.sin(ph[1] + (Y + .5) / dpr / H * 3.3)), wd = Float32Array.from({ length: cw + ch }, (_, D) => .6 * a * Math.sin(ph[2] + (D + 1) / dpr / (W + H) * 9));
  for (let Y = 0; Y < ch; Y++) { const y = (Y + .5) / dpr, qy = Math.abs(y - (y0 + y1) / 2) - (H / 2 - R);
    for (let X = 0; X < cw; X++) { const x = (X + .5) / dpr, qx = Math.abs(x - (x0 + x1) / 2) - (W / 2 - R);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R + wx[X] + wy[Y] + wd[X + Y];
      const v = clamp01(.5 - d * dpr), i = Y * cw + X; if (v > S[i]) S[i] = v; } }
}

// the piece: its granite, then the pecking (pass by pass), then the brush (stroke by stroke). piece.marks(F) returns
// pits ({k:'pit'}) and strokes ({k:'brush', p, w, t}); piece.slab: [x0, y0, x1, y1] of the panel, if it has one
function prepare(F, piece, look, live = false) {
  F.K = new Float32Array(F.cw * F.ch); F.rp = piece.u; let t = performance.now();
  if (piece.slab) (piece.ground === 'outcrop' ? outcrop : slab)(F, ...piece.slab, piece.seed ?? 1); t = tick('slab', t);
  const marks = piece.marks(F); t = tick('marks', t); const pits = marks.filter(m => m.k === 'pit'); { const rs = pits.map(m => m.r).sort((a, b) => a - b); F.prs = rs.length ? rs[Math.floor(rs.length * .25)] : F.rp; } const _ = 0, strokes = marks.filter(m => m.k === 'brush').map((s, k) => ({ ...s, sid: k, P: strokePixels(F, s, live) })); t = tick('strokePixels', t);
  // the granite is worked out only where it shows or takes paint: the panel, round every pit, under every stroke
  const need = new Uint8Array(F.cw * F.ch), k = F.dpr; if (F.S) for (let i = 0; i < need.length; i++) need[i] = F.S[i] > 0 ? 1 : 0;
  for (const m of pits) { const R = m.r * 1.4 + 2 / k, x0 = Math.max(0, Math.floor((m.x - R) * k) - 1), x1 = Math.min(F.cw - 1, Math.ceil((m.x + R) * k) + 1), y0 = Math.max(0, Math.floor((m.y - R) * k) - 1), y1 = Math.min(F.ch - 1, Math.ceil((m.y + R) * k) + 1);
    for (let Y = y0; Y <= y1; Y++) need.fill(1, Y * F.cw + x0, Y * F.cw + x1 + 1); }
  for (const st of strokes) for (const i of st.P.I) { need[i] = 1; if (i + 1 < need.length) need[i + 1] = 1; if (i >= 1) need[i - 1] = 1; if (i + F.cw < need.length) need[i + F.cw] = 1; if (i >= F.cw) need[i - F.cw] = 1; }
  t = tick('need', t); granite(F, piece.g, { stri: piece.stri ?? 0, seed: piece.seed ?? 1, need }); tick('granite', t);
  return { pits, strokes };
}
// the paint closes over the pits' scallops a little: the pecked floor it fills is the pits' union softened by half a pit
function boxBlur(A, cw, ch, R, passes = 2) { for (let pass = 0; pass < passes; pass++) { const T = new Float32Array(cw * ch), B = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) { let s = 0; for (let x = -R; x <= R; x++) s += A[y * cw + Math.min(cw - 1, Math.max(0, x))]; for (let x = 0; x < cw; x++) { T[y * cw + x] = s / (2 * R + 1); s += A[y * cw + Math.min(cw - 1, x + R + 1)] - A[y * cw + Math.max(0, x - R)]; } }
    for (let x = 0; x < cw; x++) { let s = 0; for (let y = -R; y <= R; y++) s += T[Math.min(ch - 1, Math.max(0, y)) * cw + x]; for (let y = 0; y < ch; y++) { B[y * cw + x] = s / (2 * R + 1); s += T[Math.min(ch - 1, y + R + 1) * cw + x] - T[Math.max(0, y - R) * cw + x]; } }
    A = B; } return A; }
// the paint closes over the pits' scallops (a whole pit: only a faint ripple is left); and D, the groove's depth, falls
// from its centre to its shoulders over ~2.5 grains: the zone where the film thins and breaks on the grain
function settle(F) { const { cw, ch, K } = F; F.z = sm(2.5, 4.5, F.g * (F.zdpr ?? F.dpr));
  const A = boxBlur(K, cw, ch, Math.max(1, Math.round(1.0 * (F.prs ?? F.rp) * F.dpr)));
  for (let i = 0; i < K.length; i++) K[i] = sm(.36, .56, A[i]); }
const peckedFrom = (F, bb) => { const [x0, y0, x1, y1] = bb; for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) { const i = Y * F.cw + X; F.K[i] = sm(.02 * F.g, .25 * F.g, -F.H[i]); } };
export const PROF = {};
const tick = (k, t0) => { PROF[k] = (PROF[k] ?? 0) + performance.now() - t0; return performance.now(); };
export function renderRock(F, piece, look) {
  let t = performance.now(); const { pits, strokes } = prepare(F, piece, look); t = tick('prepare', t);
  for (const m of pits) apply(F, m); peckedFrom(F, [0, 0, F.cw - 1, F.ch - 1]); settle(F); t = tick('pits', t);
  for (const s of strokes) lay(F, s.P, 0, 1e9, { load: s.load ?? 1, decay: s.decay ?? 18, sid: s.sid, seed: piece.seed ?? 1 }); t = tick('lay', t);
  const img = shadeRock(F, look, new ImageData(F.cw, F.ch)); tick('shade', t); return img;
}
// ?draw: the pits fall pass by pass in the first part of the time, then each stroke is laid along its length in turn
export function rockWriter(F, piece, look, g, { dur = 2400 } = {}) {
  const { pits, strokes } = prepare(F, piece, look, true), img = new ImageData(F.cw, F.ch), peckEnd = strokes.length ? .42 : 1;
  const totLen = strokes.reduce((a, s) => a + s.P.len, 0) || 1; let k = 0, si = 0, sFrom = 0, acc = 0;
  shadeRock(F, look, img); g.putImageData(img, 0, 0);
  const put = bb => { if (!bb) return; const e = 2, b = [Math.max(0, bb[0] - e), Math.max(0, bb[1] - e), Math.min(F.cw - 1, bb[2] + e), Math.min(F.ch - 1, bb[3] + e)];
    shadeRock(F, look, img, b); g.putImageData(img, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1); };
  const union = (a, b) => !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  const at = f => { let bb = null;
    const pf = Math.min(1, f / peckEnd); while (k < pits.length && k / pits.length <= pf) { bb = union(bb, apply(F, pits[k++])); }
    if (bb) peckedFrom(F, bb);
    if (f > peckEnd && !F.settled) { settle(F); F.settled = 1; bb = [0, 0, F.cw - 1, F.ch - 1]; }
    if (f > peckEnd) { const reach = (f - peckEnd) / (1 - peckEnd) * totLen;
      while (si < strokes.length) { const s = strokes[si], upto = reach - acc;
        const r = lay(F, s.P, sFrom, upto, { load: s.load ?? 1, decay: s.decay ?? 18, sid: s.sid, seed: piece.seed ?? 1 }); bb = union(bb, r);
        sFrom = s.P.next;
        if (upto >= s.P.len) { acc += s.P.len; si++; sFrom = 0; } else break; } }
    put(bb); };
  return { dur, at, done: () => at(1.0001) };
}
