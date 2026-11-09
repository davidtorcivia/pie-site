// PIE · B, the rock: a carved alphabet, A-Z, in the Tanum hand (research/24-pie.md, stage 3). Not a font: each capital is
// a few strokes, each a skeleton with a width profile, pecked and painted along its length (kit/styles/rock-pieces.js), so
// ?draw carves and paints it stroke by stroke.
// The family's logic, after the panels' own figures:
//   strokes swell to a heavy body and thin toward their joins and turns, 3-4x within a letter (the figures run 3-7x; a
//   letter keeps to the narrower end so it stays a letter); a stem is ~.22 of the cap height at its heaviest, a joining
//   limb ~.07; ends are blunt and round (the carver's last pits), the heavier end carried at the foot
//   proportions: Archivo's (wide, round bowls); no serifs, no squared corners: a corner is two strokes meeting
//   Tanum's vocabulary, where it serves the form: O and Q are sun-wheels (ring and cross), U is a hull with its prow and
//   stern curled up, C G J S end in cup marks, E F carry their arms as crew strokes do (rising a little), Y is the
//   world-tree's fork, W is a ship's double hull seen end on (by choice, not a citation)
// Coordinates: x from 0 to the letter's width w, y from 0 (cap) to 1 (baseline); widths in cap heights.
// A stroke: {p: points, w: widths (one per point), c: true for a curve through the points (Catmull-Rom), cupA/cupB: a
// cup mark at that end}; a letter may add {wheel: [cx, cy, R]} (its counter a sun-wheel's spokes).

