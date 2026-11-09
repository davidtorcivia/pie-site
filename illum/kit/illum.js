// Rubricate (research/10-rubricate.md): the rubricator's pass over a finished text, as one act. One walk over the host's
// markup finds the cases (drop and line initials; paraphs, line-fillers and the breaks between parts; the six framed
// boxes), each is made by its style in the one registry (STYLES in kit/wayfinding.js, with kit/initials.js and
// kit/frames.js), and the whole is written as one score, in reading order, by one hand.
//
//   const r = rubricate(root, { style, rich, scale, theme, draw, ink, seed, host, select, on, initial, frame });
//   r.redraw(opts); r.destroy();
//
//   root    the text (an article); host: the positioned box the ink layers go in (default root.offsetParent)
//   style   a key of STYLES; data-style on root or any element inside overrides, as do data-rich and data-scale
//   rich    0..1, what the rubricator was paid to do; scale .5..2, the ornament's size independent of the text's (a
//           written style's .6..1.6: its hand larger or smaller, size and weight together; a drop keeps its depth)
//   theme   'auto' (data-theme on <html>, else the reader's system) | 'light' | 'dark'. The host owns --paper, --ink and
//           --rubric; the ornament reads --paper and colours only its own marks. It sets --orn on root (the scale), for
//           a host that wants its paragraph indent to widen with a larger paraph
//   draw    'still' | 'now' (written in reading order, compressed to ~14 s) | 'read' (each ornament written when its
//           line comes 15% into the viewport). Under prefers-reduced-motion always still
//   ink     'medium' (the ink engine, kit/writer.js: the penwork's hairlines written with a round quill in a dry ink;
//           fills, points and the painted letter stay with kit/marks.js) | 'pen' (the stamped pen throughout; also
//           what 'medium' falls back to without WebGL2)
//   audit   true: state.drawn holds every mark's outline for kit/audit.js (default: ?audit in the page's address). cache: false
//           draws live every time (also ?nocache); baked: the URL of a bake made by tools/bake.mjs (or data-baked on root;
//           default kit/bake.json, which a built site ships: tools/build-site.sh)
//   seed    default: a hash of the text (one given varies a written style's choices too: S.seeded). on(state, info): 'drawn' (still: { grow, draw } ms), 'reading', 'written'
//   initial, frame   a written style's options for its initials and its frames (Astrology's { set, title }, { form }); an
//           element's own data-* (data-set, data-title, data-form) override them
//   view    'specimen' (the style as a pattern book) | 'sweep' (every style's paraph over thirty seeds); the text hidden
//
// Host markup: `.ini` (an initial in the line), `.ini.drop[data-lines]` (a drop initial); `section.book` and
// `section.chapter` (a book is opened by a rank-2 break above its heading, a chapter after its book's first by a rank-1
// break; within a chapter each paragraph after the first takes a paraph, and the heading and every paragraph a filler
// in the free end of its last line); outside chapters `p.par` (a paraph), `.fill` (a filler), `hr` and
// `.break[data-rank]` (a break); `blockquote`, `figure`, `pre`, `.pull`, `aside`, `nav` (the frames); `h2` (outside
// chapter sections, a chapter's heading: what numbers a written style's chapters). All in SELECT.
// Every mark is on aria-hidden canvases behind the text (the medium's working window lies over it while it writes);
// the text is untouched apart from the drop initial's size and float.
import { pen, dot, paintField, PIGMENTS, fnv, stream } from './marks.js';
import { STYLES } from './registry.js';
import { libraryHash, fingerprint, lookup, manifest, paint, remember, hashText } from './cache.js';
// Loaded when a page needs them, not before: the pilot registry (kit/wayfinding.js, with kit/initials.js and kit/frames.js),
// each written style (kit/styles/*.js, with its faces), and the ink engine (kit/writer.js, kit/inkletter.js). A page drawn
// from the store (kit/cache.js) loads none of them. kit/all.js loads everything at once, for a page that lists every style.
let paletteOf, grammar, lift;                                                     // kit/wayfinding.js's
let createWriter, supported = () => false, inkLetter, letterWriter, settle = () => {}, warmInk, sweepIn;   // the engine's

// The written styles (kit/styles/*.js) join the registry. A written style's marks are in the writer's own terms, at page
// size: strokes { pts (page px), w (the nib's edge), col (a key of its palette, 'k' | 'r'), hair, angle?, press?, rho? },
// written by the ink engine as runs of one colour and one nib; its colours are its own palette.{ light, dark } (rgb by
// col); its cases are placed as tests/blackletter.html placed them (in the page's px, by the x-height u), not made at unit
// size and scaled as a registry style's are. Its initial may be a typeface letter (initial.width, initial.load, and
// initial.line: the width of one in the line, initial.margin: the gap to the words in line heights; see setInitials).
// A part may return its marks alone, or { marks, fills?, letters? } (marks may nest); a printed style (Tarot) gives
//   print(made, { dpr, kind, u, y, seed }) -> { pours, letters, runs, y0 }: its fills as masks, one per colour ({ M, w, h,
//     x0, y0, res, col, wet?, dry? }), poured into the ink engine (inkLetter) under its line; its lettering as masks
//     ({ M, ..., red?, redCol?, redWet?, redDry? }, laid as a typeface initial's letter is); its line in runs
//   timeline(printed, kind, animate) -> { own: [{ t0, t1, run | pour | letter }], u, cap }: the case on a hand's clock
//     (seconds, before it is held to its cap): in a still only the runs' lengths count, and the pours and the lettering
//     are laid first, under every line; written, a pour is swept in beneath the page's ink (sweepIn)
// fillAt { gap, head, rise } (x-heights): where its line-filler starts after the words, the room a heading's needs, its
// height. The registry passes the chapter's number to a written paraph (its 6th argument) and the part's number to a
// break (its 8th), and n, a quotation's foot, a figure's caption to the frames.
// A printed style's timeline may mark an entry `over` (Occult's lettering, written into the figure once it is struck):
// laid after the lines, not under them. Its `steady` kinds are never hurried as you read (Occult's drop initial); its
// `inks` (an order of its colours) lay a still's lines ink by ink down the whole of what is drawn, as a copyist struck
// every figure in black before taking up the red.
// A drop initial is as deep as its host's data-lines, else (on a narrow measure, under 28 ems) its style's initial.phone,
// else its style's initial.lines (Astrology's figure: 6), else 3. A
// written style's frame is given its element's data-* (a figure's data-form) and rubricate's `frame` options before its
// measure. A print is told whether the case is written as you watch (animate): a still may lay small lettering of one ink
// as one pour per cluster (Astrology's), written each is its own.
// A written paraph is given, after the chapter's number, its own number among the paragraphs it marks (Draft's balloon
// calls out item k); a written code frame its rows (the lines measured in the code element's own type) and the tops of
// the code's own lines (starts: a line the box wraps runs on unruled).
// (Order matters: the registry's style list keeps Draft, Occult, Astrology and Tarot where they stood, before Blackletter;
// Draft stands where Cyber stood, and ?style=cyber, retired, is Draft.)
export const WRITTEN = { draft: './styles/draft.js', occult: './styles/occult.js', astrology: './styles/astrology.js', tarot: './styles/tarot.js', blackletter: './styles/blackletter.js', kelmscott: './styles/kelmscott.js', nouveau: './styles/nouveau.js', insular: './styles/insular.js', deco: './styles/deco.js', choirbook: './styles/choirbook.js', copperplate: './styles/copperplate.js', rock: './styles/rock.js' };
const own = {}; let regP = null, engP = null;
const put = k => { STYLES[k] = own[k]; if (k === 'draft') Object.defineProperty(STYLES, 'cyber', { value: own.draft, enumerable: false, configurable: true }); };
export const loadRegistry = () => regP ??= Promise.all([import('./wayfinding.js'), import('./initials.js'), import('./frames.js')])
  .then(([w]) => { ({ paletteOf, grammar, lift } = w); for (const k of Object.keys(WRITTEN)) if (own[k]) put(k); });   // (the pilots' placeholders give way to what is loaded)
// the styles these keys name, and the registry if any of them is a pilot (an unknown key is drawn as Gothic, a pilot)
export async function loadStyles(keys) {
  keys = [...new Set(keys.filter(Boolean).map(k => k === 'cyber' ? 'draft' : k))];
  if (keys.some(k => !WRITTEN[k] && !isWritten(STYLES[k])) || !keys.length) await loadRegistry();
  const mods = await Promise.all(keys.filter(k => WRITTEN[k]).map(async k => [k, own[k] ??= (await import(WRITTEN[k])).default]));
  if (mods.some(([, m]) => !isWritten(m))) await loadRegistry();   // (a module drawn on the registry's path: the choir book)
  for (const k of Object.keys(WRITTEN)) if (mods.some(([m]) => m === k)) put(k);   // (in the registry's order)
}
export const loadAll = async () => { await loadRegistry(); await loadStyles(Object.keys(WRITTEN)); };
const loadEngine = () => engP ??= Promise.all([import('./writer.js'), import('./inkletter.js')])
  .then(([w, i]) => { ({ createWriter, supported } = w); ({ inkLetter, letterWriter, settle, warmInk, sweepIn } = i); });
const isWritten = S => !!S?.palette;
// a written part's output as { marks, fills?, letters?, letter? }: given as its marks alone, or wrapped once more
const asMade = m => Array.isArray(m) ? { marks: m } : m.marks && !Array.isArray(m.marks) ? { ...m, ...m.marks } : m;

export const SELECT = { initial: '.ini', drop: '.ini.drop', quote: 'blockquote', figure: 'figure', code: 'pre', pull: '.pull', aside: 'aside', nav: 'nav',
  book: '.book', chapter: '.chapter', heading: 'h2', paraph: 'p.par', filler: '.fill', break: 'hr, .break', text: 'h1, h2, h3, h4, h5, h6, p, li, figcaption, pre, dt, dd' };
const FONT = (w, px) => `${w} ${px}px "EB Garamond"`;
const metric = (() => { let m; return () => m ??= (() => { const c = document.createElement('canvas').getContext('2d'); c.font = FONT(600, 100); const H = c.measureText('H');
  c.font = FONT(400, 100); return { asc: H.fontBoundingBoxAscent / 100, desc: H.fontBoundingBoxDescent / 100, cap: H.actualBoundingBoxAscent / 100, x: c.measureText('x').actualBoundingBoxAscent / 100 }; })(); })();
const fontMetric = {}, metricOf = font => fontMetric[font] ??= (() => { const c = document.createElement('canvas').getContext('2d'); c.font = font; const m = c.measureText('x'), M = c.measureText('H');
  return { asc: M.fontBoundingBoxAscent, x: m.actualBoundingBoxAscent }; })();
