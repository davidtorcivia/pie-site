// Marks: a pen that deposits ink, a curve that grows like a tendril, and paint that pools.
// Playground code, shared by the studies; it moves to lib/ once it has earned it.
//
// The pen is stamped, not stroked: hundreds of overlapping low-alpha dabs per centimetre, so the edge of a line is
// accumulated rather than drawn, ink gathers where the pen dwells (starts, turns, ends) and thins as it runs dry.
// After AlMeraj et al. 2009 (speed and pressure profiles) and research/02-analog §4.6.

// ---- determinism ------------------------------------------------------------------------------------------------------
export const fnv = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
export const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const stream = (seed, name) => mulberry(fnv(name + ':' + seed));
export const hash2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
export const noise1 = seed => x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash2(i, 0, seed) * (1 - u) + hash2(i + 1, 0, seed) * u; };
export const noise2 = seed => (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- curves -------------------------------------------------------------------------------------------------------------
// A tendril: start at p with heading h (radians), curvature rising smoothly along its length from k0 to k1
// (signed: +1 turns counter-clockwise on screen... i.e. toward +y from +x). One curvature ramp, so there is no join.
export function tendril(p, h, L, k0, k1, pw = 2.4, ds = .5) {
  const out = [[p[0], p[1]]]; let [x, y] = p, a = h;
  for (let s = 0; s < L; s += ds) { const k = k0 + (k1 - k0) * Math.pow(s / L, pw); a += k * ds; x += Math.cos(a) * ds; y += Math.sin(a) * ds; out.push([x, y]); }
  return out;
}
// Resample a polyline at even spacing (for the pen); keeps the first and last points.
export function resample(pts, ds = .4) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.hypot(x1 - x0, y1 - y0); let t = ds - carry;
    while (t <= l) { out.push([x0 + (x1 - x0) * t / l, y0 + (y1 - y0) * t / l]); t += ds; }
    carry = l - (t - ds);
  }
  out.push(pts[pts.length - 1]); return out;
}
// Catmull–Rom through control points, sampled finely (for hand-placed or jittered control polygons)
export function spline(cp, n = 16) {
  const out = [], P = i => cp[Math.max(0, Math.min(cp.length - 1, i))];
  for (let i = 0; i < cp.length - 1; i++) for (let k = 0; k < n; k++) {
    const t = k / n, [a, b, c, d] = [P(i - 1), P(i), P(i + 1), P(i + 2)], t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map(j => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
  }
  out.push(cp[cp.length - 1]); return out;
}

// ---- the pen ------------------------------------------------------------------------------------------------------------
// The line's outline is computed once (width from pressure, the nib's angle and the turn), so its edge is crisp as a
// real pen line is; its body is then laid in short overlapping pieces, each opaque in the colour that its ink density
// gives over the paper (subtractive: paper · exp(−K·ρ)), so a line darkens where the pen dwelt and pales as it dries
// without any blur or halo. A slightly darker edge where the ink dried at the line's margins.
// opts: w (nominal width, px), nib (angle of the broad edge, rad), broad (0 pointed .. 1 broad nib), load, dry,
//       swell (opening on turns), ink [r,g,b] (the ink's mass tone), paper, start/end ('pool'|'taper'|'ball'|'cut'), seed
export const INK = [36, 25, 18];
export function pen(g, pts, o = {}) {
  const { w = 1.4, nib = .7, broad = .45, load = .95, dry = .3, swell = .45, ink = INK, paper = PAPER, seed = 1,
    start = 'pool', end = 'taper', shade = null, from = 0, to = 1, press = null, dark = false } = o;
  const ds = Math.max(.25, Math.min(1, w * .35)), P = resample(pts, ds), n = P.length; if (n < 3) return;
  const wob = noise1(seed), wob2 = noise1(seed ^ 0x55), edge = noise1(seed ^ 0x99);
  let L = 0; const S = [0]; for (let i = 1; i < n; i++) S.push(L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const head = i => { const a = P[Math.max(0, i - 2)], b = P[Math.min(n - 1, i + 2)]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const Kc = ink.map((c, i) => -Math.log(Math.max(.02, c / paper[i])));
  const Lw = [], Rw = [], RHO = [];
  for (let i = 0; i < n; i++) {
    const s = S[i], u = s / L, a = head(i);
    let da = head(Math.min(n - 1, i + 3)) - head(Math.max(0, i - 3)); da = Math.abs(((da + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const k = da / (6 * ds);
    const land = start === 'cut' ? 1 : .4 + .6 * smooth(0, Math.min(.15, 9 / L), u);
    const lift = end === 'cut' ? 1 : end === 'ball' ? .55 + .45 * (1 - smooth(1 - Math.min(.3, 24 / L), 1, u))
      : .08 + .92 * Math.pow(1 - smooth(1 - Math.min(.35, 34 / L), 1, u), 1.2);
    const across = 1 - broad + broad * Math.abs(Math.sin(a - nib));
    const sh = shade ? .45 + 1.25 * Math.max(0, -Math.sin(a) * shade[0] + Math.cos(a) * shade[1]) : 1;
    const hw = Math.max(.14, w * .5 * sh * (press ? press(u) : 1) * across * land * lift * (.72 + .56 * wob(s / 30)) * (1 + swell * Math.min(1, k * 5)));
    // the two edges waver independently, a little, slowly: a pen line's margins are never parallel
    const el = hw * (1 + .12 * (edge(s / 5) - .5)), er = hw * (1 + .12 * (edge(s / 5 + 70) - .5)), nx = -Math.sin(a), ny = Math.cos(a);
    Lw.push([P[i][0] + nx * el, P[i][1] + ny * el]); Rw.push([P[i][0] - nx * er, P[i][1] - ny * er]);
    const dwell = (start === 'pool' ? .5 : .15) * Math.exp(-s / 5) + Math.min(.35, k * 1.6);
    RHO.push(Math.max(.25, (load - dry * u) * (.9 + .2 * wob2(s / 9))) + dwell + .25 * (1 - lift));
  }
  // on a dark ground (opt-in) ink cannot darken the paper: it is its own colour, rising from the ground as it loads and
  // a shade deeper where it pools, so a pool or a dried margin never becomes a light glow
  const col = dark ? rho => darkInk(ink, paper, rho) : rho => `rgb(${paper.map((p, j) => Math.round(p * Math.exp(-Kc[j] * rho)))})`;
  // body: quads between consecutive samples, each a touch longer so they never show a seam
  g.globalAlpha = 1;
  const i0 = from <= 0 ? 0 : S.findIndex(v => v >= from * L), i1 = to >= 1 ? n - 1 : Math.max(i0, S.findIndex(v => v >= to * L));
  if (i0 < 0 || i1 <= i0 && to < 1) return;
  for (let i = i0; i < Math.min(n - 1, i1); i++) {
    const i2 = Math.min(n - 1, i + 2, i1 + 1);
    g.beginPath(); g.moveTo(Lw[i][0], Lw[i][1]); g.lineTo(Lw[i2][0], Lw[i2][1]); g.lineTo(Rw[i2][0], Rw[i2][1]); g.lineTo(Rw[i][0], Rw[i][1]); g.closePath();
    g.fillStyle = col(Math.min(1.25, RHO[i])); g.fill();
  }
  // the margin where the ink dried a shade darker
  g.lineWidth = .35; g.lineJoin = 'round';
  for (const side of [Lw, Rw]) { g.beginPath(); side.slice(i0, i1 + 1).forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]));
    g.strokeStyle = col(1.35); g.globalAlpha = .35; g.stroke(); }
  g.globalAlpha = 1;
  // terminals: a bead where the pen touched down and pooled, a ball where a curl is finished
  const bead = (q, r) => { g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fillStyle = col(1.3); g.fill(); };
  if (start === 'pool' && i0 === 0) bead(P[0], Math.max(.3, (Lw[1] && Math.hypot(Lw[1][0] - Rw[1][0], Lw[1][1] - Rw[1][1]) / 2) * 1.15));
  if (end === 'ball' && i1 === n - 1 && to >= 1) bead(P[n - 1], Math.max(1.05, w * (.75 + .5 * wob(L))));
}

// A single dot of ink or paint, as the pen leaves it when touched to the page and lifted.
export function dot(g, p, r, ink = INK, paper = PAPER, rho = 1.1, dark = false) {
  const Kc = ink.map((c, i) => -Math.log(Math.max(.02, c / paper[i])));
  g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fillStyle = dark ? darkInk(ink, paper, rho) : `rgb(${paper.map((q, j) => Math.round(q * Math.exp(-Kc[j] * rho)))})`; g.fill();
}
// ink on a dark ground: mixed up from the ground toward the ink's own colour by its load, a little deeper past full
const darkInk = (ink, paper, rho) => { const k = Math.min(1, Math.pow(Math.max(0, rho), .7)), deep = rho > 1 ? 1 - .07 * Math.min(1, rho - 1) : 1;
  return `rgb(${ink.map((c, j) => Math.round((paper[j] + (c - paper[j]) * k) * deep))})`; };

// A branch as a hand draws it: it leaves the parent almost along it, bends away, then turns back on one smooth
// curvature into a curl (or, for a leaf's stalk, only part way). kAway < 0 relative to the curl's sense.
export function branch(p, h, L, kCurl, { away = .7, pw = 2.6, ds = .5 } = {}) {
  const out = [[p[0], p[1]]]; let [x, y] = p, a = h; const kA = -Math.sign(kCurl) * away * 6 / L;
  for (let s = 0; s < L; s += ds) { const t = s / L, k = kA * Math.pow(1 - t, 3) + kCurl * Math.pow(t, pw);
    a += k * ds; x += Math.cos(a) * ds; y += Math.sin(a) * ds; out.push([x, y]); }
  return out;
}

// ---- paint --------------------------------------------------------------------------------------------------------------
// A wash of one pigment inside an outline, on paper of a known colour: the edge does not quite follow the outline
// (registration drifts slowly along it), pigment pools in a darker rim, mottles a little, and granulates on the
// paper's hidden tooth. Colour is subtractive: paper · exp(−K·d), K chosen so that d = 1 gives the pigment's mass tone.
export const PAPER = [244, 238, 226];
export const PIGMENTS = {
  lapis: { rgb: [42, 60, 128], gran: .2, rim: .7 },        // natural ultramarine: granulates strongly
  vermilion: { rgb: [200, 72, 44], gran: .06, rim: .45 },   // vermilion: dense, smooth
  verdigris: { rgb: [60, 118, 98], gran: .14, rim: .6 },
  shellgold: { rgb: [192, 154, 78], gran: .16, rim: .35, metal: true },  // powdered gold in gum: matte, grainy
  ochre: { rgb: [186, 130, 62], gran: .14, rim: .5 },
  bole: { rgb: [168, 84, 52], gran: .1, rim: .3 },
  rose: { rgb: [206, 120, 128], gran: .08, rim: .5 },
  carmine: { rgb: [172, 44, 70], gran: .06, rim: .5 },     // kermes/lac red, the body of the late Italian initials
  carmineShade: { rgb: [118, 26, 48], gran: .06, rim: .35 },
  lapisShade: { rgb: [24, 34, 86], gran: .15, rim: .4 },       // rose lake with lead white, the pink of the late borders          // the red clay laid under gold
};
const K = (rgb, paper) => rgb.map((c, i) => -Math.log(Math.max(.02, c / paper[i])));
const tooth = noise2(9157), tooth2 = noise2(3319), mottle = noise2(7741), wearN = noise2(5521);
// outline: closed polyline in page px. The wash is rasterised at dpr into its own canvas and drawn on g.
export function wash(g, outline, pigment, o = {}) {
  const { dpr = 2, seed = 1, grow = 0 } = o;
  const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]), pad = 4;
  const x0 = Math.floor(Math.min(...xs) - pad), y0 = Math.floor(Math.min(...ys) - pad), W = Math.ceil(Math.max(...xs) + pad - x0), H = Math.ceil(Math.max(...ys) + pad - y0);
  const cw = Math.ceil(W * dpr), ch = Math.ceil(H * dpr), c = new OffscreenCanvas(cw, ch).getContext('2d');
  // the wash's own edge: the outline, drifted in and out by up to ~1.2 px, slowly
  const n = outline.length, drift = noise1(seed ^ 0x77);
  let cx = 0, cy = 0; outline.forEach(p => { cx += p[0] / n; cy += p[1] / n; });
  c.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr); c.beginPath();
  outline.forEach((p, i) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1, e = (drift(i / n * 7) - .62) * 2.2 + grow;
    const q = [p[0] + dx / l * e, p[1] + dy / l * e]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); });
  c.closePath(); c.fillStyle = '#fff'; c.fill();
  const img = c.getImageData(0, 0, cw, ch), M = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) M[i] = img.data[i * 4 + 3] / 255;
  paintField(g, M, x0, y0, cw, ch, pigment, { ...o, seed });
}
// Paint a coverage mask M (cw × ch device pixels, its top-left at page x0, y0) with one pigment.
export function paintField(g, M, x0, y0, cw, ch, pigment, o = {}) {
  const { dpr = 2, seed = 1, strength = 1, paper = PAPER, ox = 0, oy = 0, wear = 0 } = o, pg = PIGMENTS[pigment];
  const cv = new OffscreenCanvas(cw, ch), c = cv.getContext('2d'), img = c.createImageData(cw, ch), d = img.data;
  // distance proxy: a wide blur of the mask (Curtis's own trick); 1 deep inside, ~.5 on the edge
  const B = blur(blur(M, cw, ch, Math.round(2.2 * dpr)), cw, ch, Math.round(2.2 * dpr));
  const Kp = K(pg.rgb, paper);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x, m = M[i]; if (m <= 0) { d[i * 4 + 3] = 0; continue; }
    const px = x0 + x / dpr + ox, py = y0 + y / dpr + oy;
    const rim0 = Math.max(0, 1 - B[i]) * 1.6;
    // wear: the layer rubs through where it is thin, most of all at its edges
    if (wear && wearN(px / 1.8 + seed * 3.1, py / 1.8) * .65 + wearN(px / .7, py / .7 + seed) * .35 + rim0 * .3 > 1.02 - wear * .5) { d[i * 4 + 3] = 0; continue; }
    const rim = Math.pow(Math.max(0, 1 - B[i]) * 1.6, 1.6);
    const h = .7 * tooth(px / 2.8, py / 3.2) + .3 * tooth2(px / 1.4, py / 1.2);
    let dens = strength * (1 + pg.rim * rim) * (.88 + .24 * mottle(px / 7 + seed, py / 7)) * (1 + pg.gran * (.5 - h) * 1.6);
    let col = paper.map((pc, j) => pc * Math.exp(-Kp[j] * dens));
    if (pg.metal) { // burnished gold: the light runs in soft streaks the way the tool was drawn across it; dull at the rim
      const ca = Math.cos(seed * 1.7), sa = Math.sin(seed * 1.7), u = (px * ca + py * sa), v = (-px * sa + py * ca);
      const lit = mottle(u / 9 + 17, v / 3) * .6 + mottle(u / 4, v / 4 + 40) * .4, fine = tooth2(px / .6 + 5, py / .6);
      const k = .86 + .3 * smooth(.3, .85, lit) + .06 * (fine - .5) - .16 * rim0;
      col = col.map((v, j) => Math.min(255, v * k + (k > 1.15 ? (k - 1.15) * [190, 160, 60][j] : 0)));
    }
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255 * m;
  }
  c.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingQuality = 'high'; g.drawImage(cv, x0, y0, cw / dpr, ch / dpr); g.restore();
}
function blur(A, w, h, r) {
  if (r < 1) return A; const T = new Float32Array(w * h), O = new Float32Array(w * h), k = 2 * r + 1;
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += A[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { T[y * w + x] = s / k; s += A[y * w + Math.min(w - 1, x + r + 1)] - A[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += T[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { O[y * w + x] = s / k; s += T[Math.min(h - 1, y + r + 1) * w + x] - T[Math.max(0, y - r) * w + x]; } }
  return O;
}

// ---- the ivy leaf ---------------------------------------------------------------------------------------------------------
// In leaf units: base at (0,0), tip at (1,0). Pointed basal lobes, a shoulder, a concave flank drawn out to the point.
export function ivyLeaf(r) {
  const j = () => 1 + (r() - .5) * .2, tip = (r() - .5) * .1;
  const side = s => { const w = .5 * j(), lb = .14 * j(), sx = .3 * j();
    return [[.1, 0], [.04, .1 * s], [-.05, .2 * s], [-lb, w * .72 * s], [-.01, w * .98 * s], [.15, w * 1.06 * s], [sx, w * s],
      [.55, w * .5 * s], [.8, w * .16 * s], [1, tip]]; };
  const cub = pts => { const out = [pts[0]];
    for (let k = 1; k < pts.length - 2; k += 3) for (let i = 1; i <= 14; i++) { const t = i / 14, u = 1 - t, [p0, p1, p2, p3] = [pts[k - 1], pts[k], pts[k + 1], pts[k + 2]];
      out.push([0, 1].map(q => u * u * u * p0[q] + 3 * u * u * t * p1[q] + 3 * u * t * t * p2[q] + t * t * t * p3[q])); }
    return out; };
  return { right: cub(side(1)), left: cub(side(-1)), tip };
}
// place a shape given in leaf units at base b, along unit axis ax, length L
export const place = (pts, b, ax, L) => pts.map(([x, y]) => [b[0] + (ax[0] * x - ax[1] * y) * L, b[1] + (ax[1] * x + ax[0] * y) * L]);

// The gold ivy of French borders c. 1450–1500: a spiky trefoil, two side points swept back and a long tip, edges
// drawn in between them; in leaf units with the stalk at (0,0) and the tip toward +x.
export function trefoil(r) {
  const j = (a = .2) => 1 + (r() - .5) * a, swl = .5 * j(), swr = .5 * j(), sb = .2 * j(.5), tl = 1 * j(.15), bend = (r() - .5) * .22;
  // each side lobe a little rounded at its point, the tip drawn out; the two sides never match
  const lobe = (s, sw) => [[sb - .1, s * sw * .66], [sb - .03, s * sw], [sb + .07, s * sw * 1.02], [sb + .17, s * sw * .58]];
  const pts = [[0, 0], [.07, -.16 * j()], ...lobe(-1, swl), [.44, -.2 * j()], [tl * .8, -.07 + bend * .6],
    [tl, bend], [tl * .8, .07 + bend * .6], [.44, .2 * j()], ...lobe(1, swr).reverse(), [.07, .16 * j()]];
  return spline([...pts, pts[0]], 6);
}
