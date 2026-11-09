// Rock (research/24-pie.md): one piece printed. The page's printer, the specimen's (tests/pie-directions.js) and a worker's
// (kit/styles/rock-worker.js) are this one path, so all three lay the same pixels. A piece is built from its job, plain data
// ([builder, ...its arguments], kit/styles/rock-pieces.js), so a worker can build it as well.
//   render(piece, theme, d, { ss }) -> { img (ImageData, d device px a CSS px), W, H, ox, oy }   writer(piece, theme, d, canvas)
//   makePiece(job, d, theme) -> { img, W, H, ox, oy }   LOOK.{ light, dark }
import { field } from './rock-relief.js';
import { renderRock, rockWriter } from './rock-paint.js';
import * as R from './rock-pieces.js';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
// the paint (stage 2): iron-oxide red, a little warmer and brighter than wekwos.com's oxblood where the brush laid it thick,
// pooled dark in the pits, thin and dry paler; on the ink, the same rock and a brighter paint
export const LOOK = {
  light: () => ({ paper: hex('#efe7d6'), lift: .5, tone: [1.04, .99, .95], pecked: [.88, .84, .8], paint: [hex('#cf7652'), hex('#a5361e'), hex('#561810')] }),
  dark: () => ({ paper: hex('#0e0d0b'), lift: .55, tone: [.9, .86, .84], pecked: [.82, .78, .74], paint: [hex('#d27159'), hex('#c4432a'), hex('#6a1d11')] }) };
// (stage 10) a rock piece's raster is sized from its paint, not its layout box: every pit's reach plus the paint's
// margin (the groove-depth and settle blurs), so nothing the carver laid outside the box is cut off. The canvas is then
// shifted back so the piece's own origin stays where the page put it.
const SHIFTED = new WeakMap();
export function painted(piece) { let v = SHIFTED.get(piece); if (v) return v;
  const ms = piece.marks({}), pad = Math.max(2, 3 * (piece.g ?? 1)); let x0 = 0, y0 = 0, x1 = piece.W, y1 = piece.H;
  for (const m of ms) if (m.k === 'pit') { const e = m.r * 1.35; x0 = Math.min(x0, m.x - e); y0 = Math.min(y0, m.y - e); x1 = Math.max(x1, m.x + e); y1 = Math.max(y1, m.y + e); }
  const ox = Math.ceil(Math.max(0, -x0 + pad)), oy = Math.ceil(Math.max(0, -y0 + pad)), W = Math.ceil(Math.max(piece.W, x1 + pad) + ox), H = Math.ceil(Math.max(piece.H, y1 + pad) + oy);
  const sh = ms.map(m => m.k === 'pit' ? { ...m, x: m.x + ox, y: m.y + oy } : m.p ? { ...m, p: m.p.map(([x, y]) => [x + ox, y + oy]) } : m);
  v = { ...piece, W, H, ox, oy, marks: () => sh }; SHIFTED.set(piece, v); return v; }
// average SS x SS blocks of a supersampled ImageData down to w x h (colour weighted by its alpha)
function down(img, w, h, SS) { const { width: W, data: A } = img, Hh = img.height, out = new ImageData(w, h), O = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, gg = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < SS; j++) { const yy = y * SS + j; if (yy >= Hh) continue; for (let i = 0; i < SS; i++) { const xx = x * SS + i; if (xx >= W) continue; const k = (yy * W + xx) * 4, al = A[k + 3]; r += A[k] * al; gg += A[k + 1] * al; b += A[k + 2] * al; a += al; n++; } }
    const o = (y * w + x) * 4; if (a) { O[o] = r / a; O[o + 1] = gg / a; O[o + 2] = b / a; } O[o + 3] = n ? a / n : 0; }
  return out; }
// a piece printed at d device px a CSS px. ss: printed at ss times that and averaged down, so a painted edge is antialiased
// (the paint's own edge is a threshold of the pecked hollow, a hard step in a single pixel otherwise); the edge zone still
// opens by the screen's own size (zdpr). By default (stage 12) only below 1.5 device px a CSS px: at 2x a step is half a CSS px.
export function render(piece0, theme, d, { ss = d < 1.5 ? 2 : 1 } = {}) {
  const piece = painted(piece0), look = LOOK[theme](piece.u ?? 4), F = field(piece.W, piece.H, d);
  let img; if (ss === 1) img = renderRock(F, piece, look);
  else { const S2 = field(piece.W, piece.H, d * ss); S2.zdpr = d; img = down(renderRock(S2, piece, look), F.cw, F.ch, ss); }
  return { img, W: piece.W, H: piece.H, ox: piece.ox, oy: piece.oy };
}
// drawn (?draw): the piece pecked pass by pass, then painted stroke by stroke, onto g (its canvas F.cw x F.ch)
export function writer(piece0, theme, d, cv) { const piece = painted(piece0), F = field(piece.W, piece.H, d); cv.width = F.cw; cv.height = F.ch;
  return { w: rockWriter(F, piece, LOOK[theme](piece.u ?? 4), cv.getContext('2d'), { dur: piece.dur ?? 2400 }), cw: F.cw, ch: F.ch, W: piece.W, H: piece.H, ox: piece.ox, oy: piece.oy }; }
// the builders, by name (a job: [name, ...arguments])
export const BUILD = { drop: R.initial, line: R.lineInitial, paraph: R.paraph, filler: R.filler, brk: R.brk, runout: R.runout, frame: R.frame, sheet: R.sheetPiece };
export const pieceOf = job => BUILD[job[0]](...job.slice(1));
export const makePiece = (job, d, theme, o) => render(pieceOf(job), theme, d, o);