const cssRgb = s => s.match(/\d+/g).slice(0, 3).map(Number);
const arclen = p => p.reduce((a, q, i) => i ? a + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
export const levelOf = rich => Math.max(0, Math.min(4, Math.round(+rich * 4)));

// ---- measuring (after 03, 06 and 07) ---------------------------------------------------------------------------------------
// a drop initial sized so its top meets the first line's cap height and its foot sits on the last line's baseline; the
// float cut to exactly n lines (wider on the text side by the style's own amount at a lavish budget)
// A typeface initial (its style's initial.width(ch, opts): the capital's width in cap heights, known before layout) is
// floated as wide as that capital, a little nearer the words (after tests/blackletter.html); one in the line is set as
// wide as its capital too. opts: the style's initial options (rubricate's `initial`, e.g. { face, form })
export function setInitials(root, { style, rich = .5, select = SELECT, initial: io = {} } = {}) {
  const M = metric(), styleOf = s => STYLES[s.closest('[data-style]')?.dataset.style] ?? STYLES[style];
  for (const s of root.querySelectorAll(select.drop)) {
    const p = s.closest('p') ?? s.parentElement, cs = getComputedStyle(p), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight), S = styleOf(s);
    // (on a narrow measure, under 28 ems, the style's own narrow depth: a deep drop there leaves the words beside it a column of two or three)
    const narrow = S.initial?.phone && root.clientWidth < fs * 28 && S.initial.phone, n = +s.dataset.lines || narrow || S.initial?.lines || 3;
    const bodyCap = fs * M.cap, base = (lh - (M.asc + M.desc) * fs) / 2 + M.asc * fs, F = ((n - 1) * lh + bodyCap) / M.cap, top = (n - 1) * lh + base - F * ((1 - M.asc - M.desc) / 2 + M.asc);
    const lv = levelOf(s.closest('[data-rich]')?.dataset.rich ?? rich);
    if (S.initial?.width) { Object.assign(s.style, { fontSize: F + 'px', marginTop: top + 'px', height: (n * lh - 2 - top) + 'px', display: 'block', width: (S.initial.width(s.textContent, io) * (F * M.cap)) + 'px',
      marginRight: Math.round(lh * (S.initial.margin ?? .38) + (S.initial.wider?.[lv] ?? 0)) + 'px', marginLeft: '0' }); continue; }
    Object.assign(s.style, { fontSize: F + 'px', marginTop: top + 'px', height: (n * lh - 2 - top) + 'px', marginRight: Math.round(lh * .42 + (S.initial?.wider?.[lv] ?? 0)) + 'px', marginLeft: '-1px', display: '', width: '' });
  }
  for (const s of root.querySelectorAll(select.initial)) { if (s.matches(select.drop)) continue; const S = styleOf(s);
    if (!S.initial?.width) { Object.assign(s.style, { display: '', width: '' }); continue; }
    if (getComputedStyle(s).display === 'inline') s.style.display = 'inline-block';
    s.style.width = ((S.initial.line ?? S.initial.width)(s.textContent, io) * parseFloat(getComputedStyle(s).fontSize) * M.cap) + 'px'; }
}
// a typeface initial's box: from the cap line to the baseline, from its left edge, w cap heights wide
function capBox(span, o, w) {
  const M = metric(), F = parseFloat(getComputedStyle(span).fontSize), rg = document.createRange(); rg.selectNodeContents(span); const rc = rg.getClientRects()[0];
  const base = rc.top - o.top + M.asc * F + (rc.height - (M.asc + M.desc) * F) / 2;
  return [rc.left - o.left, base - M.cap * F, rc.left - o.left + w * M.cap * F, base];
}
// the letter as a coverage mask at `res` cells per px, its top-left on the page, and its ink box
export function glyphOf(span, origin, res = 4) {
  const M = metric(), F = parseFloat(span.style.fontSize || getComputedStyle(span).fontSize), rg = document.createRange(); rg.selectNodeContents(span);
  const rc = rg.getClientRects()[0], x = rc.left - origin.left, baseline = rc.top - origin.top + M.asc * F;
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); c.font = FONT(600, F);
  const m = c.measureText(span.textContent), pad = 4, x0 = Math.floor(x - m.actualBoundingBoxLeft - pad), y0 = Math.floor(baseline - m.actualBoundingBoxAscent - pad);
  const w = Math.ceil((x + m.actualBoundingBoxRight + pad - x0) * res), h = Math.ceil((baseline + m.actualBoundingBoxDescent + pad - y0) * res);
  c.canvas.width = w; c.canvas.height = h; c.setTransform(res, 0, 0, res, -x0 * res, -y0 * res); c.font = FONT(600, F); c.fillStyle = '#000'; c.fillText(span.textContent, x, baseline);
  const d = c.getImageData(0, 0, w, h).data, A = new Float32Array(w * h); for (let i = 0; i < w * h; i++) A[i] = d[i * 4 + 3] / 255;
  return { M: A, w, h, x0, y0, res, box: [x - m.actualBoundingBoxLeft, baseline - m.actualBoundingBoxAscent, x + m.actualBoundingBoxRight, baseline + m.actualBoundingBoxDescent], F };
}
// the words, as rects to keep clear of (every line box of every text node, the initials excepted)
export function wordRects(root, origin, pad, select = SELECT) {
  const out = [], tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) { if (n.parentElement.closest(select.initial) || !n.textContent.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) out.push([r.left - origin.left - pad, r.top - origin.top + 2 - pad * .5, r.right - origin.left + pad, r.bottom - origin.top - 2 + pad * .5]); }
  return out;
}
// an element's lines as the browser laid them out: one rect per line box, with its baseline (the frames' measure)
// exact: the baseline found within the line box's own height, and the line's left its leftmost box (a written style's)
export const linesOf = (el, o, exact = false) => { const rg = document.createRange(); rg.selectNodeContents(el); const fs = parseFloat(getComputedStyle(el).fontSize), out = [], M = metric();
  for (const r of rg.getClientRects()) { if (r.width < 1) continue; const t = r.top - o.top, last = out.at(-1);
    if (last && Math.abs(last.top - t) < 3) { last.right = Math.max(last.right, r.right - o.left); if (exact) last.left = Math.min(last.left, r.left - o.left); continue; }
    out.push({ top: t, base: t + (exact ? (r.height - (M.asc + M.desc) * fs) / 2 : 0) + M.asc * fs, left: r.left - o.left, right: r.right - o.left }); }
  return out; };
// every inline box of an element as its own rect (the wayfinding's measure, 06), an initial in it left out
const boxes = (el, o, select = SELECT) => { const rg = document.createRange(); rg.selectNodeContents(el); const ini = el.querySelector(select.initial); if (ini) rg.setStartAfter(ini);
  return [...rg.getClientRects()].filter(r => r.width > .5).map(r => ({ l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top })); };
// the tops of the lines an element's text begins (after each newline: a code's own lines, not the rows a wrap runs on to)
const lineStarts = (el, o) => { const out = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let bol = true;
  for (let n; (n = tw.nextNode());) for (let i = 0; i < n.data.length; i++) { if (n.data[i] === '\n') { bol = true; continue; } if (!bol) continue; bol = false;
    const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (r) out.push(r.top - o.top); }
  return out; };
export const rel = (el, o) => { const r = el.getBoundingClientRect(); return [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top]; };

// ---- marks at the ornament's scale --------------------------------------------------------------------------------------------
// A mark list made at unit size, scaled about an anchor (ax, ay) by the ornament scale (fx: where the anchor was
// generated, for a flush-left break). Strokes thicken in proportion when larger; when smaller they thin only by the
// square root, so a hairline stays a line a pen could draw
function scaled(list, ax, ay, S, fx = ax) {
  if (S === 1 && fx === ax) return list; const f = ([x, y]) => [ax + (x - fx) * S, ay + (y - ay) * S];
  return list.map(m => m.dot ? { ...m, p: f(m.p), r: Math.max(.45, m.r * S) } : { ...m, pts: m.pts.map(f), w: Math.max(.32, m.w * Math.sqrt(S) * (S > 1 ? Math.sqrt(S) : 1)) });
}
const thick = (list, S) => S === 1 ? list : list.map(m => m.dot ? { ...m, r: Math.max(.45, m.r * S) } : { ...m, w: Math.max(.32, m.w * Math.sqrt(S) * (S > 1 ? Math.sqrt(S) : 1)) });
// Curves are subdivided to under a pixel at their drawn size (Hermite through the points), so no corner shows on a
// curve at any scale; a vertex that turns sharply (a zigzag, a chevron, a star) stays a corner, as the pen made it.
export function refine(pts) {
  if (pts.length < 3) return pts; const n = pts.length, out = [pts[0]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const turn = i => { if (i <= 0 || i >= n - 1) return 9; const a = sub(pts[i], pts[i - 1]), b = sub(pts[i + 1], pts[i]), la = Math.hypot(...a), lb = Math.hypot(...b);
    return la < 1e-6 || lb < 1e-6 ? 0 : Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb)))); };
  for (let i = 0; i < n - 1; i++) { const p1 = pts[i], p2 = pts[i + 1], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (L < 1.2) { out.push(p2); continue; }
    const d = sub(p2, p1), m1 = turn(i) < .75 ? sub(pts[i + 1], pts[i - 1]).map(c => c / 2) : d, m2 = turn(i + 1) < .75 ? sub(pts[i + 2], pts[i]).map(c => c / 2) : d, k = Math.ceil(L / .8);
    for (let j = 1; j <= k; j++) { const t = j / k, t2 = t * t, t3 = t2 * t, h1 = 2 * t3 - 3 * t2 + 1, h2 = t3 - 2 * t2 + t, h3 = -2 * t3 + 3 * t2, h4 = t3 - t2;
      out.push([0, 1].map(c => h1 * p1[c] + h2 * m1[c] + h3 * p2[c] + h4 * m2[c])); } }
  return out;
}
// A hairline's square-cut end is right only where it meets another stroke (a join, hidden in it) or closes on itself;
// anywhere else the pen lifts, so a free 'cut' end becomes a taper.
function freeEnds(s, list) {
  if (s.broad >= .5) return { start: s.start, end: s.end };
  const near = (p, self) => list.some(o => o !== self && !o.dot && o.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < (o.w ?? .5) + (s.w ?? .5) + .6));
  const closed = Math.hypot(s.pts[0][0] - s.pts.at(-1)[0], s.pts[0][1] - s.pts.at(-1)[1]) < 1;
  const fix = (e, p) => e === 'cut' && !closed && !near(p, s) ? 'taper' : e;
  return { start: fix(s.start, s.pts[0]), end: fix(s.end, s.pts.at(-1)) };
}

