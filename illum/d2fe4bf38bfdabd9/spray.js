// The spray: marks placed first, then stems grown to reach them. Pure geometry, no canvas, so it runs anywhere
// (tests in node, a worker later). Band frame: u along the bar, v away from it.
import { stream, noise2 } from './marks.js';

// ---- growth -----------------------------------------------------------------------------------------------------------
// Rank before placing: the gold ivy and the pen dots are set first, evenly (Poisson disc, Bridson 2007), round the
// flowers; then stems grow from the foot of the band to reach every one of them (open space colonization, Runions
// et al. 2005), so every mark hangs from a twig and the spacing is even by construction. Band frame: u along the
// bar, v away from it, so one routine makes the side border and the phone's headpiece.
export function poisson(len, depth, rad, r, ok, tries = 24) {
  const out = [], cell = rad / Math.SQRT2, gw = Math.ceil(len / cell), gh = Math.ceil(depth / cell), grid = new Int32Array(gw * gh).fill(-1);
  const fits = p => { const i = p[0] / cell | 0, j = p[1] / cell | 0;
    for (let y = Math.max(0, j - 2); y <= Math.min(gh - 1, j + 2); y++) for (let x = Math.max(0, i - 2); x <= Math.min(gw - 1, i + 2); x++) {
      const k = grid[y * gw + x]; if (k >= 0 && Math.hypot(out[k][0] - p[0], out[k][1] - p[1]) < rad) return false; } return true; };
  const add = p => { out.push(p); grid[(p[1] / cell | 0) * gw + (p[0] / cell | 0)] = out.length - 1; };
  // the allowed region may be in pieces (a flower can cut a narrow band in two), so when the front dies out, look
  // for a fresh start anywhere that still fits before giving up
  const active = [];
  const reseed = () => { for (let t = 0; t < 300; t++) { const p = [len * r(), depth * r()]; if (ok(p) && fits(p)) { add(p); active.push(out.length - 1); return true; } } return false; };
  while (active.length || reseed()) {
    const ai = (r() * active.length) | 0, c = out[active[ai]]; let placed = false;
    for (let t = 0; t < tries; t++) { const a = r() * 6.283, d = rad * (1 + r());
      const p = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d];
      if (p[0] < 0 || p[1] < 0 || p[0] >= len || p[1] >= depth || !ok(p) || !fits(p)) continue; add(p); active.push(out.length - 1); placed = true; break; }
    if (!placed) active.splice(ai, 1);
  }
  return out;
}
export function grow(len, depth, heroes, seed) {
  const r = stream(seed, 'grow'), wander = noise2(seed ^ 0x3c), D = 2.6, IVY = 11;
  const clear = (p, m) => p[0] > 6 && p[0] < len - 6 && p[1] > 8 && p[1] < depth - 7 && heroes.every(h => Math.hypot(p[0] - h.c[0], p[1] - h.c[1]) > h.r + m);
  const ivy = poisson(len, depth, 33, r, p => clear(p, 16)).map(p => ({ p, kind: 'ivy', kill: IVY + .5 }));
  const dots = poisson(len, depth, 10.5, r, p => clear(p, 7) && ivy.every(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) > IVY + 5))
    .filter(() => r() < .7).map(p => ({ p, kind: r() < .1 ? 'bezant' : 'dot', kill: 2.5 }));
  const A = [...ivy, ...dots];
  heroes.forEach(h => A.push({ p: h.c, kind: 'hero', kill: h.r + (h.kind === 'strawberry' ? 9 : 4), hero: h }));
  // a stem may not pass through a leaf's room or a flower
  const rooms = A.filter(a => a.kind !== 'dot' && a.kind !== 'bezant'), RG = 24, rgw = Math.ceil(len / RG) + 1, rcell = Array.from({ length: rgw * (Math.ceil(depth / RG) + 1) }, () => []);
  const heroRoom = h => h.r + (h.kind === 'strawberry' ? 8 : 3);
  rooms.forEach(a => { const rr = a.kind === 'ivy' ? IVY : heroRoom(a.hero); for (let j = Math.max(0, (a.p[1] - rr) / RG | 0); j <= (a.p[1] + rr) / RG; j++) for (let i = Math.max(0, (a.p[0] - rr) / RG | 0); i <= (a.p[0] + rr) / RG; i++) rcell[j * rgw + i]?.push(a); });
  // a reached leaf still keeps its room: nothing grows through a leaf, before or after it opens
  const blocked = (q, target) => (rcell[(Math.max(0, q[1]) / RG | 0) * rgw + (Math.max(0, q[0]) / RG | 0)] ?? []).some(a => a !== target && Math.hypot(a.p[0] - q[0], a.p[1] - q[1]) < (a.kind === 'ivy' ? IVY : heroRoom(a.hero)));
  // every stem springs from the bar, unevenly spaced, sweeping off it up or down the band by turns
  const N = [];
  for (let u = 14 + r() * 24, k = 0; u < len - 14; u += 62 + r() * 46, k++) { const s = k % 2 ? 1 : -1;
    N.push({ p: [u, -2.4], parent: -1, dir: [s * (.5 + r() * .35), 1] }); }
  // nodes live in a grid of 12 px cells, so the nearest one is found by looking outward ring by ring
  const G = 12, gw = Math.ceil(len / G) + 2, gh = Math.ceil(depth / G) + 2, cells = Array.from({ length: gw * gh }, () => []);
  const cellOf = p => (Math.max(0, Math.min(gh - 1, (p[1] / G | 0) + 1))) * gw + Math.max(0, Math.min(gw - 1, (p[0] / G | 0) + 1));
  const addNode = n => { N.push(n); cells[cellOf(n.p)].push(N.length - 1); };
  const roots = N.splice(0); roots.forEach(addNode);
  const nearest = (p, max) => {
    const ci = Math.max(0, Math.min(gw - 1, (p[0] / G | 0) + 1)), cj = Math.max(0, Math.min(gh - 1, (p[1] / G | 0) + 1)); let best = -1, bd = max;
    for (let ring = 0; ring <= Math.ceil(max / G) + 1; ring++) {
      if (best >= 0 && (ring - 1) * G > bd) break;
      for (let j = cj - ring; j <= cj + ring; j++) for (let i = ci - ring; i <= ci + ring; i++) {
        if (i < 0 || j < 0 || i >= gw || j >= gh || (Math.abs(i - ci) !== ring && Math.abs(j - cj) !== ring)) continue;
        for (const k of cells[j * gw + i]) { const d = Math.hypot(p[0] - N[k].p[0], p[1] - N[k].p[1]); if (d < bd) { bd = d; best = k; } }
      }
    }
    return [best, bd];
  };
  const ends = [];
  let it = 0;
  for (; it < 900; it++) {
    const pull = new Map(); let any = false;
    for (const a of A) {
      if (a.alive === false) continue;
      const [best, bd] = nearest(a.p, 90); if (best < 0) continue;
      if (bd < a.kill) { a.alive = false; a.node = best; ends.push(a); continue; }
      any = true;
      const pl = pull.get(best) ?? { v: [0, 0], t: a }; pl.v[0] += (a.p[0] - N[best].p[0]) / bd ** 1.5; pl.v[1] += (a.p[1] - N[best].p[1]) / bd ** 1.5; pull.set(best, pl);
    }
    if (!any) break;
    for (const [k, { v, t }] of pull) {
      const n = N[k], l = Math.hypot(v[0], v[1]) || 1, wa = (wander(n.p[0] / 50, n.p[1] / 50) - .5) * .45;
      let d = [v[0] / l + n.dir[0] * .75 - n.dir[1] * wa, v[1] / l + n.dir[1] * .75 + n.dir[0] * wa]; const m = Math.hypot(d[0], d[1]) || 1; d = [d[0] / m, d[1] / m];
      // a stem that meets a leaf's room or a flower steers round it rather than stopping
      let q = null;
      for (const turn of [0, .5, -.5, 1, -1]) { const c = Math.cos(turn), sn = Math.sin(turn), dd = [d[0] * c - d[1] * sn, d[0] * sn + d[1] * c];
        const p2 = [n.p[0] + dd[0] * D, n.p[1] + dd[1] * D]; if (p2[0] < 0 || p2[1] < 0 || p2[0] > len || p2[1] > depth) continue; if (!blocked(p2, t)) { q = p2; d = dd; break; } }
      if (!q) continue;
      const [nb, nd] = nearest(q, D); if (nb >= 0 && nb !== k && nd < D * .7) continue;
      addNode({ p: q, parent: k, dir: d, t: it + 1 });
    }
  }
  N.forEach(n => n.t ??= 0); ends.forEach(e => e.t = N[e.node].t);
  return { N, ends, steps: N.reduce((m, n) => Math.max(m, n.t), 1) };
}
// the tree as strokes: from each root follow the heaviest child; every other child begins a stroke of its own
export function strokes(N) {
  const kids = N.map(() => []), size = new Float32Array(N.length).fill(1);
  N.forEach((n, i) => n.parent >= 0 && kids[n.parent].push(i));
  for (let i = N.length - 1; i >= 0; i--) if (N[i].parent >= 0) size[N[i].parent] += size[i];
  const out = [], owner = new Int32Array(N.length);
  const walk = (i, from) => {
    const pts = from >= 0 ? [N[from].p] : [], ids = []; let k = i;
    while (true) { pts.push(N[k].p); ids.push(k); const ch = kids[k]; if (!ch.length) break;
      ch.sort((a, b) => size[b] - size[a]); for (const c of ch.slice(1)) walk(c, k); k = ch[0]; }
    out.push({ pts, ids, size: size[i], root: from < 0, t0: from >= 0 ? N[from].t : N[i].t, t1: N[k].t }); ids.forEach(id => owner[id] = out.length - 1);
  };
  N.forEach((n, i) => n.parent < 0 && walk(i, -1));
  out.owner = owner; return out;
}
