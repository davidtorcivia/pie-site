// Rock's pieces built off the page's thread (kit/styles/rock.js starts a few of these): each job built and printed as on
// the page (kit/styles/rock-print.js, the one path) and handed back as a bitmap. No face to load: the letters are carved.
//   { id, job, d, theme } -> { id, canvas (ImageBitmap), w, h, ox, oy } | { id, error }
import { makePiece } from './rock-print.js';

onmessage = ({ data }) => {
  try { const r = makePiece(data.job, data.d, data.theme), c = new OffscreenCanvas(r.img.width, r.img.height); c.getContext('2d').putImageData(r.img, 0, 0);
    const canvas = c.transferToImageBitmap(); postMessage({ id: data.id, canvas, w: r.img.width, h: r.img.height, ox: r.ox, oy: r.oy }, [canvas]); }
  catch (e) { postMessage({ id: data.id, error: String(e) }); }
};
