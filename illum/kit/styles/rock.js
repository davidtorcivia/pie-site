// Rock carving (research/24-pie.md) as a written style of the one library (kit/illum.js: rubricate(root, { style: 'rock' })):
// the Bronze Age panels of Bohuslän (Tanum, Vitlycke, Tanumshede) pecked into granite and painted red, as their figures
// are painted today. A carved alphabet (kit/styles/rock-letters.js: a few swelling strokes, blunt round ends, O and Q
// sun-wheels) is the drop and the line's initial; with the drop, figures from the panels composed on the letter or in its
// open space (a crane on its shoulder, a man under its bowl, a wheel in its counter), never beside it in the reading line,
// and never on a word: each composition is measured against the words before it is kept (initial: keep). Cup marks for
// the paraph, the fillers and the heading's run-out; a sign between a pair for a chapter's break, a panel for the end
// (the sun-ship, dawn, a rider under the sun, the ox cart, two lur-blowers).
// Every piece is built from plain data (a job, kit/styles/rock-print.js) and printed one way: its grooves carved, pecked
// pit by pit and painted stroke by stroke (kit/styles/rock-paint.js), at 1x printed at twice the device's resolution
// and averaged down. A still page's pieces are built by workers (kit/styles/rock-worker.js) while the host waits. Drawn
// (?draw), each piece is pecked pass by pass, then painted stroke by stroke: nothing fades.
//   initial(o) -> { letters, width }   paraph(x, base, u, seed, rich)   filler(x0, x1, yTop, yBase, kind, seed, rich)
//   breakMark(cx, y, measure, rank, seed, rich, u, index, room)   frames.{ quote, aside, pull, figure, code, nav }
//   palette.{ light, dark }   print(made, { dpr, kind, animate, wait }) -> { pours, letters, seq, runs, y0, ready }   timeline(printed, kind, animate)
import { pieceOf, render, writer } from './rock-print.js';
import { dropPlan, lineExt, BRK3 } from './rock-pieces.js';

