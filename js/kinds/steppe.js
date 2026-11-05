// *PIE ornament for initialis (azlen/initialis, MIT): kinds drawn from the steppe world the language came from.
// Loaded with use('js/kinds/steppe.js'); initialis paints their geometry in an initial's inks, with its print pass.
//   band    horses     a frieze of steppe horses walking round the frame
//           cord       the impression of a twisted cord, as on Corded Ware pots
//   pattern herd       rows of small horses over a ground
//           herringbone incised chevron rows, as on steppe pottery
//           pitcomb    rows of comb-stamped pits
//           steps      Andronovo stepped triangles, point to point
//   corner  sunwheel   the four-spoked sun wheel
// Lengths are in the initial's units (1000 across); randomness only from the stream given.

// the wild steppe horse: heavy head, upright bristle mane, jointed legs, full tail; unit box, facing right, y down
const mane = (a, b, n, h) => {
  const out = [], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2), k = i % 2 ? h * (0.65 + 0.35 * Math.sin(t * Math.PI)) * (0.85 + 0.3 * ((i * 37) % 7) / 7) : 0;
    out.push([a[0] + dx * t + nx * k, a[1] + dy * t + ny * k, i % 2 ? 0 : 'c']);
  }
  return out;
};
const HORSE = [
  [.18,.30],[.30,.285],[.44,.29],[.54,.27],
  ...mane([.555,.262],[.725,.088], 13, .03),
  [.745,.045,'c'],[.765,.08],[.80,.10],[.86,.15],[.905,.205],[.918,.24,'c'],[.895,.268,'c'],[.85,.257],[.80,.238],
  [.77,.252],[.745,.29],[.715,.36],[.695,.43],[.69,.47],
  [.695,.53],[.70,.60],[.703,.69],[.712,.722,'c'],[.668,.722,'c'],[.666,.69],[.66,.60],[.655,.535],[.645,.52],
  [.637,.56],[.632,.69],[.638,.722,'c'],[.598,.722,'c'],[.60,.69],[.604,.56],[.598,.512],
  [.52,.518],[.42,.512],
  [.38,.50],[.373,.58],[.388,.64],[.388,.69],[.395,.722,'c'],[.354,.722,'c'],[.355,.69],[.35,.645],[.33,.59],[.322,.535],[.31,.522],
  [.302,.565],[.288,.615],[.293,.69],[.298,.722,'c'],[.258,.722,'c'],[.259,.69],[.255,.615],[.246,.55],
  [.215,.49],[.19,.42],[.172,.36],
  [.155,.355],[.128,.40],[.104,.48],[.098,.56],[.086,.625,'c'],[.07,.60],[.074,.52],[.094,.42],[.13,.335,'c'],
];
function outline(pts, n = 5) {
  const out = [], N = pts.length;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const s1 = p1[2] === 'c', s2 = p2[2] === 'c';
    for (let k = 0; k < n; k++) {
      const t = k / n;
      if (s1 && s2) { out.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); continue; }
      const a = s1 ? p1 : p0, d = s2 ? p2 : p3, t2 = t * t, t3 = t2 * t;
      const f = (A, B, C, D) => .5 * ((2 * B) + (-A + C) * t + (2 * A - 5 * B + 4 * C - D) * t2 + (-A + 3 * B - 3 * C + D) * t3);
      out.push([f(a[0], p1[0], p2[0], d[0]), f(a[1], p1[1], p2[1], d[1])]);
    }
  }
  return out;
}
const HORSE_OUT = outline(HORSE);
// a horse of height h standing on (x, y), turned to angle a (radians; 0 = walking along +x), mirrored if flip
export function horse(x, y, h, a = 0, flip = false) {
  const s = h / 0.722, c = Math.cos(a), sn = Math.sin(a);
  return HORSE_OUT.map(([u, v]) => {
    let X = (u - 0.5) * s, Y = (v - 0.722) * s;
    if (flip) X = -X;
    return [x + X * c - Y * sn, y + X * sn + Y * c];
  });
}

const TAU = Math.PI * 2;

