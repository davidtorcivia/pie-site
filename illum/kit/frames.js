// Frames: penwork round the boxes a web page has (a quotation, a figure, code, a pull quote, an aside, the contents),
// in the hand of kit/penwork.js and kit/wayfinding.js. Each frame is grown from its box's measured geometry and rank,
// and is open: a rule down one side that turns over at its ends, or a head and a foot, never a ruled rectangle.
//
// After the bar borders of Paris Bibles, c. 1280–1300 (Met 469985, 466281): a bar down the gutter beside the text, a
// knop or sprig off it now and then, branching at its foot into arms that turn out along the bottom margin and end in
// a spray. And the diple (>) that medieval scribes set in the margin beside each line of a quotation. Native to the
// web where the source could not be: each frame knows its box's real lines and room, and changes form when the
// measure does (a side staff on a desk becomes a head and foot on a phone).
// All functions return marks: strokes { pts, col, w, start, end } and dots { dot, p, r, col }; col 'a' or 'b'.
import { stream } from './marks.js';
import { wander, arc, hook, hair, bead, eye, breakMark } from './wayfinding.js';

// a turned-over end: the rule's last stretch curls the given way and ends in a bead
const turn = (p, h, size, sense, col) => hair(hook(p, h, size, sense), col, { end: 'ball' });
// beads strung along a straight run, alternating colour on a richer page
const beads = (a, b, step, r, rich, out, rnd) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
  for (let k = 1; k < n; k++) { const t = k / n; out.push(bead([a[0] + (b[0] - a[0]) * t + (rnd() - .5) * .3, a[1] + (b[1] - a[1]) * t + (rnd() - .5) * .3], (k % 2 && rich >= .5 ? .9 : 1.05) + rnd() * .15, k % 2 && rich >= .5 ? 'b' : 'a')); } };
// scallops on one side of a straight run (n: the unit normal toward the outside)
const scallops = (a, b, n, g, out, rnd, colAlt = false, k = 2.85) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), step = g * k, m = Math.floor(L / step), t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const off = (L - (m - 1) * step) / 2, a0 = Math.atan2(n[1], n[0]);
  for (let k = 0; k < m; k++) { const s = off + k * step, sr = g * (.98 + rnd() * .2), c = [a[0] + t[0] * s + n[0] * sr * .45, a[1] + t[1] * s + n[1] * sr * .45];
    out.push(hair(arc(c, sr, a0 - 2.05, a0 + 2.05, 12), colAlt && k % 2 ? 'b' : 'a', { w: .46, end: 'cut' })); } };

// ---- a quotation: a rule down its gutter from the first line to the last, turning out at both ends; a diple at
// each line (the lines are measured); scallops on the outer side; an eye at its head on a lavish page
export function quoteFrame({ x, lines, u, g = 2.4, seed, rich = .5 }) {
  const r = stream(seed, 'quote'), out = [], y0 = lines[0].top + u * .2, y1 = lines.at(-1).base + u * .35;
  out.push(hair(wander([[x, y0], [x, y1]], .25, seed, 40), 'a', { w: .58, end: 'cut' }));
  out.push(turn([x, y0], -Math.PI / 2, u * .42, -1, 'a'), turn([x, y1], Math.PI / 2, u * .42, 1, 'a'));
  if (rich >= .25) lines.forEach((ln, k) => { const dx = x + u * .55, dy = ln.base - u * .48, s = u * .3 * (.9 + r() * .2);
    out.push(hair([[dx, dy - s], [dx + s * 1.1, dy + (r() - .5) * .3], [dx, dy + s]], k % 2 && rich >= .5 ? 'b' : 'a', { w: .5, start: 'cut', end: 'ball' })); });
  if (rich >= .5) scallops([x, y0 + u * 1.2], [x, y1 - u * 1.2], [-1, 0], g, out, r, rich >= .75, rich >= .75 ? 3.4 : 4.6);
  if (rich >= .75) out.push(...eye([x - u * .9, y0 - u * 1.1], u * .38, 'b', r, 4));
  return out;
}