// ---- the walk -------------------------------------------------------------------------------------------------------------------
// Every case under root, made by its style. An item: { el, kind, style, y (its place in reading order), a (the colour
// its 'a' stands for), marks, line (a wayfinding mark: made at unit size, scaled, refined, kept off the words),
// letter?, ground?, ax/ay (a paraph's foot or a break's centre, about which it gives way), redo (a filler's smaller
// remakes) }. The measure for each kind is the one its page was approved with (06 for the wayfinding, 07 for the
// frames, 03 for the initials), so the three looks carry over to the pixel. A written style's case is measured here and
// made when its turn comes: { written: true, make() -> { marks, letter? } } (its measure is tests/blackletter.html's).
function walk(root, sheet, c) {
  const { SEED, sel } = c, o = sheet.getBoundingClientRect(), text = root.getBoundingClientRect(), out = [], s = k => (SEED + k * 7919) >>> 0;
  const at = (el, name, def) => { const h = el.closest(`[data-${name}]`); return h && h !== root && root.contains(h) ? h.dataset[name] : def; };
  const styleAt = el => STYLES[at(el, 'style', c.style)] ? at(el, 'style', c.style) : c.style, richAt = el => Math.max(0, Math.min(1, +at(el, 'rich', c.rich) || 0)),
    scaleAt = el => Math.max(.5, Math.min(2, +at(el, 'scale', c.scale) || 1));
  // a written style's ornament scale: its hand (u, the x-height its marks are drawn to) made larger or smaller, so each
  // mark's size and weight go together, within .6..1.6 (a frame grows out into the margins, a paraph past its indent);
  // a drop initial keeps the depth its host gave it
  const uAt = el => u * Math.max(.6, Math.min(1.6, scaleAt(el)));
  const fs = parseFloat(getComputedStyle(root).fontSize), u = fs * metric().x, g = u * .3, dropped = {};
  const W8 = el => isWritten(STYLES[styleAt(el)]), m8 = rel(root, o), top = el => el.getBoundingClientRect().top - o.top;
  // the chapter an element is in: its section's number among the chapters, else the chapter headings (h2) before it
  const chapters = [...root.querySelectorAll(sel.chapter)], heads = [...root.querySelectorAll(sel.heading)];
  const chapterOf = el => { const ch = el.closest(sel.chapter); return ch ? chapters.indexOf(ch) + 1 : heads.filter(h => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).length; };
  c.u = u;
  // (a written style is told, as it makes a case, the page's own seed when the host gave one (S.seeded; else 0): its
  // choices, which forms, which variants, in what order, are drawn from it, so a page asked for by seed differs in more
  // than its jitter; a page left to its text's seed is drawn as it always was)
  const later = (el, kind, y, make) => { const key = styleAt(el); out.push({ el, kind, style: key, y, written: true, make: () => { STYLES[key].seeded = c.vary; return make(); } }); };
  // initials (03): the letter and the marks round it
  const keep = wordRects(root, o, 3, sel);
  root.querySelectorAll(sel.initial).forEach((span, k) => {
    const key = styleAt(span), S = STYLES[key], big = span.matches(sel.drop), rk = richAt(span);
    // a typeface initial: its letter from the face, laid by the ink engine (inkLetter), the marks round it
    // (its options: rubricate's `initial`, then the element's own data-* attributes, e.g. a card's data-title)
    // (initial.fills: the ornament is the float itself, a card, so its box is the float as laid, not the capital's width)
    if (S.initial?.width) { const box = capBox(span, o, (big ? S.initial.width : S.initial.line ?? S.initial.width)(span.textContent, c.initial)), seed = s(k);
      if (S.initial.fills) box[2] = box[0] + parseFloat(span.style.width);
      return later(span, big ? 'drop' : 'initial', top(span), () => { const ini = S.initial({ ch: span.textContent, G: { box }, keep, big, level: levelOf(rk), rich: rk, seed, room: box[0] - 10, bottom: o.height - 30, res: c.dpr, u: uAt(span), scale: uAt(span) / u, ...c.initial, ...span.dataset });
        return { ...ini, letter: ini.letter?.M ? ini.letter : null }; }); }
    const G = glyphOf(span, o, 4), lh = parseFloat(getComputedStyle(span.closest('p') ?? root).lineHeight);
    const args = { G, keep, lh, u, big, level: levelOf(rk), rich: rk, seed: s(k), room: Math.max(0, G.box[0] - 14), bottom: o.height - 30 };
    const made = S.initial ? S.initial(args) : { letter: { M: G, col: 'a' }, marks: [] };
    out.push({ el: span, kind: big ? 'drop' : 'initial', style: key, a: S.pair[0], seed: args.seed, y: span.getBoundingClientRect().top - o.top, ...made });
  });
  // an initial in the line begins its word: the rest of that word (its own) is the one text its letter may touch (the audit)
  root.querySelectorAll(sel.initial).forEach(span => { if (span.matches(sel.drop)) return; const it = out.find(i => i.el === span), tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    tw.currentNode = span; let n; do n = tw.nextNode(); while (n && span.contains(n));
    const end = n ? n.data.search(/\s|$/) : 0; if (!it || !end) return; const rg = document.createRange(); rg.setStart(n, 0); rg.setEnd(n, end); const r = rg.getBoundingClientRect();
    it.own = [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top]; });
  // the words, to keep clear of
  const TEXT = [], words = []; root.querySelectorAll(sel.text).forEach(el => { const L = boxes(el, o, sel); TEXT.push(...L); words.push(...L); });
  const touches = (x, y, R, near = words) => near.some(b => x + R > b.l - 1.5 && x - R < b.r + 1.5 && y + R > b.t + .5 && y - R < b.b - .5);
  // (a stroke is asked only of the words its box could touch: its points lie in its points' box)
  const hits = s => { if (s.dot) return touches(s.p[0], s.p[1], s.r); const R = s.w / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of s.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const near = words.filter(b => x1 + R > b.l - 1.5 && x0 - R < b.r + 1.5 && y1 + R > b.t + .5 && y0 - R < b.b - .5);
    return near.length > 0 && resampleLine(s.pts, .5).some(([x, y]) => touches(x, y, R, near)); };
  // frames (07): each grown from its box; the ornament scale enlarges the hand (u) and thickens its line. A frame stands
  // in the room its box leaves, which is laid out for the hand at size: smaller, it keeps that room and only thins;
  // larger, it grows only as far as it stays off the words
  // (args: the frame's measure, w: for a written style, which sets its contents' rule further out and reads its lines exactly)
  const frame = (el, kind, args) => { const key = styleAt(el), f = STYLES[key].frames?.[kind], S = scaleAt(el); if (!f) return;
    if (W8(el)) { const a = { ...c.frame, ...el.dataset, ...args(uAt(el), g * uAt(el) / u, richAt(el), true) }; return later(el, kind, top(el), () => ({ marks: f(a) })); }
    let k = Math.max(1, S), m; while (m = thick(f(args(u * k, g * k, richAt(el))), S), k > 1 && m.some(hits)) k = Math.max(1, k - .25);
    out.push({ el, kind, style: key, y: el.getBoundingClientRect().top - o.top, marks: m }); };
  root.querySelectorAll(sel.nav).forEach((nav, k) => { const list = nav.querySelector('ol, ul') ?? nav, nb = rel(list, o), side = nb[0] > 46;
    frame(nav, 'nav', (u, g, rich, w) => ({ box: nb, entries: [...nav.querySelectorAll('li')].map(li => linesOf(li, o, w)[0]), x: nb[0] - u * (w ? 3.2 : 2.2), u, g, seed: s(1 + k), rich, side })); });
  // (and for a written style: the quotation's box, its footer's top, the page's edges and its chapter's number, the figure's caption's foot
  // and its box (caption), the page's edges and the room its margins leave it [top, bottom], the chapter's number (a pull
  // quote's too), an aside's and code's lines)
  root.querySelectorAll(sel.quote).forEach((bq, k) => { const b = rel(bq, o), ft = bq.querySelector('footer');
    frame(bq, 'quote', (u, g, rich, w) => ({ x: b[0] + u * .9, lines: linesOf(bq, o, w), u, g, seed: s(10 + k), rich, ...w && { box: b, foot: ft && rel(ft, o)[1], limit: [0, o.width], n: chapterOf(bq) || 1 } })); });
  root.querySelectorAll(sel.figure).forEach((fg, k) => frame(fg, 'figure', (u, g, rich, w) => { const cap = fg.querySelector('figcaption');
    const fr = rel(fg, o), cs = getComputedStyle(fg);
    return { box: rel(fg.querySelector('svg, img, canvas') ?? fg, o), u, g, seed: s(20 + k), rich, ...w && { cap: cap && rel(cap, o)[3], caption: cap && rel(cap, o), n: chapterOf(fg) || 1, limit: [0, o.width], room: [fr[1] - parseFloat(cs.marginTop), fr[3] + parseFloat(cs.marginBottom)] } }; }));
  root.querySelectorAll(sel.aside).forEach((a, k) => frame(a, 'aside', (u, g, rich, w) => ({ box: rel(a, o), u, g, seed: s(30 + k), rich, ...w && { n: chapterOf(a) || 1, lines: linesOf(a, o, true) } })));
  root.querySelectorAll(sel.pull).forEach((p, k) => { const L = linesOf(p, o, W8(p)), m = [text.left - o.left, 0, text.right - o.left];
    frame(p, 'pull', (u, _, rich, w) => ({ cx: (m[0] + m[2]) / 2, yTop: L[0].top - u * 2.2, yBot: L.at(-1).base + u * 2.6, measure: m[2] - m[0], lines: L, u, seed: s(40 + k), rich, ...w && { n: chapterOf(p) } })); });
  root.querySelectorAll(sel.code).forEach((p, k) => frame(p, 'code', (u, g, rich, w) => ({ box: rel(p, o), u, g, seed: s(50 + k), rich, ...w && { n: chapterOf(p) || 1, lines: linesOf(p, o, true), rows: linesOf(p.querySelector('code') ?? p, o, true), starts: lineStarts(p, o) } })));

  // the wayfinding (06): paraphs, fillers and breaks, each made at unit size and scaled about its anchor
  const GRAM = c.gram, G = key => GRAM[key] ??= isWritten(STYLES[key]) ? STYLES[key] : grammar(STYLES[key]), V = key => (c.setups[key] ??= G(key).setup(SEED));
  const pairAt = (k, key) => G(key).alternate ? G(key).pair[k % 2] : G(key).pair?.[0];   // (a written style may have no pair)
  // a part's opening is room kept for its break: a filler may not swing down into it
  root.querySelectorAll(`${sel.book}, ${sel.chapter}`).forEach(el => { const b = el.getBoundingClientRect(); TEXT.push({ l: b.left - o.left, r: b.right - o.left, t: b.top - o.top, b: b.top - o.top + 1 }); });
  const marks = []; let nFill = 0, nFillW = 0;
  const fillAfter = (el, col, seed) => {
    // a written style's: in the free end of the last line, out to the measure, when the gap is worth closing (a heading's
    // run out with a rule; a paragraph's only when a third of the measure is left, the kinds in turn)
    if (W8(el)) { const key = styleAt(el), S = G(key), L = linesOf(el, o, true).at(-1), at = { gap: .8, head: 3, rise: 1, ...S.fillAt }, u = uAt(el); if (!L) return;
      const head = /^H\d$/.test(el.tagName), x0 = L.right + u * at.gap, x1 = m8[2]; if (x1 - x0 < (head ? u * at.head : (m8[2] - m8[0]) * .3)) return;
      const k0 = S.kinds(V(key), richAt(el)), kinds = c.vary ? shuffle(k0, c.vary) : k0, kind = head ? 'rule' : kinds[nFillW++ % kinds.length];
      return later(el, 'filler', top(el) + 1, () => ({ marks: S.filler(x0, x1, L.base - u * at.rise, L.base, kind, seed, richAt(el), chapterOf(el)) })); }
    const key = styleAt(el), S = G(key), RICH = richAt(el), SCALE = scaleAt(el), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), mt = metricOf(`${cs.fontStyle} ${cs.fontWeight} ${fs}px "EB Garamond"`), L = boxes(el, o, sel);
    if (!L.length) return;
    const last = L.filter(r => Math.abs(r.t - L.at(-1).t) < 2), right = Math.max(...last.map(r => r.r)), er = el.getBoundingClientRect(), measure = er.right - o.left;
    const x0 = right + fs * .35, x1 = measure, base = last[0].t + mt.asc;
    if (x1 - x0 < fs * S.minGap) return;
    const kinds = S.kinds(V(key), RICH), r = stream(seed, 'kind'), h = mt.x, mid = base - h / 2, k = kinds[(r() * kinds.length) | 0];
    // the room below the line for a filler that swings under it: down to the next line's top over the gap (the filler
    // is drawn at unit size and scaled about its middle, so the room is handed over in its own units)
    const next = Math.min(o.height - base, ...TEXT.filter(b => b.t > base + 1 && b.l < x1 + fs && b.r > x0 - fs).map(b => b.t - base));
    const dip = Math.max(0, (next - 2 + h / 2) / SCALE - h / 2);
    const make = v => scaled(S.filler(x0, x0 + (x1 - x0) / SCALE, mid - h / 2, mid + h / 2, k, seed, RICH, { ...V(key), ...v }), x0, mid, SCALE);
    // redo: kept to its band; and if a larger ornament scale still will not fit, at its own size
    marks.push({ el, style: key, y: base, a: col, kind: 'filler', marks: make({ dip }), redo: [() => make({ dip: 0, tight: true }), () => S.filler(x0, x1, mid - h / 2, mid + h / 2, k, seed, RICH, { ...V(key), dip: 0, tight: true })] }); nFill++;
  };
  // a break at unit size about its centre, then scaled; a flush-left style keeps its left edge on the measure
  // index: the part's real number (a card's numeral)
  // (a written style's: made when its turn comes, told the room the page leaves it, [top, bottom], and kept inside it)
  const brk = (el, cx, y, measure, rank, seed, index, room) => { const key = styleAt(el), S = G(key), SCALE = scaleAt(el), uw = fs * metricOf(FONT(400, 20)).x / 20;
    if (W8(el)) return () => fitIn(asMade(S.breakMark(cx, y, measure, rank, seed, richAt(el), uAt(el), index ?? 1, room)), room);
    const L = S.breakMark(cx, y, measure / SCALE, rank, seed, richAt(el), uw, index ? { ...V(key), index } : V(key)); return scaled(L, S.flush ? cx - measure / 2 : cx, y, SCALE, S.flush ? cx - measure / (2 * SCALE) : cx); };
  const head = el => el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
  const paraph = (p, k, seed) => {
    // a written style's: centred in the indent the scribe left, on the first line's baseline
    if (W8(p)) { const L = linesOf(p, o, true)[0], ind = parseFloat(getComputedStyle(p).textIndent), u = uAt(p), w = u * 1.65; if (!L) return;
      return later(p, 'paraph', top(p), () => ({ marks: G(styleAt(p)).paraph(L.left - ind + (ind - w) / 2, L.base, u, seed, richAt(p), chapterOf(p), k) })); }
    const key = styleAt(p), cs = getComputedStyle(p), fs = parseFloat(cs.fontSize), mt = metricOf(FONT(400, fs)), L = boxes(p, o, sel); if (!L.length) return;
    const pr = p.getBoundingClientRect(), x = pr.left - o.left + fs * .32, base = L[0].t + mt.asc;
    marks.push({ el: p, style: key, y: base, a: pairAt(k, key), kind: 'paraph', ax: x, ay: base, marks: scaled(G(key).paraph(x, base, mt.x, seed, richAt(p), V(key)), x, base, scaleAt(p)) }); };
  const books = [...root.querySelectorAll(sel.book)], loose = [...root.querySelectorAll(sel.chapter)].filter(ch => !ch.closest(sel.book));
  [...books, ...(loose.length ? [null] : [])].forEach((book, bi) => {
    const h2 = book && head(book);
    // the break above the book's head, in the room its padding leaves; the first book is opened by the title, so it
    // takes the device too: the same rank
    if (h2) { const hr = h2.getBoundingClientRect(), br = book.getBoundingClientRect(), cx = (hr.left + hr.right) / 2 - o.left, y = (br.top + hr.top) / 2 - o.top;
      if (W8(book)) later(book, 'book', br.top - o.top, brk(book, cx, y, hr.width, 2, SEED + 101 * bi, bi + 1, [br.top - o.top, hr.top - o.top]));
      else marks.push({ el: book, style: styleAt(book), y: br.top - o.top, a: pairAt(bi + 1, styleAt(book)), kind: 'book', ax: cx, ay: y, marks: brk(book, cx, y, hr.width, 2, SEED + 101 * bi, bi + 1) }); }
    (book ? [...book.querySelectorAll(sel.chapter)] : loose).forEach((ch, ci) => {
      const h3 = head(ch), cr = ch.getBoundingClientRect(), key = styleAt(ch);
      if (h3) { const h3r = h3.getBoundingClientRect(), cx = (h3r.left + h3r.right) / 2 - o.left, y = (cr.top + h3r.top) / 2 - o.top + 2;
        if (ci > 0 && W8(ch)) later(ch, 'chapter', cr.top - o.top, brk(ch, cx, y, h3r.width, 1, SEED + 101 * bi + 7 * ci, ci + 1, [cr.top - o.top, h3r.top - o.top]));
        else if (ci > 0) marks.push({ el: ch, style: key, y: cr.top - o.top, a: pairAt(ci + 1, key), kind: 'chapter', ax: cx, ay: y, marks: brk(ch, cx, y, h3r.width, 1, SEED + 101 * bi + 7 * ci, ci + 1) });
        fillAfter(h3, pairAt(1, key), SEED + 31 * bi + 3 * ci); }
      // the paragraphs: a paraph in each one's indent but the first (red and blue in turn, starting again each chapter),
      // a filler after every one; a paragraph opened by an initial takes no paraph
      [...ch.querySelectorAll(':scope > p')].filter(p => !p.matches(sel.pull)).forEach((p, pi) => {
        if (pi > 0 && !p.querySelector(sel.initial)) paraph(p, pi, SEED + 997 * bi + 89 * ci + pi);
        fillAfter(p, pairAt(nFill, styleAt(p)), SEED + 1009 * bi + 113 * ci + 17 * pi);
      });
    });
  });
  // outside the chapters, by markup alone
  // (a written style's seeds as tests/blackletter.html drew them)
  root.querySelectorAll(sel.paraph).forEach((p, k) => { if (!p.closest(sel.chapter)) paraph(p, k + 1, W8(p) ? s(100 + k) : SEED + 503 * k); });
  root.querySelectorAll(sel.filler).forEach((el, k) => { if (!el.closest(sel.chapter)) fillAfter(el, pairAt(nFill, styleAt(el)), W8(el) ? s(200 + k) : SEED + 607 * k); });
  const nth = {};   // (a written style's break numbered among those of its rank: the chapter's or the book's number)
  root.querySelectorAll(sel.break).forEach((el, k) => { const b = rel(el, o), rank = +el.dataset.rank || 1, cx = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2;
    nth[rank] = (nth[rank] ?? 0) + 1;
    if (W8(el)) return later(el, rank > 1 ? 'book' : 'chapter', b[1], brk(el, cx, y, b[2] - b[0], rank, s(300 + k), nth[rank], [b[1], b[3]]));
    marks.push({ el, style: styleAt(el), y: b[1], a: pairAt(rank, styleAt(el)), kind: rank > 1 ? 'book' : 'chapter', ax: cx, ay: y, marks: brk(el, cx, y, b[2] - b[0], rank, SEED + 211 * k) }); });

  // the guard: after scaling, a stroke or point that would touch a word's box is not drawn (a flourish gives way)
  for (const m of marks) {
    m.line = true;
    // a paraph is never broken: if it would touch a word it is drawn smaller about its foot until it does not
    // and a break likewise about its centre (cut, its pieces would no longer meet)
    if (m.ax !== undefined) for (let f = .92; m.marks.some(hits) && f > .4; f -= .08) m.marks = m.marks.map(s => { const g2 = ([x, y]) => [m.ax + (x - m.ax) * .92, m.ay + (y - m.ay) * .92];
      return s.dot ? { ...s, p: g2(s.p), r: s.r * .92 } : { ...s, pts: s.pts.map(g2), w: Math.max(.32, s.w * .92) }; });
    // a filler that would touch a word is made again kept to its band (no swing above or below), before anything is cut
    for (const again of m.redo ?? []) if (m.marks.some(hits)) m.marks = again();
    if (m.redo && m.marks.some(hits)) { m.marks = []; (dropped.filler ??= [0, 0])[1]++; continue; }   // still touching: no filler rather than a broken one
    const n0 = m.marks.length; m.marks = m.marks.filter(s => !hits(s)); if (m.marks.length < n0) (dropped[m.kind] ??= [0, 0])[m.marks.length ? 0 : 1]++; }
  out.push(...marks);
  // reading order; the frames' colours alternate down the page, the first in the second colour (07)
  out.sort((x, y) => x.y - y.y);
  let n = 0; for (const it of out) if (!it.letter && !it.line && !it.written) { const P = STYLES[it.style].pair; it.a = P[(n++ + 1) % P.length]; }
  return { items: out, words, dropped };
}
// A written part kept inside [top, bottom] (page px): if what it made (its line, its stencils, its lettering) runs out of
// that room it is moved, whole, to the room's middle (or its top, if it is taller than the room); else left where it is
// (a letter: a line of text on its base, a pen's point, a shape's polygons, a traced sign's box; see kit/styles/occult.js)
const letterYs = t => t.dot ? [t.dot[1] - t.r, t.dot[1] + t.r] : t.polys ? t.polys.flat().map(p => p[1]) : t.shape ? [t.y, t.y + t.h] : t.c ? [t.c[1] - t.size, t.c[1] + t.size] : [t.base - t.size, t.base];
function moveLetter(t, dy) { if (t.dot) t.dot = [t.dot[0], t.dot[1] + dy]; else if (t.polys) t.polys = t.polys.map(P => P.map(([x, y]) => [x, y + dy])); else if (t.shape) t.y += dy; else if (t.c) t.c = [t.c[0], t.c[1] + dy]; else t.base += dy; }
function fitIn(m, [r0, r1]) {
  const marks = m.marks.flat(3), ys = [...marks.flatMap(k => k.pts.map(p => p[1] - k.w / 2).concat(k.pts.map(p => p[1] + k.w / 2))),
    ...(m.fills ?? []).flatMap(f => [...f.polys.flat(), ...f.lines.flatMap(l => l.pts)].map(p => p[1])), ...(m.letters ?? []).flatMap(letterYs)];
  const top = Math.min(...ys), bot = Math.max(...ys); if (!(top < r0 - .5 || bot > r1 + .5)) return m;
  const dy = bot - top > r1 - r0 ? r0 - top : (r0 + r1 - top - bot) / 2, mv = P => P.map(([x, y]) => [x, y + dy]);
  for (const k of marks) k.pts = mv(k.pts);
  for (const f of m.fills ?? []) { f.polys = f.polys.map(mv); for (const l of [...f.lines, ...f.holes ?? []]) l.pts = mv(l.pts); }
  for (const t of m.letters ?? []) moveLetter(t, dy);
  return m;
}
// a list in an order drawn from a seed (the same list and seed, the same order)
const shuffle = (a, seed) => { const r = stream(seed, 'order:' + a.join()), b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const resampleLine = (p, ds) => { const out = [p[0]]; for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / ds);
  for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; };

