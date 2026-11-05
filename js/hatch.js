// Hatched stroke fields: thousands of short curved strokes that follow a flow (an angle per point), like thread laid
// on canvas. Used for the asterisk, the migration threads, the painted frames and the bars.

// --- 2D simplex noise (Stefan Gustavson's, compact) ---------------------------------------------------------------
export function noise2(seed = 1) {
  const p = new Uint8Array(512), g = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const F = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (x, y) => {
    const t = (x + y) * F, i = Math.floor(x + t), j = Math.floor(y + t), t0 = (i + j) * G2;
    const x0 = x - (i - t0), y0 = y - (j - t0), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    for (const [dx, dy, gi] of [[x0, y0, p[ii + p[jj]]], [x1, y1, p[ii + i1 + p[jj + j1]]], [x2, y2, p[ii + 1 + p[jj + 1]]]]) {
      let tt = .5 - dx * dx - dy * dy;
      if (tt > 0) { tt *= tt; const gg = g[gi & 7]; n += tt * tt * (gg[0] * dx + gg[1] * dy); }
    }
    return 70 * n;
  };
}

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// fit a canvas to its CSS box at device pixel ratio; returns ctx scaled to CSS pixels
export function fit(canvas, maxDpr = 2) {
  const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, maxDpr);
  canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
  const ctx = canvas.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

// trace streamlines: seeds on a jittered grid inside `inside(x,y)`, each following angle(x,y) for `len` px
export function field({ w, h, spacing = 6, len = 30, step = 2, angle, inside = () => true, colors = ['#000'], width = [.8, 1.6], seed = 7, jitter = 1 }) {
  const r = rng(seed), out = [];
  for (let y = 0; y < h; y += spacing) for (let x = 0; x < w; x += spacing) {
    const sx = x + (r() - .5) * spacing * 2 * jitter, sy = y + (r() - .5) * spacing * 2 * jitter;
    if (!inside(sx, sy)) continue;
    const L = len * (.55 + r() * .9), pts = [[sx, sy]];
    let px = sx, py = sy;
    for (let d = 0; d < L; d += step) {
      const a = angle(px, py);
      px += Math.cos(a) * step; py += Math.sin(a) * step;
      if (!inside(px, py)) break;
      pts.push([px, py]);
    }
    if (pts.length < 3) continue;
    out.push({ pts, c: colors[Math.floor(r() * colors.length)], lw: width[0] + r() * (width[1] - width[0]), d: r() });
  }
  return out;
}

// draw strokes; t in 0..1 grows each stroke (staggered by its own delay d) — t=1 draws everything
export function draw(ctx, strokes, t = 1, { cap = 'round', alpha = 1 } = {}) {
  ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.globalAlpha = alpha;
  for (const s of strokes) {
    const k = t >= 1 ? 1 : Math.max(0, Math.min(1, (t * 1.6 - s.d * .6)));
    if (k <= 0) continue;
    const n = Math.max(2, Math.floor(s.pts.length * k));
    ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
    ctx.strokeStyle = s.c; ctx.lineWidth = s.lw; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// speckle: a granite ground of tiny dabs (ref: the speckled mats)
export function speckle(ctx, w, h, { colors, density = .02, size = [1, 2.6], seed = 3 } = {}) {
  const r = rng(seed), n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.beginPath(); ctx.ellipse(r() * w, r() * h, s, s * (.5 + r() * .6), r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
}

// a painted frame: a thick border of threads running along each side, mitred at the corners (ref: the hatched
// frames), and a speckled or flat ground inside. `band` is the border width in px.
export function paintFrame(canvas, { band = 60, threads, ground, groundSpeck, seed = 11, inner = null } = {}) {
  const { ctx, w, h } = fit(canvas);
  const n = noise2(seed);
  ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  if (groundSpeck) speckle(ctx, w, h, { colors: groundSpeck, density: .05, seed: seed + 1 });
  // which side's band a point is in (mitred), and the thread direction there
  const side = (x, y) => {
    const dl = x, dr = w - x, dt = y, db = h - y, m = Math.min(dl, dr, dt, db);
    if (m > band) return null;
    return m === dl || m === dr ? 'v' : 'h';
  };
  const strokes = field({ w, h, spacing: 3.2, len: 26, step: 1.6, seed,
    inside: (x, y) => side(x, y) !== null,
    angle: (x, y) => (side(x, y) === 'v' ? Math.PI / 2 : 0) + n(x * .02, y * .02) * .25,
    colors: threads, width: [.7, 1.5] });
  draw(ctx, strokes);
  // a hairline where the band meets the field, and the mitre seams
  ctx.strokeStyle = threads[0]; ctx.globalAlpha = .55; ctx.lineWidth = 1;
  ctx.strokeRect(band, band, w - band * 2, h - band * 2);
  for (const [x0, y0, x1, y1] of [[0, 0, band, band], [w, 0, w - band, band], [0, h, band, h - band], [w, h, w - band, h - band]]) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (inner) inner(ctx, w, h);
  return { ctx, w, h };
}

// hatched bar fill (texture fill at 45°) inside a rect
export function hatchRect(ctx, x, y, w, h, { color, gap = 5, lw = 1.4, angle = 45 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  const t = Math.tan(angle * Math.PI / 180);
  for (let i = -h; i < w + h; i += gap) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h / t, y); ctx.stroke(); }
  ctx.restore();
}