export const palette = { light: { k: [165, 54, 30] }, dark: { k: [196, 67, 42] } };
const isDark = () => { try { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
const lvOf = rich => Math.max(0, Math.min(4, Math.round(+rich * 4)));
// (a page given its own seed: every piece's seed moved by it, so the page's choices differ, not only its jitter)
const sd = seed => { const v = rock.seeded | 0; return v ? (Math.imul(seed ^ v * 40503, 2654435761) >>> 0) % 100000 + 1 : seed; };
const none = { marks: [], letters: [] };

// ---- placing pieces ---------------------------------------------------------------------------------------------------------------
// a piece: its job (plain data, so a worker can build it) set with its own (0, 0) at ox, oy on the page; it carries its
// extent (the grooves' reach) as y and h, so the host can keep it in the room it is given
const piece = (ox, oy, job, what) => { const e = pieceOf(job).ext();
  return { shape: 'rock', x: ox + e[0], y: oy + e[1], w: e[2] - e[0], h: e[3] - e[1], ex: e[0], ey: e[1], job, what, seed: job[3] ?? 1, bkey: JSON.stringify(job) }; };
const clear = (box, keep, pad) => !keep?.some(r => box[0] - pad < r[2] && box[2] + pad > r[0] && box[1] - pad < r[3] && box[3] + pad > r[1]);

// ---- the initials ---------------------------------------------------------------------------------------------------------------
const letterOf = ch => { const c = String(ch).normalize('NFD')[0].toUpperCase(); return /[A-Z]/.test(c) ? c : 'O'; };
// The drop: the letter's cap on the first line's cap height, its foot on the last baseline; its figures chosen by the
// budget, each kept only if it stands clear of every word on the page (and of the page's edge):
//   plain, the letter alone; modest, a figure in the letter's own space (none over it); usual, the seed's composition;
//   fine, the seed's, and one in the letter's space as well where the seed's stands over it; lavish, two (one over the
//   letter, one in it) and a third where it stands clear of both. A composition that would touch a word is passed over for the next.
// (the cranes, liked and so many: at usual one is taken only where the seed's composition is one, not as a fallback)
function initial({ ch = 'B', G, big = true, seed = 1, rich = .5, keep = [], u = 8 }) {
  const c = letterOf(ch), [x0, y0, , y1] = G.box, capH = y1 - y0, s = sd(seed);
  // (the line's: its ink's top on the cap height, its foot on the baseline, as the drop's: it rises into no line above)
  if (!big) { const e0 = lineExt(c, 20, s), fs = +(20 * capH / (e0[3] - e0[1])).toFixed(2), e = lineExt(c, fs, s), job = ['line', c, fs, s];
    return { marks: [], letters: [piece(x0 - e[0], y0 - e[1], job, 'line:' + c)], width: (inkW(c) + .06) * capH }; }
  // (sized by the letter's own ink: its top on the first line's cap height, its foot (the round ends' reach too) on the last
  // baseline, so nothing of it hangs into the line below)
  const e0 = dropPlan(c, 100, s).lext, H = +(100 * capH / (e0[3] - e0[1])).toFixed(2), lv = lvOf(rich), P = dropPlan(c, H, s), ox = x0 - P.lext[0], oy = y0 - P.lext[1];
  const W = globalThis.document?.documentElement.clientWidth ?? Infinity, fits = q => { const e = q.ext, b = [ox + e[0], oy + e[1], ox + e[2], oy + e[3]]; return !q.none && b[0] >= 2 && b[2] <= W - 2 && clear(b, keep, u * .5); };
  const order = P.comps.length ? [...P.comps.slice(P.def), ...P.comps.slice(0, P.def)] : [], meets = (a, b) => a.ext[0] < b.ext[2] && b.ext[0] < a.ext[2] && a.ext[1] < b.ext[3] && b.ext[1] < a.ext[3];
  let ks = [];
  if (lv === 1) ks = order.filter(q => !q.top && fits(q)).slice(0, 1);
  else if (lv >= 2) { const first = fits(order[0] ?? { none: true }) ? order[0] : order.find(q => !q.crane && fits(q)); if (first) ks = [first];
    if (lv >= 3 && first) { const second = order.find(q => q !== first && (lv >= 4 || first.top) && q.top !== first.top && !meets(q, first) && fits(q)); if (second) ks.push(second); }
    // (lavish: a third where one more stands clear of both, a second crane or a second figure in the letter)
    if (lv >= 4) { const third = order.find(q => !ks.includes(q) && ks.every(p => !meets(q, p)) && fits(q)); if (third) ks.push(third); } }
  const job = ['drop', c, H, s, 20, ks.map(q => q.k)];
  return { marks: [], letters: [piece(ox, oy, job, 'drop:' + c)], width: (inkW(c) + .06) * capH };
}
const inkW = ch => { const e = dropPlan(letterOf(ch), 100, 1).lext; return (e[2] - e[0]) / (e[3] - e[1]); };
initial.width = ch => inkW(ch) + .06;
initial.line = ch => inkW(ch) + .06;
initial.lines = 4; initial.phone = 3; initial.margin = .38;
initial.load = () => (pool(), Promise.resolve());   // (no face: the letters are carved strokes; the workers started)

// ---- the paraph, fillers, breaks ---------------------------------------------------------------------------------------------------
// the paraph, in the indent's gap: a cup on a plain page; else a cup, two cups or a footsole by the seed
function paraph(x, base, u, seed, rich = .5) {
  const fs = +(u * 1.8).toFixed(2), s = sd(seed), form = lvOf(rich) === 0 ? 0 : null, size = fs * .9;
  return { marks: [], letters: [piece(x + (u * 1.65 - size) / 2, base - u * .5 - size * .5, ['paraph', fs, s, form], 'paraph')] };
}
// a paragraph's free end: cup marks in a row (from modest a few, from usual a row running out smaller, at lavish joined by a
// ground channel), only when the line is left well open; a heading's run-out, a row of cups from plain up
function filler(x0, x1, yTop, yBase, kind, seed, rich = .5) {
  if (kind === 'none') return none;
  const u = yBase - yTop, lv = lvOf(rich), room = x1 - x0 - u * .4, s = sd(seed);
  if (kind === 'rule') { if (room < u * 3) return none; const gw = +Math.min(room, u * 22).toFixed(1), h = +(u * 3.4).toFixed(2), H = Math.round(h * .62);
    return { marks: [], letters: [piece(x0 + u * .4, yBase - u * .5 - H / 2, ['runout', gw, h, s], 'runout')] }; }
  if (lv === 0 || room < u * [0, 22, 16, 12, 8][lv]) return none;
  const gw = +Math.min(room, u * 36).toFixed(1), lh = +(u * 3.9).toFixed(2), H = Math.round(lh * .62), form = lv === 1 ? 0 : lv === 4 ? 2 : 1;
  return { marks: [], letters: [piece(x0 + u * .4, yBase - u * .5 - H / 2, ['filler', gw, lh, s, form], 'filler')] };
}
// three ranks: a part's (rank 1), a chapter's (rank 3), the end (rank 2). The budget lifts them: plain, the cups and the sign;
// modest and usual, cups for a part, the sign between a pair for a chapter, a panel at the end; fine, a part's mark rises to
// the sign; lavish, a chapter's to a panel and the end's panel larger. Each kept in the room the page leaves it.
function breakMark(cx, y, measure, rank, seed, rich = .5, u = 8, index = 1, room = null) {
  const lv = lvOf(rich), s = sd(seed), deep = room ? room[1] - room[0] : u * 14, r = rank === 2 ? 3 : rank >= 3 ? 2 : 1;
  const rr = lv === 0 ? Math.max(1, r - 1) : r === 1 && lv >= 3 ? 2 : r === 2 && lv >= 4 ? 3 : r;
  let job, h;
  if (rr === 1) { h = +Math.min(deep * .9 / .6, u * 4).toFixed(1); job = ['brk', 1, 0, h, s, null]; }
  else if (rr === 2) { h = +Math.min(deep * .9 / .95, u * 5.4).toFixed(1); job = ['brk', 2, 0, h, s, null]; }
  else { h = +Math.min(deep * .92, u * (r === 3 && lv >= 4 ? 17 : 13)).toFixed(1); job = ['brk', 3, +Math.min(measure * .92, h * 4.4).toFixed(1), h, s, null]; }
  const p = pieceOf(job), q = piece(cx - p.W / 2, y - p.H / 2, job, 'break' + rr);
  return { marks: [], letters: [q] };
}

// ---- frames ----------------------------------------------------------------------------------------------------------------------
const linesBox = (box, lines) => !lines?.length ? box : [Math.min(...lines.map(L => L.left)), lines[0].top, Math.max(...lines.map(L => L.right)), lines.at(-1).base];
const frames = {
  // a quotation: the world-tree down its margin, beside its lines (from modest)
  quote: ({ box, lines, u, seed = 1, rich = .5 }) => { if (lvOf(rich) < 1) return none; const L = linesBox(box, lines), fs = +(u * 2.45).toFixed(2), h = +(L[3] - L[1] + u * 1.4).toFixed(1), x = L[0] - fs * 1.6 - u * .5;
    return x < 2 ? none : { marks: [], letters: [piece(x, L[1] - u * .6, ['frame', 'quote', 0, h, sd(seed), fs], 'quote')] }; },
  // an aside: a cup at each corner of its box (from usual)
  aside: ({ box, u, seed = 1, rich = .5 }) => { if (lvOf(rich) < 2) return none; const fs = +(u * 2.45).toFixed(2), w = +(box[2] - box[0]).toFixed(1), h = +(box[3] - box[1]).toFixed(1);
    return { marks: [], letters: [piece(box[0], box[1], ['frame', 'aside', w, h, sd(seed), fs, lvOf(rich)], 'aside')] }; },
  // a pull quote: two cranes over it, facing each other, a cup or a sun-wheel between them (from modest)
  pull: ({ cx, yTop, measure, u, seed = 1, rich = .5 }) => { if (lvOf(rich) < 1) return none; const fs = +(u * 1.3).toFixed(2), w = +Math.min(measure * .5, u * 30).toFixed(1), Hp = fs * 2.6 * 1.3;
    return { marks: [], letters: [piece(cx - w / 2, yTop + u * 1.2 - Hp, ['frame', 'pull', w, 0, sd(seed), fs, lvOf(rich)], 'pull')] }; },
  // a figure: a ground rule over it and under its caption (from usual)
  figure: ({ box, cap, u, seed = 1, rich = .5 }) => { if (lvOf(rich) < 2) return none; const fs = +(u * 2.45).toFixed(2), Wp = globalThis.document?.documentElement.clientWidth ?? Infinity;
    const X0 = Math.max(u * .5, box[0] - u * 1.2), X1 = Math.min(Wp - u * .5, box[2] + u * 1.2), Y0 = box[1] - u * 1.6 - fs * .3, Y1 = (cap ?? box[3]) + u * 1.6 + fs * .3;
    return { marks: [], letters: [piece(X0, Y0, ['frame', 'figure', +(X1 - X0).toFixed(1), +(Y1 - Y0).toFixed(1), sd(seed), fs, lvOf(rich)], 'figure')] }; },
  // code: two ground rules at its head (from usual)
  code: ({ box, u, seed = 1, rich = .5 }) => { if (lvOf(rich) < 2) return none; const fs = +(u * 2.45).toFixed(2), w = +(box[2] - box[0] - u * 3.2).toFixed(1);
    return { marks: [], letters: [piece(box[0] + u * 1.6, box[1] + u * .9, ['frame', 'code', w, fs * 3, sd(seed), fs], 'code')] }; },
  // the contents: a cup before each entry
  nav: ({ box, entries, u, seed = 1 }) => { const E = entries.filter(Boolean); if (!E.length) return none; const fs = +(u * 1.8).toFixed(2), size = fs * .9;
    return { marks: [], letters: E.map((e, i) => piece(Math.max(2, box[0] - u * 2.6 - size / 2), e.base - u * .5 - size / 2, ['paraph', fs, sd(seed + i), 0], 'nav')) }; },
};

// ---- printing ----------------------------------------------------------------------------------------------------------------------
// Each piece built at print and painted once, kept by what it is (its job), wherever it stands. A still page's pieces are
// built by the workers while the host waits (it asks, `wait`, and awaits the case's `ready`); without workers (no Worker,
// no OffscreenCanvas, ?worker=0, or one that fails), here. Drawn, a piece is pecked then painted on its own canvas, here.
export const TIME = { build: 0, pieces: 0 };
const MADE = new Map(), CACHE = new Map();
const toCanvas = img => { const c = new OffscreenCanvas(img.width, img.height); c.getContext('2d').putImageData(img, 0, 0); return c; };
function makeHere(b, d, theme) { const t0 = performance.now(), r = render(pieceOf(b.job), theme, d); TIME.build += performance.now() - t0; TIME.pieces++;
  return { canvas: toCanvas(r.img), w: r.img.width, h: r.img.height, ox: r.ox, oy: r.oy }; }
const POOL = { ws: null, jobs: new Map(), id: 0 };
function pool() {
  if (POOL.ws !== null) return POOL.ws; POOL.ws = false;
  try { if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || /[?&]worker=0\b/.test(location.search)) return false;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const dead = w => { w.dead = true; for (const [id, j] of POOL.jobs) if (j.w === w) { POOL.jobs.delete(id); j.no(new Error('rock worker failed')); } if (POOL.ws.every(x => x.dead)) POOL.ws = false; };
    POOL.ws = Array.from({ length: n }, () => { const w = new Worker(new URL('./rock-worker.js', import.meta.url), { type: 'module' }); w.n = 0;
      w.onmessage = ({ data }) => { const j = POOL.jobs.get(data.id); if (!j) return; POOL.jobs.delete(data.id); w.n--; data.error ? j.no(new Error(data.error)) : j.ok(data); };
      w.onerror = () => dead(w); return w; });
  } catch { POOL.ws = false; }
  return POOL.ws;
}
const inWorker = (b, d, theme) => new Promise((ok, no) => { const ws = POOL.ws && POOL.ws.filter(w => !w.dead); if (!ws?.length) return no(new Error('no worker'));
  const w = ws.reduce((a, x) => x.n < a.n ? x : a), id = ++POOL.id; w.n++; POOL.jobs.set(id, { ok, no, w }); w.postMessage({ id, job: b.job, d, theme }); });

function print(made, { dpr = 1, animate = false, kind, wait = false } = {}) {
  const d = Math.min(4, Math.max(1, dpr)), theme = isDark() ? 'dark' : 'light', all = [], seq = [], waits = [];
  for (const b of made.letters ?? []) { if (b.shape !== 'rock') continue;
    const X = b.x - b.ex, Y = b.y - b.ey, key = [theme, d, X.toFixed(1), Y.toFixed(1), b.bkey, animate].join('|');
    let pour = CACHE.get(key);
    if (!pour) {
      pour = { res: d, col: 'k' };
      // (drawn: pecked and painted on its own canvas at the device's resolution; finished, the piece as a still page has it,
      // supersampled at 1x: the same paint in the same place, only its edge antialiased, so nothing moves)
      if (animate) { const cv = new OffscreenCanvas(1, 1), r = writer(pieceOf(b.job), theme, d, cv), x0 = X - r.ox, y0 = Y - r.oy; let last = -1, still = null;
        const fin = g => { still ??= makeHere(b, d, theme); g.drawImage(still.canvas, X - still.ox, Y - still.oy, still.w / d, still.h / d); };
        Object.assign(pour, { x0, y0, w: r.cw, h: r.ch, paint: fin,
          grow: { mode: 'reveal', fn: (g, f) => { if (f >= 1) return fin(g); if (f > last) { last = f; r.w.at(f); } g.drawImage(cv, x0, y0, r.cw / d, r.ch / d); } } }); }
      else {
        const pk = [theme, d, b.bkey].join('|'); let m = MADE.get(pk);
        if (!m || (m.ready && !m.canvas && !wait)) {
          if (wait && pool()) { const e = m = {}; e.ready = inWorker(b, d, theme).then(r => { TIME.pieces++; return Object.assign(e, r); }, () => Object.assign(e, makeHere(b, d, theme))); }
          else m = makeHere(b, d, theme);
          if (MADE.size > 300) MADE.clear(); MADE.set(pk, m); }
        pour.paint = g => g.drawImage(m.canvas, pour.x0, pour.y0, pour.w / d, pour.h / d);
        const place = () => Object.assign(pour, { x0: X - m.ox, y0: Y - m.oy, w: m.w, h: m.h });
        if (m.canvas) place(); else pour.ready = m.ready.then(place); }
      if (CACHE.size > 400) CACHE.clear(); CACHE.set(key, pour); }
    if (pour.ready) waits.push(pour.ready);
    const dur = kind === 'drop' ? 3.4 : kind === 'initial' ? 1.4 : Math.min(2.4, .8 + (b.w + b.h) / 500);
    all.push(pour); seq.push({ pour, d: dur }); }
  const ys = (made.letters ?? []).map(b => b.y);
  return { pours: all, letters: [], seq, runs: [], y0: ys.length ? Math.min(...ys) : 0, ready: waits.length ? Promise.all(waits) : undefined };
}
// a case on the carver's clock: its pieces one after another, each pecked then painted over its own span
function timeline(pr, kind, animate) {
  const own = []; let t = 0;
  for (const e of pr.seq) { const d = animate ? e.d : 0; own.push({ t0: t, t1: t + d, pour: e.pour }); t += d; }
  return { own, u: Math.max(t, .01), cap: kind === 'drop' ? 6 : 3 };
}

export const rock = { label: 'Rock carving', minGap: 2, theme: { rubric: 'rgb(165 54 30)', rubricDark: 'rgb(210 113 89)' },
  setup: () => ({}), kinds: (v, rich) => rich < .25 ? ['none'] : ['row'],
  fillAt: { gap: .6, head: 3, rise: 1 }, steady: ['drop'], panels: BRK3,
  paraph, filler, breakMark, initial, frames, palette, print, timeline };
export default rock;