// ?specimen: the style as a pattern book: twenty fillers of different lengths and twelve paraphs, all from one copy's
// grammar, so the variation within the style can be seen at once (the text is hidden, not changed); and its breaks
function specimen(c) {
  const key = c.style, W8 = isWritten(STYLES[key]), S = c.gram[key] ??= W8 ? STYLES[key] : grammar(STYLES[key]), V = c.setups[key] ??= S.setup(c.SEED), SCALE = c.scale, RICH = c.rich, SEED = c.SEED, out = [], r = stream(SEED, 'spec'), x0 = 40, y0 = 60;
  // (a written style's marks are made at page size and not scaled; its paraphs given the chapters 1-4 in turn)
  c.u = 8;   // the specimen's x-height
  const kinds = c.kind ? [c.kind] : S.kinds(V, RICH), it = (y, a, kind, marks) => W8 ? { y, kind, style: key, written: true, make: () => marks } : { y, a, kind, style: key, line: true, marks };
  const sc = (L, ...a) => Array.isArray(L) ? scaled(L, ...a) : L, pair = S.pair ?? [];
  for (let k = 0; k < 20; k++) { const w = 60 + r() * 200, y = y0 + k * 30;
    out.push(it(y, pair[k % 2] ?? pair[0], 'filler', sc(S.filler(x0, x0 + w / SCALE, y - 8, y, kinds[k % kinds.length], SEED + 977 * k, RICH, W8 ? k % 7 : V), x0, y - 4, SCALE))); }
  for (let k = 0; k < 12; k++) { const x = 400 + (k % 4) * 52, y = y0 + 12 + Math.floor(k / 4) * 46;   // a tidy grid of four by three
    out.push(it(y, S.alternate ? pair[k % 2] : pair[0], 'paraph', sc(S.paraph(x, y, 8, SEED + 131 * k, RICH, W8 ? k % 4 + 1 : V, k + 1), x, y, SCALE))); }
  const brk = (cx, y, m, rank, seed) => sc(S.breakMark(cx, y, m / SCALE, rank, seed, RICH, 8, W8 ? 1 : V), cx, y, SCALE);
  out.push(it(0, pair[0], 'chapter', brk(500, y0 + 230, 360, 1, SEED + 5)), it(0, pair[1] ?? pair[0], 'book', brk(500, y0 + 360, 420, 2, SEED + 9)));
  return out.sort((a, b) => a.y - b.y);
}