const S = .2, M = .15, T = .1;   // stem, middle, thin (stage 12: the contrast narrowed, 2:1, so the family keeps one weight and its joins stay full)
export const ALPHA = {
  A: { w: .82, s: [{ p: [[.04, 1], [.41, 0]], w: [S, T + .02] }, { p: [[.41, 0], [.78, 1]], w: [T + .02, S + .02] }, { p: [[.2, .64], [.62, .64]], w: [T, T + .02] }] },
  B: { w: .7, s: [{ p: [[.1, 0], [.1, .5], [.1, 1]], w: [S - .02, S - .05, S] }, { p: [[.1, .02], [.42, 0], [.58, .2], [.42, .45], [.1, .48]], w: [T, M, M + .03, M - .02, T], c: 1 }, { p: [[.1, .5], [.48, .52], [.66, .75], [.48, .98], [.1, 1]], w: [T, M, S - .01, M, T], c: 1 }] },
  C: { w: .72, s: [{ p: [[.64, .17], [.4, .01], [.08, .3], [.08, .7], [.4, .99], [.66, .84]], w: [T + .02, M - .02, S, S, M, T + .03], c: 1, cupA: 1 }] },
  D: { w: .76, s: [{ p: [[.1, 0], [.1, 1]], w: [S - .02, S] }, { p: [[.1, .02], [.46, .04], [.72, .5], [.46, .96], [.1, 1]], w: [T, M, S, M, T], c: 1 }] },
  E: { w: .64, s: [{ p: [[.11, 0], [.11, .5], [.11, 1]], w: [S - .03, S - .04, S] }, { p: [[.11, .03], [.58, -.03]], w: [M, T] }, { p: [[.11, .5], [.48, .46]], w: [M - .02, T] }, { p: [[.11, .98], [.62, .95]], w: [M + .02, T + .02] }] },
  F: { w: .6, s: [{ p: [[.11, 0], [.11, .5], [.11, 1]], w: [S - .03, S - .04, S + .01] }, { p: [[.11, .03], [.58, -.03]], w: [M, T] }, { p: [[.11, .5], [.48, .46]], w: [M - .02, T] }] },
  G: { w: .76, s: [{ p: [[.66, .17], [.42, .01], [.08, .3], [.08, .7], [.42, .99], [.68, .82], [.68, .56]], w: [T + .02, M - .02, S, S, M, M - .02, T + .02], c: 1, cupA: 1 }, { p: [[.44, .56], [.7, .56]], w: [T, M - .03] }] },
  H: { w: .76, s: [{ p: [[.1, 0], [.1, 1]], w: [S - .03, S] }, { p: [[.66, 0], [.66, 1]], w: [S - .03, S] }, { p: [[.1, .5], [.66, .5]], w: [T + .02, T + .02] }] },
  I: { w: .3, s: [{ p: [[.15, 0], [.15, .5], [.15, 1]], w: [S - .02, S - .07, S + .01] }] },
  J: { w: .56, s: [{ p: [[.44, 0], [.44, .68], [.3, .97], [.07, .82]], w: [S - .03, S, M, T + .02], c: 1, cupB: 1 }] },
  K: { w: .72, s: [{ p: [[.1, 0], [.1, 1]], w: [S - .03, S] }, { p: [[.64, 0], [.12, .56]], w: [T + .02, M - .02] }, { p: [[.28, .42], [.68, 1]], w: [T + .02, S] }] },
  L: { w: .6, s: [{ p: [[.11, 0], [.11, .98]], w: [S - .03, S] }, { p: [[.11, .97], [.6, .95]], w: [M + .02, T + .02] }] },
  M: { w: .92, s: [{ p: [[.06, 1], [.11, 0]], w: [S, M] }, { p: [[.11, 0], [.46, .66]], w: [M - .02, T] }, { p: [[.46, .66], [.81, 0]], w: [T, M - .02] }, { p: [[.81, 0], [.86, 1]], w: [M, S] }] },
  N: { w: .76, s: [{ p: [[.1, 1], [.1, 0]], w: [S, M] }, { p: [[.1, 0], [.66, 1]], w: [M - .02, M] }, { p: [[.66, 1], [.66, 0]], w: [T + .02, S - .04] }] },
  O: { w: .84, s: [{ p: [[.42, .0], [.8, .5], [.42, 1], [.04, .5], [.42, .0]], w: [M - .02, S - .02, M + .02, S, M - .02], c: 1, closed: 1 }], wheel: [.42, .5, .28] },
  P: { w: .68, s: [{ p: [[.1, 0], [.1, 1]], w: [S - .03, S] }, { p: [[.1, .02], [.44, 0], [.64, .26], [.44, .52], [.1, .54]], w: [T, M, S - .02, M - .02, T], c: 1 }] },
  Q: { w: .86, s: [{ p: [[.42, .0], [.8, .5], [.42, 1], [.04, .5], [.42, .0]], w: [M - .02, S - .02, M + .02, S, M - .02], c: 1, closed: 1 }, { p: [[.5, .78], [.88, 1.08]], w: [T + .02, M + .02] }], wheel: [.42, .5, .28] },
  R: { w: .72, s: [{ p: [[.1, 0], [.1, 1]], w: [S - .03, S] }, { p: [[.1, .02], [.44, 0], [.64, .25], [.44, .5], [.1, .52]], w: [T, M, S - .02, M - .02, T], c: 1 }, { p: [[.34, .5], [.7, 1]], w: [T + .02, S] }] },
  S: { w: .66, s: [{ p: [[.58, .14], [.34, 0], [.1, .22], [.34, .48], [.58, .74], [.34, 1], [.07, .86]], w: [T + .02, M - .02, S - .03, M - .03, S, M - .02, T + .02], c: 1, cupA: 1, cupB: 1 }] },
  T: { w: .74, s: [{ p: [[.02, .04], [.37, 0], [.72, .04]], w: [M - .02, M, M - .02], c: 1 }, { p: [[.37, .02], [.37, 1]], w: [M, S + .02] }] },
  U: { w: .78, s: [{ p: [[-.04, -.04], [.08, .08], [.1, .62], [.39, 1], [.68, .62], [.7, .08], [.82, -.04]], w: [T, M + .02, S - .02, S + .02, S - .02, M + .02, T], c: 1 }] },
  V: { w: .78, s: [{ p: [[.03, 0], [.39, 1]], w: [S, T + .02] }, { p: [[.39, 1], [.75, 0]], w: [T + .02, M - .01] }] },
  W: { w: 1.04, s: [{ p: [[.0, 0], [.26, 1]], w: [S, T + .02] }, { p: [[.26, 1], [.52, .24]], w: [T + .02, T] }, { p: [[.52, .24], [.78, 1]], w: [T, T + .02] }, { p: [[.78, 1], [1.04, 0]], w: [T + .02, S - .02] }] },
  X: { w: .76, s: [{ p: [[.05, 0], [.71, 1]], w: [M, S] }, { p: [[.69, 0], [.07, 1]], w: [T + .02, M] }] },
  Y: { w: .76, s: [{ p: [[.04, 0], [.38, .54]], w: [S - .02, T + .02] }, { p: [[.72, 0], [.38, .54]], w: [M - .02, T + .02] }, { p: [[.38, .52], [.38, 1]], w: [M - .02, S] }] },
  Z: { w: .7, s: [{ p: [[.06, .04], [.64, 0]], w: [M, M - .02] }, { p: [[.64, .02], [.06, .98]], w: [T + .02, M] }, { p: [[.06, .98], [.66, .95]], w: [S - .04, M - .02] }] },
};