// ---- a figure: a head rule over the picture and a foot rule under it, each turning in at both ends; beads on the head,
// scallops over it, an eye at the head's outer corner on a lavish page
export function figureFrame({ box: [x0, y0, x1, y1], u, g = 2.4, seed, rich = .5 }) {
  const r = stream(seed, 'figure'), out = [], hy = y0 - u * .9, fy = y1 + u * .9, ix0 = x0 + u * .4, ix1 = x1 - u * .4;
  out.push(hair(wander([[ix0, hy], [ix1, hy]], .2, seed + 1, 40), 'a', { w: .58, end: 'cut' }), turn([ix0, hy], Math.PI, u * .45, -1, 'a'), turn([ix1, hy], 0, u * .45, 1, 'a'));
  out.push(hair(wander([[ix0, fy], [ix1, fy]], .2, seed + 2, 40), 'a', { w: .58, end: 'cut' }), turn([ix0, fy], Math.PI, u * .45, 1, 'a'), turn([ix1, fy], 0, u * .45, -1, 'a'));
  if (rich >= .25) beads([ix0 + u, hy], [ix1 - u, hy], u * 1.6, 1, rich, out, r);
  if (rich >= .5) { const q = (ix1 - ix0) * (rich >= .75 ? .12 : .26); scallops([ix0 + q, hy], [ix1 - q, hy], [0, -1], g, out, r, rich >= .75); }
  if (rich >= .75) out.push(...eye([ix0 - u * .55, hy - u * 1.15], u * .4, 'b', r, 4), hair([[ix0 - u * .2, hy - u * .45], [ix0 - u * .4, hy - u * .75]], 'b', { w: .45, end: 'cut' }));
  return out;
}

// ---- code: two corner pieces, at the head on the left and at the foot on the right, each an arm along the edge and an
// arm down the side meeting in a rounded corner, both turned over at their ends; beads along them, an eye in the corner
export function codeFrame({ box: [x0, y0, x1, y1], u, g = 2.4, seed, rich = .5 }) {
  const r = stream(seed, 'code'), out = [], W = x1 - x0, H = y1 - y0, R = u * .7, aw = Math.min(W * .28, u * 14), ah = Math.min(H * .45, u * 9);
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y1, -1, -1]]) {
    const pts = [[cx + sx * aw, cy], [cx + sx * R, cy], ...arc([cx + sx * R, cy + sy * R], R, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? -Math.PI : 0, 8).slice(1), [cx, cy + sy * ah]];
    out.push(hair(wander(pts, .18, seed + sx, 30), 'a', { w: .56, end: 'cut' }));
    out.push(turn([cx + sx * aw, cy], sx > 0 ? 0 : Math.PI, u * .38, -sx * sy, 'a'), turn([cx, cy + sy * ah], sy > 0 ? Math.PI / 2 : -Math.PI / 2, u * .38, sx * sy, 'a'));
    if (rich >= .25) { beads([cx + sx * R * 1.6, cy], [cx + sx * aw, cy], u * 1.5, 1, rich, out, r); beads([cx, cy + sy * R * 1.6], [cx, cy + sy * ah], u * 1.5, 1, rich, out, r); }
    if (rich >= .75) out.push(...eye([cx + sx * R * .95, cy + sy * R * .95], u * .3, 'b', r, 0));
    if (rich >= .5) scallops([cx + sx * R * 1.5, cy], [cx + sx * (aw - u), cy], [0, -sy], g, out, r, rich >= .75);
  }
  return out;
}

// ---- a pull quote: the chapter break of kit/wayfinding.js above and below, rank 1
export function pullFrame({ cx, yTop, yBot, measure, u, seed, rich = .5 }) {
  return [...breakMark(cx, yTop, measure, 1, seed, rich, u), ...breakMark(cx, yBot, measure, 1, seed + 7, rich, u)];
}

// ---- an aside: a rule along its head turning down into its left side, meeting in a round corner; scallops above the
// head; an eye in the corner
export function asideFrame({ box: [x0, y0, x1, y1], u, g = 2.4, seed, rich = .5 }) {
  const r = stream(seed, 'aside'), out = [], R = u * .8, H = y1 - y0;
  const pts = [[x0 + (x1 - x0) * .72, y0], [x0 + R, y0], ...arc([x0 + R, y0 + R], R, -Math.PI / 2, -Math.PI, 8).slice(1), [x0, y0 + Math.min(H * .7, H - u)]];
  out.push(hair(wander(pts, .18, seed, 30), 'a', { w: .56, end: 'cut' }), turn(pts[0], 0, u * .4, 1, 'a'), turn(pts.at(-1), Math.PI / 2, u * .4, 1, 'a'));
  if (rich >= .25) scallops([x0 + R * 1.6, y0], [x0 + (x1 - x0) * (rich >= .75 ? .5 : .34), y0], [0, -1], g, out, r, rich >= .5);   // a run from the corner, not the whole head
  if (rich >= .5) out.push(...eye([x0 - u * .25, y0 - u * .25], u * .36, 'b', r, rich >= .75 ? 4 : 0));
  if (rich >= .75) beads([x0, y0 + R * 1.7], pts.at(-1), u * 1.5, 1, rich, out, r);
  return out;
}