// ---- the score ------------------------------------------------------------------------------------------------------------------
// Each mark becomes a part of the score, { t0, t1, at(g, f), done(g) }: shown part-way on the live layer while it is
// being written, laid on the page once finished. Down the page as the rubricator went, each mark at a hand's pace; an
// ornament is a group (read mode writes a group when its line comes up). With the medium, an ornament's hairlines are
// written by the quill (one part per ink, in turn) after its laid strokes and before its points.
const blended = (g, mode, f) => { if (!mode) return f(); g.save(); g.globalCompositeOperation = mode; f(); g.restore(); };
function stem(t0, t1, pts, o) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const upTo = f => { const L = f * S[S.length - 1]; let i = 1; while (i < S.length - 1 && S[i] < L) i++;
    const u = (L - S[i - 1]) / ((S[i] - S[i - 1]) || 1), a = pts[i - 1], b = pts[i]; return [...pts.slice(0, i), [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]]; };
  const { live = 'taper', blend, ...po } = o;
  return { t0, t1, at: (g, f) => { const p = upTo(f); if (p.length > 1 && S[S.length - 1] * f > .6) blended(g, blend, () => pen(g, p, { ...po, end: live })); }, done: g => blended(g, blend, () => pen(g, pts, po)) };
}
// a letter laid flat in one colour, from its coverage
function flat(g, L, rgb, dx = 0, dy = 0) {
  const c = new OffscreenCanvas(L.w, L.h), k = c.getContext('2d'), img = k.createImageData(L.w, L.h);
  for (let i = 0; i < L.w * L.h; i++) { img.data.set(rgb, i * 4); img.data[i * 4 + 3] = Math.round(Math.min(1, L.M[i]) * 255); }
  k.putImageData(img, 0, 0); g.drawImage(c, L.x0 + dx, L.y0 + dy, L.w / L.res, L.h / L.res);
}
// the letter, painted once into its own canvas at the page's resolution and laid by a sweep from the top (03)
function wiped(t0, t1, paint, [x, y, w, h], dpr, before) {
  let cv = null; const img = () => cv ??= (() => { const c = new OffscreenCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr)), k = c.getContext('2d'); k.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr); paint(k); return c; })();
  const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2, dir = [0, 1], n = [-dir[1], dir[0]];
  return { t0, t1, make: img, done: g => { before(); g.drawImage(img(), x, y, w, h); },
    at: (g, f) => { const e = 1 - (1 - f) ** 2, d = -R + 2 * R * e; g.save(); g.beginPath();
      g.moveTo(cx - dir[0] * R - n[0] * R, cy - dir[1] * R - n[1] * R); g.lineTo(cx + dir[0] * d - n[0] * R, cy + dir[1] * d - n[1] * R);
      g.lineTo(cx + dir[0] * d + n[0] * R, cy + dir[1] * d + n[1] * R); g.lineTo(cx - dir[0] * R + n[0] * R, cy - dir[1] * R + n[1] * R); g.closePath();
      g.clip(); g.drawImage(img(), x, y, w, h); g.restore(); } };
}
// a laid stroke's width along it, as the stamped pen makes it: its designed swell (press), set down and lifted at its ends
// (a cut end square, a taper drawn out, a ball end only half lifted), so it leaves the medium in the same shape
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function swell(s, pts, { start, end }) {
  const L = arclen(pts) || 1;
  return f => (s.press ? s.press(f) : 1) * (start === 'cut' ? 1 : .4 + .6 * smooth(0, Math.min(.15, 9 / L), f))
    * (end === 'cut' ? 1 : end === 'ball' ? .55 + .45 * (1 - smooth(1 - Math.min(.3, 24 / L), 1, f)) : .08 + .92 * Math.pow(1 - smooth(1 - Math.min(.35, 34 / L), 1, f), 1.2));
}
// a part written by the medium: never two at once (the window would move under the first), so a part that begins
// finishes the one still open (c.hand: the page's one pen)
function inMedium(c, t0, t1, strokes, ink, opts) { const wp = c.W.part(t0, t1, strokes, ink, opts), hand = c.hand; let fin = false;
  const take = () => { if (hand.open && hand.open !== me) hand.open.done(); hand.open = me; };
  const me = { t0, t1, at: (_, f) => { if (fin) return; take(); wp.at(f); }, done: () => { if (fin) return; take(); wp.done(); fin = true; hand.open = null; } };
  return me; }
function score(items, c) {
  const { SEED, PAPER, DARK, dpr, W } = c, parts = [], groups = [], drawn = []; let clock = .3, li = 0;
  const written = (...a) => inMedium(c, ...a);
  items.forEach((it, idx) => {
    const g0 = clock, from = parts.length, S = STYLES[it.style], P = paletteOf(S, c.mode, c.own), BLEND = DARK ? S.blendDark ?? (S.blend === 'multiply' ? 'screen' : S.blend) : S.blend;
    const other = col => { const [a, b] = S.pair; return col === a ? b ?? a : a; }, mi = it.line ? li++ : -1;
    const inkOf = s => { const col = s.col === 'g' ? 'gold' : s.col === 'k' ? 'black' : s.col === 'f' ? 'flesh' : s.col === 'a' ? it.a : other(it.a); return P[col] ?? P[S.pair[0]]; };
    // which hand writes a stroke with the medium: the quill (a round, fine pen: the hairlines), or a broad nib at the
    // mark's own angle (a paraph's bowl and stems, a capitulum, a bar); fills, spindles, an overprint's plates, marks laid
    // in a blend, and the designed swells of a copperplate shade or a whiplash stay with the stamped pen (the medium's
    // quill keeps its hairline under a swell, so a whiplash could not taper to its point)
    const handOf = s => !W || s.dot || s.plate || BLEND || s.press ? null : s.broad >= .5 || (s.broad >= .4 && s.load >= 1) ? 'broad' : (s.load ?? .85) < 1 ? 'quill' : null;
    const later = [], quill = new Map();
    const mark = (s, i, list) => {
      const INK = inkOf(s), solid = s.ink ? (DARK ? lift(s.ink) : s.ink) : INK.solid;
      if (s.dot) { drawn.push({ mi: it.i ?? idx, type: it.kind, dot: s.p, r: s.r, free: s.free, plate: s.plate | 0, own: it.own });
        const make = t => ({ t0: t, t1: t + .03, at: () => {}, done: g => blended(g, BLEND, () => dot(g, s.p, s.r, solid, PAPER, .95, DARK)) });
        if (W) later.push(make); else { parts.push(make(clock)); clock += .03; } return; }
      // a wayfinding mark (made at unit size) is refined and its free ends lifted; a frame or an initial is drawn as made
      const pts = it.line ? refine(s.pts) : s.pts, ends = it.line ? freeEnds(s, list) : s, w = s.w * (s.broad ? 1 : 1.1);
      const seed = it.line ? (SEED + mi * 131 + i * 7) >>> 0 : it.letter ? s.seed ?? (SEED + idx * 131 + i * 7) >>> 0 : (SEED + i * 13) >>> 0;
      drawn.push({ mi: it.i ?? idx, type: it.kind, own: it.own, pts, w, ends: [pts[0], pts.at(-1)], cap: [ends.start, ends.end], plate: s.plate | 0, free: s.free, solid: (s.load ?? .85) >= 1 || s.broad >= .5 || !!s.press });
      const ink = s.ink ? solid : s.broad ? INK.solid : INK.hair;
      const hand = handOf(s);
      if (hand) { const k = `${ink}|${hand}|${hand === 'broad' ? s.broad : ''}`, laid = hand === 'broad';
        // the quill is near round (03's approved width, 1.45 and 1.4 of the penwork's own); a broad nib its full width,
        // its hairline what the stamped pen's thinnest would be (the nib's angle as the stamped pen reads it: the medium's
        // angle rises to the right, and this sign is the one that turns a paraph's stems out in their lozenges)
        quill.has(k) || quill.set(k, { ink, strokes: [], opts: hand === 'broad' ? { width: 1, hair: Math.max(.08, 1 - s.broad) } : { width: 1.45 / 1.15, hair: 1.4 / 1.15 } });
        quill.get(k).strokes.push({ pts, w, rho: s.rho, ...(hand === 'broad' ? { angle: s.nib ?? .55 } : {}), ...(laid ? { press: swell(s, pts, ends) } : {}) });
        // the quill lifts clean, so a curl's finishing ball is set down after it, as the stamped pen makes it (03's
        // penwork, approved without, keeps its own points)
        if (!it.letter) for (const [e, q] of [[ends.start, pts[0]], [ends.end, pts.at(-1)]]) if (e === 'ball') { const r = Math.max(1.05, w * (.75 + .5 * stream(seed, 'ball')()));
          later.push(t => ({ t0: t, t1: t + .03, at: () => {}, done: g => dot(g, q, r, ink, PAPER, 1.3, DARK) })); }
        return; }
      const o = { w, ink, paper: PAPER, dark: DARK, blend: BLEND, seed, start: ends.start, end: ends.end, load: s.load ?? .85, dry: s.dry ?? .3, broad: s.broad ?? .3, swell: s.swell ?? .25, nib: s.nib ?? .55, press: s.press };
      const d = Math.max(.05, arclen(pts) / (s.broad ? 70 : 260)); parts.push({ ...stem(clock, clock + d, pts, { ...o, live: 'cut' }) }); clock += d * .8;
    };
    (it.ground ?? []).forEach((s, i, l) => mark(s, i, l));
    // the quill's ink: on a light ground as it multiplies into the paper (as 03 was approved: the medium's sheet laid
    // over the page in multiply), so ink laid as colour and opacity comes out the same; on a dark ground its own colour
    const flushQuill = () => { for (const { ink, strokes, opts } of quill.values()) { const d = strokes.reduce((a, s) => a + arclen(s.pts) / 300, 0) * .75 + strokes.length * .05; parts.push(written(clock, clock + d, strokes, DARK ? ink : ink.map((v, j) => Math.round(v * PAPER[j] / 255)), opts)); clock += d; } quill.clear();
      for (const make of later) { parts.push(make(clock)); clock += .03; } later.length = 0; };
    if (it.letter) { flushQuill(); const L = it.letter, M = L.M, pad = L.outline || L.ghost ? 3 : 0, box = [M.x0 - pad, M.y0 - pad, M.w / M.res + pad * 2, M.h / M.res + pad * 2];
      // a brushed letter is laid subtractively, which on a dark ground would sink to black: there it is laid flat, lifted
      const col = k => inkOf({ col: k }).solid, paint = k => {
        if (L.pigment && DARK) flat(k, M, lift(PIGMENTS[L.pigment].rgb));
        else if (L.pigment) paintField(k, M.M, M.x0, M.y0, M.w, M.h, L.pigment, { dpr: M.res, seed: it.seed ?? SEED, strength: 1 });
        else { if (L.ghost) flat(k, M, col(L.ghost.col), ...L.ghost.off);
          if (L.outline) for (let j = 0; j < 8; j++) flat(k, M, col(L.outline.col), Math.cos(j * Math.PI / 4) * L.outline.w, Math.sin(j * Math.PI / 4) * L.outline.w);
          flat(k, M, col(L.col)); } };
      parts.push(wiped(clock, clock + 1.1, paint, box, dpr, () => W?.flush())); clock += 1.4; }
    it.marks.forEach((s, i, l) => mark(s, i, l));
    flushQuill();
    if (it.letter) clock += .4;
    // as you read, no ornament keeps the reader waiting: the hand goes faster on a long one (3 s; 8 s for an initial)
    const own = parts.slice(from), len = Math.max(.1, ...own.map(p => p.t1 - g0)), kg = Math.min(1, (it.letter ? 8 : 3) / len);
    own.forEach(p => { p.it = it; });
    groups.push({ it, y: it.y, type: it.kind, parts: own.map(p => ({ ...p, t0: (p.t0 - g0) * kg, t1: (p.t1 - g0) * kg })) });
  });
  // the whole book is rubricated, compressed to ~14 s
  let end = Math.max(.1, ...parts.map(p => p.t1)); const k = Math.min(1, 14 / end);
  if (k < 1) { parts.forEach(p => { p.t0 *= k; p.t1 *= k; }); end *= k; }
  return { parts, end, groups, drawn };
}

