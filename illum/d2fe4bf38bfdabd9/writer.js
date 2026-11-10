// The writer: one ink medium for a whole page, however long.
// A browser allows a handful of WebGL contexts and a long page is tens of millions of pixels, so the medium is a
// working window (a sheet of fixed size) laid over the part of the page being written. Ink is written into it; when
// the next mark lies outside it, or wants another ink, the window's ink is dried and pressed into the page's own 2D
// layer, and the window moves on, clean. The paper's grain is continuous across windows (it is sampled in page
// coordinates). The ink is laid as its own colour with an opacity, on any ground, live and baked alike (multiplying
// onto the page's transparent ink layer would press the window's white into it).
//
//   const W = createWriter(host, bake, { dpr, dark });     // host: positioned element; bake: its 2D context (page px)
//   const part = W.part(t0, t1, strokes, ink);              // strokes: [{ pts: [[x, y]...] page px, w }], ink: [r,g,b]
//   part.at(f) while it is being written, part.done() when finished; W.flush() at the end; W.destroy().
import { createMedium, Pen } from './medium.js';

const arclen = p => p.reduce((a, q, i) => i ? a + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);

// The ink engine wants a real GPU: WebGL2 with float targets, not a software rasteriser (SwiftShader, llvmpipe, WARP: there a
// page of ink takes tens of seconds, nearly all of it in copying each window back). Without one the stamped pen draws the
// lines and the letters are laid flat (kit/inkletter.js), as with ink: 'pen'. Asked once a page.
let ok = null;
export function supported() {
  if (ok !== null) return ok;
  try { const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    // (the medium renders into half-float targets: full float or the half-float extension will do — many phones' GPUs
    // have only the latter)
    if (!gl?.getExtension('EXT_color_buffer_float') && !gl?.getExtension('EXT_color_buffer_half_float')) return ok = false;
    const info = gl.getExtension('WEBGL_debug_renderer_info'), name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return ok = !/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|warp/i.test(name); }
  catch { return ok = false; }
}

export function createWriter(host, bake, { dpr = Math.min(2, devicePixelRatio || 1), dark = false, size = [1100, 800] } = {}) {
  let shown = false, cv = null, M = null, pen = null, win = null, ink = null, dirty = false, baseAngle = .62;
  // a window at least `size`, larger if one mark needs it, and never wider than the page
  const page = () => [host.scrollWidth || host.clientWidth, host.scrollHeight || host.clientHeight];
  function open(bb) {
    const [PW, PH] = page(), w = Math.ceil(Math.min(PW, Math.max(size[0], bb[2] - bb[0] + 24))), h = Math.ceil(Math.min(PH, Math.max(size[1], bb[3] - bb[1] + 24)));
    const x = Math.max(0, Math.min(PW - w, Math.floor(bb[0] - 12))), y = Math.max(0, Math.min(PH - h, Math.floor(bb[1] - 12)));
    if (!cv || cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      kill(); cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      Object.assign(cv.style, { position: 'absolute', width: w + 'px', height: h + 'px', pointerEvents: 'none', visibility: shown ? '' : 'hidden' });
      host.appendChild(cv);
      M = createMedium(cv, { dpr, paper: [255, 255, 255] }); M.wetness(0); M.settings.over = true;
      pen = new Pen(M, { exact: true, flex: .15, use: .6 }); baseAngle = pen.angle;
    } else M.clear();
    Object.assign(cv.style, { left: x + 'px', top: y + 'px' });
    M.makePaper([x * dpr, y * dpr]); win = [x, y, x + w, y + h];
  }
  // dry what the window holds and press it into the page, then clear it
  function flush() {
    if (!M || !dirty) return;
    M.finish(); M.render();
    bake.save(); bake.setTransform(1, 0, 0, 1, 0, 0); bake.globalCompositeOperation = 'source-over';
    bake.drawImage(cv, win[0] * dpr, win[1] * dpr); bake.restore();
    M.clear(); if (shown) M.render(); dirty = false;
  }
  function kill() { if (cv) { cv.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); } cv = M = pen = null; }
  function ensure(bb, rgb) {
    const fits = win && bb[0] >= win[0] && bb[1] >= win[1] && bb[2] <= win[2] && bb[3] <= win[3];
    if (fits && ink && ink.join() === rgb.join()) return;
    flush(); if (!fits) open(bb); else M.clear();
    ink = rgb; M.settings.ink = rgb;
  }

  // a run of strokes in one ink, written between t0 and t1 (seconds on the score); the hand slows into and out of each
  // The nib: its edge is s.w * width CSS px wide and s.hair (CSS px; default s.w * hair) thick; with no s.w, width and
  // hair are themselves CSS px. Per stroke too: s.angle (the nib's angle, radians above the line; default the pen's),
  // s.press (f in 0..1 along the stroke -> a width multiplier: a designed swell), s.rho (how heavily it is laid).
  function part(t0, t1, strokes, rgb, { width = 1.2, hair = .85, angle = null } = {}) {
    strokes = strokes.filter(s => s.pts.length > 1);
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of strokes) for (const [x, y] of s.pts) bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)];
    bb = [bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6];
    const total = strokes.reduce((a, s) => a + arclen(s.pts) + 15, 0) || 1, plan = []; let u = 0;
    for (const s of strokes) {
      const P = s.pts, L = arclen(P); let acc = 0; plan.push({ u, dip: true, w: (s.w ?? 1) * width, hair: s.hair ?? (s.w ?? 1) * hair, angle: s.angle ?? angle });
      P.forEach((q, i) => { if (i) acc += Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]); const f = L ? acc / L : 0;
        const e = f - Math.sin(2 * Math.PI * f) / (2 * Math.PI) * .6;
        plan.push({ u: u + e * L / total, x: q[0], y: q[1], p: .5 + .25 * Math.cos(Math.PI * f) ** 2 * (s.rho ?? 1), wm: s.press ? s.press(f) : 1 }); });
      u += L / total; plan.push({ u, lift: true }); u += 15 / total;
    }
    let k = 0, last = 0, begun = false;
    const self = { t0, t1, bbox: bb, strokes,
      at(f, live = true) {
        if (!begun) { ensure(bb, rgb); begun = true; }
        const span = Math.max(1, (self.t1 - self.t0) * 1000), t = f * span, [ox, oy] = win;
        while (k < plan.length && plan[k].u * span <= t) { const h = plan[k++], ht = h.u * span;
          if (h.dip) { if (pen.charge < .45) pen.dip(); pen.width = h.w; pen.hairline = h.hair; pen.angle = h.angle ?? baseAngle; }
          else if (h.lift) { pen.update(ht); pen.lift(); if (live) M.step(16); }
          else pen.hand(h.x - ox, h.y - oy, h.p, ht, h.wm); }
        pen.update(t); M.step(Math.min(50, Math.max(1, t - last))); last = t; if (live) { M.render(); if (!shown) { shown = true; cv.style.visibility = ''; } } dirty = true;
      },
      done() { self.at(1 + 1e-6, false); } };
    return self;
  }
  // warm: make the medium now (its first creation costs a frame or two), so the first mark written does not stall
  const warm = () => { if (!cv) open([0, 0, 1, 1]); };
  return { part, flush, warm, destroy: () => { kill(); win = ink = null; }, get dark() { return dark; } };
}