// a curve through points (Catmull-Rom, n samples a span), widths following
function curve(p, w, closed, n = 16) { const P = [], Wd = [], m = p.length, at = i => closed ? p[((i % (m - 1)) + (m - 1)) % (m - 1)] : p[Math.max(0, Math.min(m - 1, i))];
  for (let i = 0; i < m - 1; i++) { const p0 = at(i - 1), p1 = p[i], p2 = p[i + 1], p3 = at(i + 2);
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      P.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      Wd.push(w[i] + (w[i + 1] - w[i]) * (t * t * (3 - 2 * t))); } }
  P.push(p[m - 1]); Wd.push(w[m - 1]); return [P, Wd]; }
function straight(p, w, n = 8) { const P = [], Wd = []; for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < n; k++) { const t = k / n; P.push([p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t]); Wd.push(w[i] + (w[i + 1] - w[i]) * t); }
  P.push(p.at(-1)); Wd.push(w.at(-1)); return [P, Wd]; }

// a letter laid out at (x0, y0), cap height H: its strokes in CSS px, each [{p, w, cupA, cupB}], the hand's wander added
// (each stroke's course off its line by ~.03 of its width, its width breathing ±6 %), and its wheel if it has one.
export function letterStrokes(ch, x0, y0, H, r) { const L = ALPHA[ch] ?? ALPHA.I, out = [];
  for (const s of L.s) { let [P, Wd] = s.c ? curve(s.p, s.w, s.closed) : straight(s.p, s.w);
    const ph = r() * 6.28, n = P.length;
    P = P.map(([x, y], i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, o = .015 * Wd[i] * Math.sin(ph + i / n * 4);
      return [x0 + (x - dy / l * o) * H, y0 + (y + dx / l * o) * H]; });
    Wd = Wd.map((_, i) => { let a = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { a += Wd[j]; k++; } return a / k; })   // (the width eased along the stroke: no knots where two spans meet)
      .map((v, i) => v * H * (1 + .04 * Math.sin(ph * 1.7 + i / n * 4)));
    out.push({ p: P, w: Wd, cupA: s.cupA, cupB: s.cupB }); }
  return { strokes: out, wheel: L.wheel ? [x0 + L.wheel[0] * H, y0 + L.wheel[1] * H, L.wheel[2] * H] : null, W: L.w * H };
}
export const letterWidth = ch => (ALPHA[ch] ?? ALPHA.I).w;