// A written style's cases (tests/blackletter.html's score): an ornament's marks in runs of one colour and one nib, each
// run one part at a hand's pace (a pause between marks); an ornament takes at most its cap (a drop initial ~6 s, a frame
// or a break ~1.2 s, a single mark a moment); a typeface letter is laid first, before the marks round it: at once
// (inkLetter, the red first, the black over it), or written along its strokes (letterWriter: the black, then the red
// flowing in beneath). Without the medium the marks fall back to the stamped pen, a broad nib at the mark's angle.
// A printed style (its own print and timeline: Tarot) keeps its case's clock itself; its pours and lettering are marked
// `under`, which a still lays before any line.
function scoreWritten(items, c, animate) {
  const { DARK } = c, parts = [], groups = [], drawn = []; let t = .1;
  for (const it of items) {
    const S = STYLES[it.style], P = S.palette[DARK ? 'dark' : 'light'], marks = (it.marks ?? []).flat(3), own = [], g0 = t, from = parts.length; let run = null, u = 0;
    for (const m of marks) drawn.push({ mi: it.i, type: it.kind, own: it.own, pts: m.pts, w: m.w, ends: [m.pts[0], m.pts.at(-1)], cap: ['cut', 'cut'], plate: 0, solid: true });
    // (and its lettering and signs, for the audit, as the outline of where their ink lies: only when it is asked for, they are slow to find)
    if (c.audit) for (const L of it.letters ?? []) for (const b of inkBoxes(L)) drawn.push({ mi: it.i, type: it.kind, own: it.own, pts: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]], w: 1, ends: [], cap: ['cut', 'cut'], plate: 0, solid: true, free: true });
    if (S.timeline) { const tl = S.timeline(it, it.kind, animate), k = Math.min(1, tl.cap / Math.max(tl.u, .01));
      it.y0 ??= Math.min(...marks.map(m => m.pts[0][1]));
      for (const e of tl.own) parts.push({ ...piece(e, t + e.t0 * k, t + e.t1 * k, it, P, c, animate), under: !e.run && !e.over, over: !!e.over });
      t += tl.u * k + .12; }
    else {
      const flush = () => { if (!run) return; const L = run.strokes.reduce((a, s) => a + s.L, 0), d = Math.max(.05, L / 260 + run.strokes.length * .04);
        own.push({ t0: u, t1: u + d, run }); u += d; run = null; };
      for (const m of marks) { const L = arclen(m.pts);
        if (!run || run.col !== m.col || Math.abs(run.w - m.w) > .01 || Math.abs(run.hair - m.hair) > .01) { flush(); run = { col: m.col, w: m.w, hair: m.hair, strokes: [] }; }
        run.strokes.push({ pts: m.pts, L, angle: m.angle, press: m.press }); }
      flush();
      const cap = it.kind === 'drop' ? 6 : marks.length <= 1 ? .3 : 1.2, k = Math.min(1, cap / Math.max(u, .01));
      it.y0 = it.letter ? it.letter.y0 : Math.min(...marks.map(m => m.pts[0][1]));
      if (it.letter) { const d = it.kind === 'drop' ? (it.letter.red ? 2.6 : 1.9) : .7; parts.push(piece({ letter: it.letter }, t, t + d, it, P, c, animate)); t += d + .15; }
      for (const p of own) parts.push(piece(p, t + p.t0 * k, t + p.t1 * k, it, P, c, animate));
      t += u * k + .12; }
    groups.push({ it, y: it.y, y0: it.y0, type: it.kind, parts: parts.slice(from).map(p => ({ ...p, t0: p.t0 - g0, t1: p.t1 - g0 })) });
  }
  return { parts, groups, drawn, end: t };
}
// a coverage mask's ink (more than half covered) as a box in page px, or null
// and as the boxes of its parts: cut wherever a band of rows or of columns at least `gap` px wide has no ink (a cluster
// of small lettering laid as one pour is seen as its words and signs, not as the box round them all)
function inkBoxes({ M, w, h, x0, y0, res }, gap = 3) {
  const out = [], G = Math.max(1, Math.round(gap * res)), ink = (i, j) => M[j * w + i] > .5;
  const cut = (a, b, c, d) => {   // [a, c) columns, [b, d) rows: trimmed to its ink, then split at the first empty band
    const rows = [], cols = []; for (let j = b; j < d; j++) for (let i = a; i < c; i++) if (ink(i, j)) { rows[j - b] = cols[i - a] = 1; }
    const r0 = rows.indexOf(1), c0 = cols.indexOf(1); if (r0 < 0) return; const r1 = rows.lastIndexOf(1) + 1, c1 = cols.lastIndexOf(1) + 1;
    const band = (occ, s0, s1) => { let run = 0; for (let k = s0; k < s1; k++) { if (occ[k]) { if (run >= G) return k - run; run = 0; } else run++; } return -1; };
    const sr = band(rows, r0, r1); if (sr >= 0) { cut(a, b + r0, c, b + sr); cut(a, b + sr, c, b + r1); return; }
    const sc = band(cols, c0, c1); if (sc >= 0) { cut(a + c0, b + r0, a + sc, b + r1); cut(a + sc, b + r0, a + c1, b + r1); return; }
    out.push([x0 + (a + c0) / res, y0 + (b + r0) / res, x0 + (a + c1) / res, y0 + (b + r1) / res]); };
  cut(0, 0, w, h); return out; }
// one entry of a written case's clock made a part: a run of the line (the medium's pen, or the stamped pen without it); a
// letter (laid by inkLetter, the red first, or written by letterWriter); a pour (laid, or swept in beneath: sweepIn)
function piece(e, t0, t1, it, P, c, animate) {
  const { dpr, W } = c, boxOf = M => [M.x0, M.y0, M.x0 + M.w / M.res, M.y0 + M.h / M.res];
  if (e.letter) { const L = e.letter, red = P[L.redCol ?? 'r'], ink = P[L.col] ?? P.k, lw = animate ? letterWriter(c.g, L, { ...P, k: ink, r: red }, { dpr, host: c.host, below: c.base }) : null;
    const lay = () => { if (L.red) inkLetter(c.g, { ...L, M: L.red, wet: L.redWet ?? L.wet, dry: L.redDry ?? L.dry }, red, { dpr }); inkLetter(c.g, L, ink, { dpr }); };   // the red first, the black (or the letter's own colour) over it
    return { t0, t1, it, ink: '', as: 'letter', box: boxOf(L), at: (_, f) => lw?.at(f), done: () => lw ? lw.done() : lay() }; }
  if (e.pour) { const p = e.pour, sw = animate ? sweepIn(c.g, p, P[p.col], { dpr }) : null;
    // (p.paint: a pour that lays itself, a style's own medium (Nouveau's watercolour washes): used in place of inkLetter)
    return { t0, t1, it, ink: '', as: 'colour:' + p.col, box: boxOf(p), at: (_, f) => sw?.at(f), done: () => sw ? sw.done() : p.paint ? p.paint(c.g, { dpr }) : inkLetter(c.g, p, P[p.col], { dpr }) }; }
  const p = e.run, col = p.col ?? 'k', rgb = P[col] ?? P.k, box = p.strokes.reduce((b, s) => s.pts.reduce((b, [x, y]) => [Math.min(b[0], x - p.w), Math.min(b[1], y - p.w), Math.max(b[2], x + p.w), Math.max(b[3], y + p.w)], b), [Infinity, Infinity, -Infinity, -Infinity]);
  return W ? { ...inMedium(c, t0, t1, p.strokes.map(s => ({ pts: s.pts, angle: s.angle, press: s.press, rho: s.rho })), rgb, { width: p.w, hair: p.hair }), it, ink: col, as: 'line', box, loose: true }
    : { t0, t1, it, ink: col, as: 'line', box, at: (g, f) => p.strokes.slice(0, Math.floor(f * p.strokes.length)).forEach(s => stamp(g, s, p, rgb, c)), done: g => p.strokes.forEach(s => stamp(g, s, p, rgb, c)) };
}
// a nib mark with the stamped pen (no medium): its edge w at its angle (the stamped pen reads the angle the other way up)
const stamp = (g, s, p, rgb, c) => pen(g, s.pts, { w: p.w, ink: rgb, paper: c.PAPER, dark: c.DARK, seed: (c.SEED + s.pts.length) >>> 0, start: 'cut', end: 'cut', load: 1, dry: .1, broad: .85, swell: 0, nib: -(s.angle ?? .62), press: s.press });

// A written style's parts in an order that changes ink as seldom as possible (the writer dries its window at every change
// of ink): band by band down the page (600 px); in each band a part may go ahead of an earlier part only where their
// boxes do not touch, so what lies over what is kept; what is not the medium's ink (a letter, a stamped mark) first. (Runs
// of one ink in the medium, `loose`, may pass each other where they touch: they go into one wet medium, as approved.)
function batched(parts) {
  if (new Set(parts.map(p => p.ink)).size < 2) return parts;   // one ink: nothing to gain, the reading order kept
  const touch = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3], bands = new Map(), out = [];
  for (const p of parts) { const k = Math.floor((p.it.y0 ?? p.it.y) / 600); bands.has(k) || bands.set(k, []); bands.get(k).push(p); }
  for (const k of [...bands.keys()].sort((a, b) => a - b)) {
    const L = bands.get(k), deps = L.map((p, i) => L.slice(0, i).filter(q => (q.ink !== p.ink || !(p.loose && q.loose)) && touch(q.box, p.box)));
    const done = new Set(); let cur = '';
    while (done.size < L.length) { const ready = L.filter((p, i) => !done.has(p) && deps[i].every(q => done.has(q)));
      const take = ready.filter(p => p.ink === cur); if (!take.length) { cur = ready[0].ink; continue; }
      for (const p of take) { done.add(p); out.push(p); } } }
  return out;
}

// A style that strikes its lines ink by ink (its `inks`: Occult) has them in that order down the whole list, after the
// rest (batched)
function inkOrder(parts) {
  const inks = p => STYLES[p.it.style].inks, mine = parts.filter(inks);
  return mine.length ? [...batched(parts.filter(p => !inks(p))), ...mine.sort((a, b) => inks(a).indexOf(a.ink) - inks(b).indexOf(b.ink))] : batched(parts);
}