// ---- the contents: the most important box gets the staff. On a desk it runs down the margin beside the list from
// above it to below, forked at the head, curling at the foot, a bead or an eye at each entry's line, scallops between;
// on a phone, where there is no margin, it lies down: a head rule with an eye at its middle, and a foot rule.
export function navFrame({ box: [x0, y0, x1, y1], entries, x, u, g = 2.4, seed, rich = .5, side = true }) {
  const r = stream(seed, 'nav'), out = [];
  if (side) {
    const top = y0 - u * 1.2, bot = y1 + u * 2.4;
    out.push(hair(wander([[x, top], [x, bot]], .3, seed, 50), 'a', { w: .62, end: 'cut' }));
    out.push(turn([x, top], -Math.PI / 2, u * .5, -1, 'a'), turn([x, top], -Math.PI / 2, u * .42, 1, 'a'), turn([x, bot], Math.PI / 2, u * .6, 1, 'a'));
    if (rich >= .5) { const x2 = x - g * 1.1; out.push(hair(wander([[x2, top + u * 2], [x2, bot - u * 1.5]], .3, seed + 3, 50), 'a', { w: .5, start: 'pool', end: 'ball' })); }
    entries.forEach((e, k) => { const y = e.base - u * .45, col = k % 2 ? 'b' : 'a';
      if (rich >= .5) { out.push(hair([[x, y], [x + u * .7, y]], col, { w: .45, end: 'cut' })); out.push(...eye([x + u * .7 + u * .32, y], u * .3, col, r, rich >= .75 ? 4 : 0)); }
      else out.push(bead([x + u * .5, y], 1.2, col)); });
    if (rich >= .25) { const xo = rich >= .5 ? x - g * 1.1 : x;
      for (let k = 0; k <= entries.length; k++) { const ya = k ? entries[k - 1].base : top + u * 1.5, yb = k < entries.length ? entries[k].base - u : bot - u;
        if (yb - ya > g * 4) scallops([xo, ya + u * .2], [xo, yb], [-1, 0], g, out, r, rich >= .75); } }
    return out;
  }
  const hy = y0 - u * 1.1, fy = y1 + u * 1.1, cx = (x0 + x1) / 2;
  for (const [y, sgn] of [[hy, -1], [fy, 1]]) {
    out.push(hair(wander([[x0, y], [x1, y]], .2, seed + sgn, 40), 'a', { w: .58, end: 'cut' }), turn([x0, y], Math.PI, u * .45, -sgn, 'a'), turn([x1, y], 0, u * .45, sgn, 'a'));
    if (rich >= .25) beads([x0 + u * 1.2, y], [x1 - u * 1.2, y], u * 1.6, 1, rich, out, r);
  }
  out.push(...eye([cx, hy - u * .55], u * .38, 'b', r, rich >= .5 ? 4 : 0));
  if (rich >= .5) scallops([x0 + u * 2, fy], [x1 - u * 2, fy], [0, 1], g, out, r, rich >= .75);
  return out;
}

// ==== the registry's frames ======================================================================================================
// Every style frames the same six boxes, with the same arguments as the functions above (a pull quote also gets its
// `lines`); Gothic's are those functions. Each other style frames in its own tradition's idiom.
import { STYLES, line, cpStroke, cpOval, beauty } from './wayfinding.js';
const pad = ([x0, y0, x1, y1], d, dy = d) => [x0 - d, y0 - dy, x1 + d, y1 + dy];
const shiftY = (m, d) => m.map(s => s.dot ? { ...s, p: [s.p[0], s.p[1] + d] } : { ...s, pts: s.pts.map(([x, y]) => [x, y + d]) });
const ysOf = m => m.flatMap(s => s.dot ? [s.p[1] - s.r, s.p[1] + s.r] : s.pts.map(p => p[1]));
// the style's chapter break above and below a pull quote, each moved clear of the words by its own height
const breaks = key => ({ cx, yTop, yBot, measure, u, seed, rich = .5 }) => { const S = STYLES[key], b = (y, sd) => S.breakMark(cx, y, measure, 1, sd, rich, u, { ...S.setup(sd), index: 1 });
  const a = b(yTop, seed), c = b(yBot, seed + 7); return [...shiftY(a, Math.min(0, yTop + u * 1.6 - Math.max(...ysOf(a)))), ...shiftY(c, Math.max(0, yBot - u * 1.7 - Math.min(...ysOf(c))))]; };

