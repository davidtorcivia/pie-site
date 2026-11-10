// Initials: each style's drop initial, the first element of the registry (kit/wayfinding.js STYLES) that is not a
// line's ornament. A style's `initial(o)` takes the letter as the walk measured it and returns how the letter is laid
// and the marks round it:
//   o: { G (the letter's coverage: M, w, h, x0, y0, res, box [x0, y0, x1, y1]), keep (word rects, padded), lh (the
//        line height), u (the x-height), big (a drop initial, or one in the line), level (0..4, kit/penwork.js budgets),
//        rich, seed, room (px of margin to the letter's left, the sheet's edge kept), bottom (the lowest y allowed) }
//   → { letter: { M, pigment } (laid with the brush) | { M, col, outline?, ghost? } (flat), ground?: marks laid under the
//       letter, marks: marks over it }
// Marks are the registry's: strokes { pts, col, w, start, end, load?, dry?, broad?, swell?, nib?, press?, ink?, seed? }
// and points { dot, p, r, col, ink? }; col 'a' | 'b' (the style's pair: 'a' the first), 'g' gold, 'k' black, 'f' flesh.
// A style without an initial lays its letter flat in its first colour, with nothing round it.
import { PIGMENTS } from './marks.js';
import { flourish, drawn } from './penwork.js';
import { STYLES, line, cpStroke, cpOval, cubic } from './wayfinding.js';
const SLANT = 55 * Math.PI / 180;

const bbox = G => G.box;

// ---- Gothic: 03's penwork (kit/penwork.js flourish), with 03's geometry and inks exactly, so 03 can move onto it
// per level: the panel's width (of the letter's height), how far its hairlines rise above the letter, the staff's
// length (lines), and how much wider the gap to the words is (px, for a text-side panel)
const GEOM = { panelW: [.3, .4, .52, .6, .68], rise: [0, .03, .06, .14, .22], staff: [1.4, 3.2, 5.5, 7, 9], wider: [0, 0, 0, 5, 9],
  small: { panelW: [5, 7, 8.5, 10, 12], staff: [.7, 1.2, 1.6, 2.2, 3] } };
// the opposite-colour rule (01-canon §2.2): a blue letter takes red penwork, a red letter blue
const INKS = { azurite: [212, 108, 82], minium: [60, 86, 164] };
function gothic({ G, keep, lh, big, level: li, seed, room: margin, bottom }) {
  const pig = big ? 'azurite' : 'minium', ink = INKS[pig], [lx0, ly0, , ly1] = bbox(G), Hl = ly1 - ly0;
  const gap = big ? 2.6 : 2.1, room = Math.max(0, margin - gap * 3);
  const panel = big ? [lx0 - Math.min(GEOM.panelW[li] * Hl, room), ly0 - GEOM.rise[li] * Hl, lx0 - gap * .7, ly1]
    : [lx0 - Math.min(GEOM.small.panelW[li], room), ly0 - 1, lx0 - gap * .6, ly1 + 1];
  const staff = { y1: Math.min(bottom, ly1 + Math.round((big ? GEOM.staff[li] : GEOM.small.staff[li]) * lh)) };
  const L = drawn(G, seed, big ? .8 : .45);
  const marks = flourish({ glyph: L, panel, keep, staff, g: gap, seed, level: li, right: big && li > 2 ? lh * .42 + GEOM.wider[li] : gap });
  return { letter: { M: L, pigment: pig }, marks: marks.map((s, i) => s.kind === 'dot'
    ? { dot: true, p: s.p, r: s.r, col: s.accent ? 'a' : 'b', ink: s.accent ? PIGMENTS[pig].rgb : ink }
    : { pts: s.pts, col: 'b', ink, seed: seed + i * 13, w: s.w * 1.15, rho: s.rho, start: s.start, end: s.end, load: .78 * (s.rho ?? 1), dry: .3, broad: .42, swell: .25, nib: .5 }) };
}
gothic.wider = GEOM.wider;

// ---- Copperplate: the letter in ink, and the writing master's capital flourish round it: one oval on the slant that
// embraces the letter (it runs behind it, showing in its counters and round its left side), entered by a hairline from
// the foot in the margin and closed by a shaded downstroke; a second, smaller oval interlaced in the margin when there is
// room. Kept to the margin it has
function copperplate({ G, lh, big, rich, room }) {
  const [x0, y0, x1, y1] = bbox(G), H = y1 - y0, W = x1 - x0, ground = [], out = [];
  if (!big) { const c = [x0 - Math.min(room * .5, lh * .3), y0 + H * .55]; out.push(cpStroke(cpOval(c, H * .38, H * .15, Math.PI * .6, Math.PI * 1.9, 40), lh * .028, 'a', 3)); return { letter: { M: G, col: 'a' }, marks: out }; }
  // the oval's reach to the left of its centre, for the room the margin leaves
  const left = (a, b) => Math.hypot(a * Math.cos(SLANT), b * Math.sin(SLANT)), b0 = .58;
  let a = H * .6; const cx = x0 + W * .08; while (a > H * .3 && cx - left(a, a * b0) < x0 - room + 3) a *= .94;
  const c = [cx, (y0 + y1) / 2], b = a * b0, ring = cpOval(c, a, b, 0, 2 * Math.PI, 120);
  let k0 = 0; ring.forEach((q, k) => { if (q[1] > ring[k0][1]) k0 = k; });   // its foot: the hairline enters there, moving right
  const loop = [...ring.slice(k0), ...ring.slice(1, k0 + 1)], Q = loop[0], P0 = [Math.max(x0 - room + 3, Q[0] - a * .9), Q[1] - H * .15];
  ground.push(cpStroke([...cubic(P0, [P0[0] + a * .2, Q[1] + H * .04], [Q[0] - a * .3, Q[1]], Q, 24), ...loop.slice(1, -3)], lh * .035, 'a', 3.8));
  if (rich >= .5 && room > a * .9) { const c2 = [c[0] - left(a, b) * .95, c[1] + H * .08], a2 = a * .55; if (c2[0] - left(a2, a2 * .5) > x0 - room + 3)
    out.push(cpStroke(cpOval(c2, a2, a2 * .5, Math.PI * .4, Math.PI * 2.02, 72), lh * .03, 'a', 3.2)); }
  return { letter: { M: G, col: 'a' }, ground, marks: out };
}

// ---- Swiss: the letter in red, a heavy black bar beside it on the grid's line, a hairline at its foot; nothing else
function swiss({ G, lh, big, rich, room }) {
  const [x0, y0, x1, y1] = bbox(G), out = [], d = Math.min(room - 2, big ? lh * .3 : lh * .18), bw = big ? lh * .12 : lh * .07;
  if (d > bw) out.push({ col: 'b', broad: 1, nib: 0, w: bw, load: 1.1, dry: 0, swell: 0, start: 'cut', end: 'cut', pts: [[x0 - d, y0], [x0 - d, y1]] });
  if (big && rich >= .5) out.push(line([[x0 - d, y1 + lh * .25], [x1, y1 + lh * .25]], 'b', .5));
  return { letter: { M: G, col: 'a' }, marks: out };
}

Object.assign(STYLES.gothic, { initial: gothic });
Object.assign(STYLES.copperplate, { initial: copperplate });
Object.assign(STYLES.swiss, { initial: swiss });