// ---- rubricate ----------------------------------------------------------------------------------------------------------------
export function rubricate(root, opts = {}) {
  const host = opts.host ?? root.offsetParent ?? root, ds = root.dataset, still = matchMedia('(prefers-reduced-motion: reduce)');
  let o = { style: ds.style ?? 'gothic', rich: ds.rich ?? .5, scale: ds.scale ?? 1, theme: 'auto', draw: ds.draw ?? 'still', ink: ds.ink ?? 'medium', ...opts };
  const text = root.textContent.replace(/\s+/g, ' ').trim(), gram = {};
  const layer = () => { const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); Object.assign(c.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }); return c; };
  const base = layer(), live = layer(); host.prepend(base, live);
  let raf = 0, io = null, sentinels = [], readDone = new Set(), W = null, mode = null, state = {}, alive = true, gen = 0, first = true;
  const themeMode = () => o.theme !== 'auto' ? o.theme : document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  // a written style's medium made (its shaders compiled) while the fonts load, as it was approved: its window first at the
  // page's head (the first drawing takes it if nothing has changed; any later one makes its own)
  // (made only once the page is known not to be drawn from the store: kit/cache.js)
  let pre = null, warmed = false; const warm = () => { if (warmed) return; warmed = true; try { const dpr = Math.min(2, devicePixelRatio || 1), DARK = themeMode() === 'dark';
    if (isWritten(STYLES[o.style]) && o.ink !== 'pen' && supported()) { pre = createWriter(host, base.getContext('2d'), { dpr, dark: DARK }); pre.wk = `${dpr}|${DARK}|${o.ink}`; pre.warm(); }
    if (isWritten(STYLES[o.style])) warmInk(dpr); } catch {} };   // (and the letters' and pours' medium)
  // The still remembered (kit/cache.js): its key is the text, the host's width, the options, the theme, its colours and the density; a
  // record is used only if the library's code and faces are those that drew it and the text falls exactly where it fell. Off with
  // { cache: false } or ?nocache in the page's address (and under ?audit, which needs the marks themselves).
  const cacheOn = () => o.cache !== false && !o.view && typeof indexedDB !== 'undefined' && !/[?&](nocache|audit)\b/.test(location.search);
  // a state reached: told to `on`, and as an event on root (illum:drawn, illum:written; detail: the timing), for a host or a
  // tool that did not make the call
  const done = (st, info) => { o.on?.(st, info); root.dispatchEvent(new CustomEvent('illum:' + st, { bubbles: true, detail: info ?? null })); };
  const lib = () => libraryHash(import.meta.url), baked = () => o.baked ?? root.dataset.baked ?? new URL('bake.json', import.meta.url).href;
  if (cacheOn()) manifest(baked());   // (asked for now, while the fonts load)
  const keyOf = () => { const { on, host: _h, cache, baked, ...rest } = o, cs = getComputedStyle(root), dpr = Math.min(2, devicePixelRatio || 1);
    return [hashText(text), Math.round(host.getBoundingClientRect().width), JSON.stringify(rest, (k, v) => typeof v === 'function' ? String(v) : v), themeMode(), dpr,
      ...['--paper', '--ink', '--rubric'].map(v => cs.getPropertyValue(v).trim()),
      // (a style with settings of its own, its `variant`: a getter on it that names them, so the store keeps one drawing per setting)
      ...(STYLES[o.style]?.variant != null ? [STYLES[o.style].variant] : [])].join('|'); };
  const inis = () => [...root.querySelectorAll({ ...SELECT, ...o.select }.initial)];
  const setStyles = (els, list) => els.forEach((e, i) => list[i] == null ? e.removeAttribute('style') : e.setAttribute('style', list[i]));
  // a record laid if the text falls where it fell (its initials set first, as they were when it was drawn); else nothing changed
  const fits = rec => { const els = inis(); if (els.length !== rec.ini.length) return false; const prev = els.map(e => e.getAttribute('style')), orn = root.style.getPropertyValue('--orn');
    setStyles(els, rec.ini); root.style.setProperty('--orn', rec.orn); root.style.visibility = '';
    if (fingerprint(root, host) === rec.fp) return true;
    setStyles(els, prev); if (orn) root.style.setProperty('--orn', orn); else root.style.removeProperty('--orn'); return false; };
  // what the page's styles need before anything is measured: a typeface initial's face (its initial.load)
  const keys = () => [...new Set([o.style, ...[...root.querySelectorAll('[data-style]')].map(e => e.dataset.style)])];
  const load = () => Promise.all([o.view === 'sweep' ? loadAll() : loadStyles(keys()), loadEngine()]);
  const ready = () => Promise.all(keys().map(k => STYLES[k]?.initial?.load?.(o.initial ?? {}))).catch(e => console.warn('illum:', e));
  // The store is asked at once, before the fonts are in; and the page's styles and the engine start loading at once too,
  // beside it (a page drawn from the store never waits for them; a page drawn live never waits on the store)
  const k0 = cacheOn() && (still.matches || o.draw === 'still') ? keyOf() : null, early = k0 ? lookup(k0, lib, baked()) : null;
  load().catch(() => {});

  // the cases measured and the registry's marks made and scored (a written style's are made when their turn comes)
  function compose() {
    const key = STYLES[o.style] ? o.style : 'gothic', sel = { ...SELECT, ...o.select }, SEED = (o.seed ?? fnv(text) % 1e7) >>> 0, vary = o.seed != null && o.seed !== '' && SEED !== fnv(text) % 1e7 ? SEED || 1 : 0, scale = Math.max(.5, Math.min(2, +o.scale || 1)), rich = Math.max(0, Math.min(1, +o.rich || 0));
    const tm = themeMode(), own = o.ground === 'style' && !!STYLES[key].theme?.dark, DARK = own || tm === 'dark', setups = {};
    const pv = getComputedStyle(root).getPropertyValue('--paper'), PAPER = pv ? cssRgb(pv) : DARK ? [29, 26, 23] : [244, 238, 226];
    root.style.setProperty('--orn', scale);
    root.style.visibility = o.view ? 'hidden' : '';
    if (!o.view) setInitials(root, { style: key, rich, select: sel, initial: o.initial ?? {} });
    const sr = host.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (mode === 'still') live.width = live.height = 0;   // nothing is shown part-written: no page-sized live layer
    for (const c of mode === 'still' ? [base] : [base, live]) { c.width = Math.round(sr.width * dpr); c.height = Math.round(sr.height * dpr); c.style.width = sr.width + 'px'; c.style.height = sr.height + 'px'; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
    const wk = `${dpr}|${DARK}|${o.ink}`; if (pre?.wk === wk) W = pre; else { W?.destroy(); pre?.destroy(); W = o.ink !== 'pen' && supported() ? createWriter(host, base.getContext('2d'), { dpr, dark: DARK }) : null; } pre = null;
    const c = { SEED, vary, sel, style: key, rich, scale, gram, setups, kind: o.kind, mode: tm, own, DARK, PAPER, dpr, W, initial: o.initial ?? {}, frame: o.frame ?? {}, hand: { open: null }, g: base.getContext('2d'), host, base, audit: o.audit ?? /[?&]audit\b/.test(location.search) };
    const t0 = performance.now(), w = o.view === 'specimen' ? { items: specimen(c), words: [], dropped: {} } : walk(root, host, c);
    w.items.forEach((it, i) => { it.i = i; });
    // a hand about to write: the medium made now, not in the first frame of writing. (A written style's still is laid
    // as it was approved, its medium's window first opened at the page's head; a registry style's where its first mark is)
    if (mode !== 'still' || w.items.some(it => it.written)) W?.warm();
    const reg = score(w.items.filter(it => !it.written), c);
    state = { ...w, drawn: [...reg.drawn], scale, sr, seed: SEED, grow: performance.now() - t0 };
    return { c, items: w.items, reg };
  }
  // the parts of these cases in reading order: the registry's from the page's one score, a written style's made and
  // scored now
  // (wait: the host will await a case's `ready` before it paints, so a style may finish its pieces elsewhere meanwhile)
  const made = (list, c, animate, wait = false) => { for (const it of list) if (it.written && !it.marks) { Object.assign(it, asMade(it.make()));
    const S = STYLES[it.style]; if (S.print) Object.assign(it, S.print(it, { dpr: c.dpr, kind: it.kind, u: c.u, y: it.y, seed: c.SEED, animate, wait })); } return list; };
  function partsOf(k, list, animate) {
    const set = new Set(list), wr = scoreWritten(made(list.filter(it => it.written), k.c, animate), k.c, animate); state.drawn.push(...wr.drawn);
    return [...k.reg.parts.filter(p => set.has(p.it)), ...wr.parts].sort((a, b) => a.it.i - b.it.i);
  }
  async function render(m) {
    cancelAnimationFrame(raf); io?.disconnect(); sentinels.forEach(n => n.remove()); sentinels = []; settle(); const tok = ++gen;
    const t00 = performance.now(), cacheable = cacheOn() && (still.matches || m === 'still');
    const key = cacheable ? keyOf() : null, rec = key ? await (key === k0 ? early : lookup(key, lib, baked())) : null;
    if (!alive || tok !== gen) return;
    if (rec && fits(rec)) { first = false; mode = 'still'; W?.destroy(); W = null; pre?.destroy(); pre = null; live.width = live.height = 0;
      await paint(rec, base, host); if (!alive || tok !== gen) return;
      const ms = Math.round(performance.now() - t00); state = { seed: rec.seed, cached: true, items: [], sr: host.getBoundingClientRect() };
      done('drawn', { grow: 0, draw: ms, view: ms, all: ms, parts: 0, cached: true }); return; }
    await load(); if (!alive || tok !== gen) return;
    warm();
    await ready();
    if (first) { first = false; await new Promise(r => requestAnimationFrame(() => setTimeout(r))); }   // the text is painted before any ornament
    if (!alive || tok !== gen) return;
    if (o.view === 'sweep') return sweep();
    mode = still.matches ? 'still' : m;
    const t0 = performance.now(), k = compose(), g = base.getContext('2d'), lv = live.getContext('2d');
    const clear = () => { lv.save(); lv.setTransform(1, 0, 0, 1, 0, 0); lv.clearRect(0, 0, live.width, live.height); lv.restore(); };
    if (mode === 'read') return read(k, g, lv, clear);
    if (mode === 'now') {
      // a written style keeps its own clock beside the registry's (already the book's ~14 s): compressed to the same
      const parts = partsOf(k, k.items, true), wp = parts.filter(p => p.it.written), end0 = Math.max(.1, ...wp.map(p => p.t1)), kw = Math.min(1, 14 / end0);
      if (kw < 1) wp.forEach(p => { p.t0 *= kw; p.t1 *= kw; });
      parts.forEach(p => p.make?.());   // the letters painted before the hand starts, not in a frame
      const end = Math.max(k.reg.end, ...wp.map(p => p.t1)), start = performance.now(), fin = new Uint8Array(parts.length);
      const tick = () => { const now = (performance.now() - start) / 1000; clear();
        parts.forEach((p, i) => { if (fin[i]) return; if (now >= p.t1) { p.done(g); fin[i] = 1; } else if (now > p.t0) p.at(lv, (now - p.t0) / (p.t1 - p.t0)); });
        if (now < end + .05) raf = requestAnimationFrame(tick); else { W?.flush(); done('drawn'); } };
      raf = requestAnimationFrame(tick); return;
    }
    // still: what is in view first, the rest in the next idle moment, each in an order that changes the medium's ink as
    // seldom as it can (batched)
    const fold = innerHeight + 80 - host.getBoundingClientRect().top; let n = 0;
    // (a registry style's parts keep their places: reordered, its approved looks drift by a few pixels where marks cross)
    // (what lies under the line, a print's colours and lettering, first, as a printer lays the block over them)
    // (and what is written into the lines, a style's lettering marked `over`, last, once the lines are dry)
    // (where the text lay when it was measured: the layer is remembered only if it lies there still once all is drawn)
    const fp = key ? fingerprint(root, host) : null;
    // (in the same order as ever, but handing the page back every few milliseconds, so the reader's scrolling and the text
    // never wait on a long task; true if a newer drawing has begun meanwhile)
    let t1 = performance.now();
    const slice = async () => { if (performance.now() - t1 < 10) return false; await (globalThis.scheduler?.yield?.() ?? new Promise(r => setTimeout(r))); t1 = performance.now(); return !alive || tok !== gen; };
    const draw = async list => { for (const it of list) if (it.written && !it.marks) { made([it], k.c, false, true); if (await slice()) return true; }
      const rd = list.map(it => it.ready).filter(Boolean); if (rd.length) { await Promise.all(rd); if (!alive || tok !== gen) return true; }
      const ps = partsOf(k, list, false), wr = ps.filter(p => p.it.written), wb = inkOrder(wr.filter(p => !p.under && !p.over)); let j = 0;
      const seq = [...wr.filter(p => p.under), ...ps.filter(p => !p.under && !p.over).map(p => p.it.written ? wb[j++] : p), null, ...wr.filter(p => p.over)];
      // (a registry style's stamped marks are laid without a pause: the 2D canvas may raster a stroke cut across tasks a level differently)
      for (const p of seq) { if (p) p.done(g); else W?.flush(); if ((!p || p.it.written) && await slice()) return true; }
      n += ps.length; return false; };
    if (await draw(k.items.filter(it => it.y < fold))) return; const view = performance.now() - t0;
    await new Promise(r => (self.requestIdleCallback ?? setTimeout)(r, { timeout: 200 }));
    if (!alive || tok !== gen) return;
    if (await draw(k.items.filter(it => it.y >= fold))) return; state.draw = performance.now() - t0 - state.grow;
    const w = W; (self.requestIdleCallback ?? setTimeout)(() => { if (W === w) { W?.destroy(); W = null; } });   // the medium let go once all is written
    done('drawn', { grow: Math.round(state.grow), draw: Math.round(state.draw), view: Math.round(view), all: Math.round(performance.now() - t0), parts: n });
    // kept for next time, if the text still falls where it fell while it was drawn
    if (fp) (self.requestIdleCallback ?? setTimeout)(() => { if (!alive || tok !== gen || fingerprint(root, host) !== fp) return;
      const sr = parseFloat(base.style.width), sh = parseFloat(base.style.height);
      lib().then(L => remember(key, { lib: L, fp, ini: inis().map(e => e.getAttribute('style')), orn: root.style.getPropertyValue('--orn'), seed: state.seed, w: sr, h: sh }, base)).then(() => { state.stored = true; }, e => console.warn('illum: not remembered', e)); });
  }
  // As you read: each ornament is its own small score, unwritten until its line comes up into the reading window (an
  // IntersectionObserver on a sentinel at that line, firing 15% into the viewport from the bottom); a written style's
  // made only then. One pen writes them in reading order: an ornament starts when the last is finished (two at once
  // would drag the pen from one to the other). What the reader has already passed is laid down at once; a hand behind
  // the reader hurries; one being written that the reader scrolls well away from finishes in a moment; nothing runs when
  // nothing is being written; the page never scrolls itself. On relayout the finished ones are laid down at once and the
  // rest wait again.
  function read(k, base, live, clear) {
    const byIt = new Map(k.reg.groups.map(gr => [gr.it, gr])), queue = [], active = [];
    const groups = k.items.map(it => byIt.get(it) ?? { it, y: it.y, type: it.kind, make(animate = true) { made([it], k.c, animate); const w = scoreWritten([it], k.c, animate); state.drawn.push(...w.drawn); this.y0 = it.y0; return w.groups[0].parts; } });
    groups.forEach((gr, i) => { if (readDone.has(i)) { (gr.parts ??= gr.make(false)).forEach(p => p.done(base)); gr.state = 'done'; return; }
      const n = document.createElement('i'); n.setAttribute('aria-hidden', 'true'); n.dataset.g = i;
      Object.assign(n.style, { position: 'absolute', left: '0', top: Math.max(0, gr.y - 4) + 'px', width: '1px', height: '8px', pointerEvents: 'none' });
      host.append(n); sentinels.push(n); gr.state = 'waiting'; });
    W?.flush();
    let running = false, firstBatch = true; state.frames = []; state.groups = groups;
    const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    // when the hand is free: the end of the last ornament it has in hand
    const handFree = now => active.reduce((a, g) => g.speed ? Math.max(a, g.start + g.len * g.speed * 1000 + 150) : a, now);
    const begin = (gr, now) => {
      gr.parts ??= gr.make();
      const r = host.getBoundingClientRect(), y = r.top + (gr.y0 ?? gr.y), far = y < -innerHeight, past = y < -40;
      const len = Math.max(.01, ...gr.parts.map(p => p.t1)), free = handFree(now), behind = (free - now) / 1000; gr.len = len;
      // what is in view at a hand's pace, quicker if the hand is behind
      // (a style may hurry less: hurry [behind s, at least s, behind s, at least s]; Tarot's: a second at the least)
      const [b1, s1, b2, s2] = STYLES[gr.it.style]?.hurry ?? [3, .3, 1.2, .6];
      const keep = gr.initial || !!STYLES[gr.it.style]?.steady?.includes(gr.it.kind);   // (a style's steady kinds: never hurried)
      gr.speed = far || past ? 0 : !keep && behind > b1 ? Math.min(1, s1 / len) : !keep && behind > b2 ? Math.min(1, s2 / len) : 1;
      gr.start = gr.speed ? free : now; gr.fin = new Uint8Array(gr.parts.length); gr.state = 'writing'; active.push(gr); };
    const tick = () => { const now = performance.now(), top = host.getBoundingClientRect().top; let moved = false;
      for (const gr of active) { if (!gr.speed) continue; const y = top + (gr.y0 ?? gr.y);
        if (gr.start <= now) { if (y < -innerHeight * .5) { const t = (now - gr.start) / 1000 / gr.speed, sp = Math.min(gr.speed, .3 / Math.max(.05, gr.len - t)); if (sp < gr.speed) { gr.start = now - t * 1000 * sp; gr.speed = sp; moved = true; } } continue; }
        if (y < -innerHeight * .5) { gr.speed = 0; moved = true; } else if (y < 0 && gr.speed === 1) { gr.speed = Math.min(1, .3 / gr.len); moved = true; } }
      if (moved) { let at = now; for (const gr of active) if (gr.speed) { if (gr.start > at) gr.start = at; at = Math.max(at, gr.start + gr.len * gr.speed * 1000 + 150); } }
      // (a written ornament made in a frame of its own: several made in one frame would stall it)
      while (queue.length) { const gr = queue.shift(), make = !gr.parts; begin(gr, now); if (make) break; }
      clear();
      for (let k = 0; k < active.length; k++) { const gr = active[k], t = gr.speed ? (now - gr.start) / 1000 / gr.speed : 1e9; if (t < 0) continue;
        gr.parts.forEach((p, i) => { if (gr.fin[i]) return; if (t >= p.t1) { p.done(base); gr.fin[i] = 1; } else if (t > p.t0) p.at(live, (t - p.t0) / (p.t1 - p.t0)); });
        if (gr.fin.every(Boolean)) { gr.state = 'done'; readDone.add(groups.indexOf(gr)); active.splice(k--, 1); } }
      if (state.frames.length < 2000) state.frames.push(performance.now() - now);
      if (active.length || queue.length) raf = requestAnimationFrame(tick);
      else { running = false; W?.flush(); if (groups.every(g => g.state === 'done')) done('written'); }
    };
    io = new IntersectionObserver(es => { es.filter(e => e.isIntersecting).map(e => groups[+e.target.dataset.g]).sort((a, b) => a.y - b.y)
        .forEach(gr => { if (gr.state === 'waiting') { gr.state = 'queued'; gr.initial = firstBatch; queue.push(gr); } }); firstBatch = false; es.forEach(e => e.isIntersecting && io.unobserve(e.target)); if (queue.length) kick(); },
      { rootMargin: '100000px 0px -15% 0px' });   // anything above the reading line counts as reached, so a fast scroll leaves no hole
    sentinels.forEach(n => io.observe(n));
    o.on?.('reading');
  }
  // every style's paraph across thirty seeds, one row a style, to look for unfortunate shapes
  function sweep() {
    root.style.visibility = 'hidden'; const o_ = host.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), tm = themeMode(), DARK = tm === 'dark';
    base.width = Math.round(o_.width * dpr); base.height = Math.round(o_.height * dpr); base.style.width = o_.width + 'px'; base.style.height = o_.height + 'px';
    const g = base.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const pv = getComputedStyle(root).getPropertyValue('--paper'), paper = pv ? cssRgb(pv) : [244, 238, 226], rich = +o.rich;
    Object.keys(STYLES).forEach((key, row) => {
      if (isWritten(STYLES[key])) { const S = STYLES[key], P = S.palette[DARK ? 'dark' : 'light'];   // a written style's own paraph, with the stamped pen
        for (let i = 0; i < 30; i++) { const seed = 1000 + i * 7919; for (const m of asMade(S.paraph(28 + i * 28, 30 + row * 40 + 28, 8, seed + 89, rich)).marks.flat(3)) stamp(g, m, m, P[m.col] ?? P.k, { PAPER: paper, DARK, SEED: seed }); } return; }
      const GS = grammar(STYLES[key]), P = paletteOf(STYLES[key], tm);
      for (let i = 0; i < 30; i++) { const seed = 1000 + i * 7919, V = GS.setup(seed), x = 28 + i * 28, base = 30 + row * 40 + 28, a = GS.alternate ? GS.pair[i % 2] : GS.pair[0];
        for (const m of GS.paraph(x, base, 8, seed + 89, rich, V)) { const col = m.col === 'g' ? 'gold' : m.col === 'k' ? 'black' : m.col === 'f' ? 'flesh' : m.col === 'a' ? a : (GS.pair[0] === a ? GS.pair[1] : GS.pair[0]), INK = P[col] ?? P[GS.pair[0]];
          blended(g, DARK ? GS.blendDark ?? (GS.blend ? 'screen' : null) : GS.blend, () => m.dot ? dot(g, m.p, m.r, INK.solid, paper, .95, DARK) : pen(g, refine(m.pts), { dark: DARK, w: m.w * (m.broad ? 1 : 1.1), ink: m.broad ? INK.solid : INK.hair, paper, seed: seed + 3, start: m.start, end: m.end, load: m.load ?? .85, dry: m.dry ?? .3, broad: m.broad ?? .3, swell: m.swell ?? .25, nib: m.nib ?? .55, press: m.press })); } } });
    o.on?.('sweep');
  }

  // relayout: a change of width redraws (the finished marks of a reading kept); a change of the reader's scheme too
  let lastW = host.clientWidth, timer;
  const again = () => render(mode === 'read' ? 'read' : 'still');
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { if (host.clientWidth !== lastW) { lastW = host.clientWidth; again(); } }, 150); }); ro.observe(host);
  const mq = matchMedia('(prefers-color-scheme: dark)'), onScheme = () => { if (o.theme === 'auto' && !document.documentElement.dataset.theme) again(); }; mq.addEventListener('change', onScheme);
  document.fonts.ready.then(() => render(o.draw));
  return {
    // new options redraw at once; a new `draw` starts the writing over, anything else keeps what a reading has written
    redraw(n = {}) { o = { ...o, ...n }; if (n.draw) { readDone.clear(); render(n.draw); } else again(); },
    destroy() { alive = false; gen++; cancelAnimationFrame(raf); io?.disconnect(); ro.disconnect(); mq.removeEventListener('change', onScheme); sentinels.forEach(n => n.remove()); settle(); W?.destroy(); pre?.destroy(); base.remove(); live.remove(); },
    get state() { return state; }, get options() { return o; },
  };
}
export { STYLES, grammar };