// ---- Copperplate: no ruled line: at the corners the writing master's flourish, two ovals on the slant interlaced, and
// from them along each side a line of beauty that thins away; a quotation gets the flourish at the head and the foot of
// its gutter, joined by a single hairline
function cpCorner([cx, cy], sx, sy, u, sides = [1, 1], len = [u * 5, u * 5]) {   // sx, sy: which way the box lies from the corner
  const out = [], c = [cx - sx * u * .35, cy - sy * u * .35];
  // the two ovals lie along the two sides, crossing at the corner
  out.push(cpStroke(cpOval([c[0] + sx * u * 1.1, c[1] - sy * u * .15], u * 2.4, u * .78, Math.PI * .6, Math.PI * 2.04, 72, -.16 * sx * sy), u * .085, 'a', 3.4), cpStroke(cpOval([c[0] - sx * u * .15, c[1] + sy * u * 1.1], u * 2.4, u * .78, Math.PI * .1, Math.PI * 2.04, 72, Math.PI / 2 + .16 * sx * sy), u * .075, 'a', 3.2));
  if (sides[0]) out.push(cpStroke(beauty([cx + sx * u * 3.4, cy], [cx + sx * (len[0] + u * 3), cy], .03 * sy, 30), u * .055, 'a', 2.5, { start: 'taper', end: 'taper' }));
  if (sides[1]) out.push(cpStroke(beauty([cx, cy + sy * u * 3.4], [cx, cy + sy * (len[1] + u * 3)], .03 * sx, 30), u * .055, 'a', 2.5, { start: 'taper', end: 'taper' }));
  return out; }
STYLES.copperplate.frames = {
  quote: ({ x, lines, u }) => { const y0 = lines[0].top, y1 = lines.at(-1).base + u * .4;
    return [...cpCorner([x, y0], 1, 1, u, [0, 0]), ...cpCorner([x, y1], 1, -1, u, [0, 0]), cpStroke(beauty([x, y0 + u * 1.2], [x, y1 - u * 1.2], .015, 40), u * .05, 'a', 2.5)]; },
  figure: ({ box, u }) => { const B = pad(box, u * .9), L = [Math.min(u * 6, (B[2] - B[0]) * .3), Math.min(u * 5, (B[3] - B[1]) * .3)];
    return [...cpCorner([B[0], B[1]], 1, 1, u, [1, 1], L), ...cpCorner([B[2], B[1]], -1, 1, u, [1, 1], L), ...cpCorner([B[2], B[3]], -1, -1, u, [1, 1], L), ...cpCorner([B[0], B[3]], 1, -1, u, [1, 1], L)]; },
  code: ({ box, u }) => { const L = [Math.min(u * 7, (box[2] - box[0]) * .3), Math.min(u * 4, (box[3] - box[1]) * .4)]; return [...cpCorner([box[0], box[1]], 1, 1, u, [1, 1], L), ...cpCorner([box[2], box[3]], -1, -1, u, [1, 1], L)]; },
  pull: breaks('copperplate'),
  aside: ({ box, u }) => cpCorner([box[0], box[1]], 1, 1, u, [1, 1], [Math.min(u * 8, (box[2] - box[0]) * .5), Math.min(u * 5, (box[3] - box[1]) * .6)]),
  nav: ({ box, entries, x, u, side = true }) => { if (!side) { const c = [(box[0] + box[2]) / 2, box[1] - u * 1.3]; return [...cpCorner(c, 1, 1, u * .55, [0, 0]), cpStroke(beauty([c[0] + u * 1.2, c[1]], [Math.min(box[2], c[0] + u * 9), c[1]], .03, 30), u * .06, 'a', 2.5)]; }
    const y0 = box[1] - u * .6, y1 = box[3] + u * .4; return [...cpCorner([x, y0], 1, 1, u, [0, 0]), ...cpCorner([x, y1], 1, -1, u, [0, 0]), cpStroke(beauty([x, y0 + u * 1.2], [x, y1 - u * 1.2], .015, 40), u * .05, 'a', 2.5)]; },
};