export default [
  {
    family: 'band', name: 'horses',
    // a procession round the frame along its inner edge: each horse turned to the band's direction, its hooves on
    // the inner rule (so the bottom run is upside down, as on a carved border read by turning the panel)
    draw({ out, along, w }) {
      for (const p of along(w * 1.5)) {
        const nx = -Math.sin(p.a), ny = Math.cos(p.a), h = w * 0.78;
        out.polys.push(horse(p.x + nx * w * 0.44, p.y + ny * w * 0.44, h, p.a));
      }
    },
  },
  {
    family: 'band', name: 'cord',
    draw({ out, along, w }) {
      for (const p of along(w * 0.42)) {
        const c = Math.cos(p.a), s = Math.sin(p.a), nx = -s, ny = c, q = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10 - .5, u = t * w * 0.5 + Math.sin(t * Math.PI) * w * 0.08, v = t * w * 0.86, bulge = Math.cos(t * Math.PI) * w * 0.11;
          q.push([p.x + c * (u + bulge) + nx * v, p.y + s * (u + bulge) + ny * v]);
        }
        for (let i = 10; i >= 0; i--) {
          const t = i / 10 - .5, u = t * w * 0.5 + Math.sin(t * Math.PI) * w * 0.08, v = t * w * 0.86, bulge = Math.cos(t * Math.PI) * w * 0.11;
          q.push([p.x + c * (u - bulge * .2) + nx * v, p.y + s * (u - bulge * .2) + ny * v]);
        }
        out.polys.push(q);
      }
    },
  },
  {
    family: 'pattern', name: 'herd',
    geometry({ box, s, out }) {
      const h = s * 2.2, gx = h * 2.1, gy = h * 1.9;
      for (let y = box.y0 + gy * .8, row = 0; y < box.y1 + gy; y += gy, row++)
        for (let x = box.x0 - gx + (row % 2) * gx * .5; x < box.x1 + gx; x += gx) out.polys.push(horse(x, y, h, 0, row % 2 === 1));
    },
  },
  {
    family: 'pattern', name: 'herringbone',
    geometry({ box, s, out }) {
      const row = s * 2.4, gap = s * .9;
      for (let y = box.y0 - row, k = 0; y < box.y1 + row; y += row, k++) {
        const d = k % 2 ? 1 : -1;
        for (let x = box.x0 - row; x < box.x1 + row; x += gap) out.lines.push([[x, y + row * .85], [x + d * row * .55, y + row * .15]]);
      }
    },
  },
  {
    family: 'pattern', name: 'pitcomb',
    geometry({ box, s, out, r }) {
      const g = s * 1.5;
      for (let y = box.y0, row = 0; y < box.y1 + g; y += g, row++)
        for (let x = box.x0 + (row % 2) * g / 2; x < box.x1 + g; x += g) out.dots.push([x + (r() - .5) * g * .15, y + (r() - .5) * g * .15, g * (.17 + r() * .06)]);
    },
  },
  {
    family: 'pattern', name: 'steps',
    geometry({ box, s, out }) {
      const st = s * 0.9, n = 4, H = st * n, W = st * n * 2;
      for (let y = box.y0 - H, row = 0; y < box.y1 + H; y += H * 1.5, row++)
        for (let x = box.x0 - W + (row % 2) * W / 2; x < box.x1 + W; x += W) {
          const q = [[x, y + H]];
          for (let i = 0; i < n; i++) { q.push([x + i * st, y + H - (i + 1) * st]); q.push([x + (i + 1) * st, y + H - (i + 1) * st]); }
          for (let i = n - 1; i >= 0; i--) { q.push([x + W - (i + 1) * st, y + H - i * st]); q.push([x + W - i * st, y + H - i * st]); }
          q.push([x + W, y + H]);
          out.polys.push(q);
        }
    },
  },
  {
    family: 'corner', name: 'sunwheel',
    draw({ out, corners, s }) {
      for (const [cx, cy] of corners) {
        const R = s * .48, ring = [], inner = [];
        for (let i = 0; i <= 40; i++) { const t = i / 40 * TAU; ring.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]); }
        for (let i = 40; i >= 0; i--) { const t = i / 40 * TAU; inner.push([cx + Math.cos(t) * R * .78, cy + Math.sin(t) * R * .78]); }
        out.polys.push([...ring, ...inner]);
        for (let k = 0; k < 4; k++) {
          const t = k / 4 * TAU + TAU / 8, ex = Math.cos(t), ey = Math.sin(t), px = -ey * R * .08, py = ex * R * .08;
          out.polys.push([[cx + px, cy + py], [cx + ex * R * .8 + px, cy + ey * R * .8 + py], [cx + ex * R * .8 - px, cy + ey * R * .8 - py], [cx - px, cy - py]]);
        }
        out.dots.push([cx, cy, R * .2]);
      }
    },
  },
];