// ---- Swiss: rules and a numbered label on the grid, asymmetric and flush left: a heavy bar, a hairline, the number set
// in a grotesque's figures beside a red square
const FIG = { 0: [], 1: [[.25, .18], [.6, 0], [.6, 1]], 2: [[.05, .25], [.2, .05], [.5, 0], [.8, .05], [.95, .25], [.9, .45], [.05, 1], [1, 1]], 3: [[.05, .12], [.5, 0], [.9, .15], [.9, .38], [.5, .5], [.95, .65], [.95, .88], [.5, 1], [.05, .88]],
  4: [[.75, 1], [.75, 0], [0, .7], [1, .7]], 5: [[.9, 0], [.15, 0], [.08, .45], [.5, .38], [.92, .55], [.92, .85], [.5, 1], [.05, .88]], 6: [[.85, .08], [.5, 0], [.12, .25], [.08, .65], [.3, .98], [.7, .98], [.92, .72], [.75, .48], [.4, .45], [.1, .62]],
  7: [[0, 0], [1, 0], [.35, 1]], 8: [[.5, .5], [.12, .3], [.5, 0], [.88, .3], [.5, .5], [.08, .75], [.5, 1], [.92, .75], [.5, .5]], 9: [[.15, .92], [.5, 1], [.88, .75], [.92, .35], [.7, .02], [.3, .02], [.08, .28], [.25, .52], [.6, .55], [.9, .38]] };
const figure_ = (n, [x, y], h, col) => [...String(n)].map((ch, i) => ch === '0' ? line(arc([x + i * h * .7 + h * .27, y + h / 2], h * .27, 0, 2 * Math.PI + .02, 24).map(([px, py]) => [px, y + h / 2 + (py - y - h / 2) * 1.85]), col, .7)
  : line(FIG[ch].map(([px, py]) => [x + i * h * .7 + px * h * .55, y + py * h]), col, .7));
const bar = (a, b, w, col = 'b') => ({ col, broad: 1, nib: Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) ? 0 : Math.PI / 2, w, load: 1.1, dry: 0, swell: 0, start: 'cut', end: 'cut', pts: [a, b] });
const label = ([x, y], n, u) => [bar([x, y + u * .6], [x + u * .8, y + u * .6], u * .8, 'a'), ...figure_(n, [x + u * 1.35, y - u * .4], u * 1.6, 'b')];
STYLES.swiss.frames = {
  quote: ({ x, lines, u }) => [bar([x - u * .2, lines[0].top + u * .25], [x - u * .2, lines.at(-1).base + u * .3], u * .35)],
  figure: ({ box: [x0, y0, x1, y1], u, seed }) => [bar([x0, y0 - u * .9], [x0 + (x1 - x0) * .5, y0 - u * .9], u * .35), ...label([x0, y0 - u * 2.6], 1 + seed % 9, u), line([[x0, y1 + u * .9], [x1, y1 + u * .9]], 'b', .5)],
  code: ({ box: [x0, y0, x1, y1], u, seed }) => [line([[x0, y0], [x1, y0]], 'b', .5), bar([x0, y0], [x0 + u * 3, y0], u * .35), ...label([x1 - u * 2.4, y0 + u * .35], 1 + seed % 9, u)],
  // a pull quote: the bar at the head of its first line, on the column's left as everything else; a hairline under it
  pull: ({ yTop, yBot, u, lines }) => { const L = lines ?? [{ left: 0, right: 0 }], x0 = Math.min(...L.map(l => l.left)), x1 = Math.max(...L.map(l => l.right));
    return [bar([x0, yTop + u * 1.1], [x0 + u * 3, yTop + u * 1.1], u * .45, 'a'), line([[x0, yBot - u * .1], [x1, yBot - u * .1]], 'b', .5)]; },
  aside: ({ box: [x0, y0, x1, y1], u }) => [bar([x0, y0], [x0 + (x1 - x0) * .38, y0], u * .35), line([[x0, y0], [x0, y1]], 'b', .5)],
  nav: ({ box: [x0, y0, x1, y1], entries, x, u, side = true }) => { const out = [bar([side ? x - u * 1.6 : x0, y0 - u * .9], [(side ? x - u * 1.6 : x0) + u * 3, y0 - u * .9], u * .35)];
    if (side) entries.forEach((e, k) => out.push(...figure_(k + 1, [x - u * 1.6, e.base - u * .95], u * .85, 'b'))); else out.push(line([[x0, y1 + u * .9], [x1, y1 + u * .9]], 'b', .5)); return out; },
};

STYLES.gothic.frames = { quote: quoteFrame, figure: figureFrame, code: codeFrame, pull: pullFrame, aside: asideFrame, nav: navFrame };
