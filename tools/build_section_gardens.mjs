// Steppe gardens for the page's sections: for each, the section and the things in it are measured on the live page at
// 1440 px wide (dev server running), and a continuous garden (florilegium + tools/steppe-svg.lua, steppe flora) is
// grown round them, never under them, with no footer stem and no clip, so every plant ends where it grows to. Two
// seeds are laid one over another so their species interleave. Output: art/garden-<name>.webp on transparent, laid
// behind the section by js/main.js (.garden layer).
//   node tools/build_section_gardens.mjs [name ...]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname, FL = ROOT + 'vendor/florilegium';
// name: section (the box the garden fills), what it must grow round, its inks
// side: 'field' grows round the obstacles over the whole box; 'left' / 'right' is a manuscript margin, a full-height
// garden in a column COL of the box's width (florilegium's own page composition; right is the left one mirrored)
const COL = .27;
export const SECTIONS = {
  open: { box: '#s-open', side: 'field', avoid: ['.hero-cap', '.open-h .line', '.open-p'], ink: '2A1F12', accent: 'A8361F', seeds: [23, 58] },
  wheel: { box: '#s-wheel .wheel-pin', side: 'left', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [77, 141] },
  machine: { box: '#s-machine', side: 'right', avoid: [], ink: '5A3B18', accent: '1F5A43', seeds: [91, 203] },
  voice: { box: '#s-voice', side: 'left', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [17, 99] },
  apps: { box: '#s-apps', side: 'right', avoid: [], ink: 'D9CFB4', accent: 'FFD21A', seeds: [61, 113] },
  foot: { box: 'footer', side: 'left', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [31, 177] },
};
const MM = 420 / 1440;                    // mm per CSS px: one scale for every garden on the page
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SECTIONS);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
await pg.goto('http://localhost:4747/?nogarden', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 6000));
for (const name of names) {
  const S = SECTIONS[name];
  const m = await pg.evaluate(S => {
    const box = document.querySelector(S.box); if (!box) return null;
    const B = box.getBoundingClientRect(), rects = [];
    for (const sel of S.avoid) document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height) rects.push([r.left - B.left, r.top - B.top, r.right - B.left, r.bottom - B.top]); });
    // a garden that ends above something (the herd): its ground line is that thing's top
    const stop = S.stopAt && document.querySelector(S.stopAt), hh = stop ? stop.getBoundingClientRect().top - B.top + 10 : B.height;
    return { w: B.width, h: hh, full: B.height, rects: rects.filter(r => r[1] < hh) };
  }, S);
  if (!m) { console.log(name, 'not found'); continue; }
  // one continuous garden over the section, growing round the obstacles: the free region is the page cut at the
  // obstacles' edges (PIE_OBSTACLES, steppe-svg.lua), and no branch is grown across one. Two seeds, laid one over the
  // other, interleave their species.
  const W = m.w * MM, H = m.h * MM, PAD = .5, layers = [];
  const obstacles = m.rects.map(([x0, y0, x1, y1]) => [x0 * MM / 10 - PAD, (m.h - y1) * MM / 10 - PAD, x1 * MM / 10 + PAD, (m.h - y0) * MM / 10 + PAD].map(v => v.toFixed(2)).join(',')).join(';');
  const field = S.side === 'field';
  S.seeds.forEach((seed, k) => {
    const out = ROOT + `art/garden-${name}-${k}.svg`;
    const geo = field ? ['--left', `${(W - 4).toFixed(1)}mm`, '--right', '2mm', '--top', '5mm', '--bottom', '4mm', '--density', '.8']
      : ['--left', `${(W * COL).toFixed(1)}mm`, '--right', '15mm', '--top', '10mm', '--bottom', '8mm', '--density', k ? '.55' : '1'];
    for (let tr = 0; tr < 8; tr++) try {
      execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', String(seed + tr * 1000), '--paper', `${W.toFixed(1)}x${H.toFixed(1)}`, ...geo,
        '--ink', S.ink, '--accent', S.accent, '--season', ['summer', 'spring', 'autumn'][(seed + k) % 3], '--nohead', ...(k ? ['--novisitors'] : []), '-o', out],
        { cwd: FL, env: { ...process.env, PIE_NOFOOTER: '1', ...(field ? { PIE_OBSTACLES: obstacles } : {}) }, stdio: 'pipe' });
      layers.push({ side: 'page', mirror: S.side === 'right', c: 0, cw: m.w, ext: m.h, bp: 0, f: out }); break;
    } catch { /* a seed florilegium cannot grow on this page: the next */ }
  });
  const SC = 1.6, CW = Math.round(m.w * SC), CH = Math.round(m.h * SC);
  const p2 = await b.newPage();
  await p2.setContent(`<body style="margin:0"><canvas id=c width=${CW} height=${CH}></canvas></body>`);
  const url = await p2.evaluate(async (srcs, CW, CH, rects, SC, W0, H0) => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    g.scale(SC, SC);
    for (const L of srcs) {
      const im = new Image(); im.src = L.src; await im.decode();
      g.save();
      if (L.side === 'page') { if (L.mirror) { g.translate(W0, 0); g.scale(-1, 1); } g.drawImage(im, 0, 0, W0, H0); g.restore(); continue; }
      if (L.side === 'bottom') g.translate(L.c, H0);
      else if (L.side === 'left') { g.translate(0, L.c); g.rotate(Math.PI / 2); }
      else { g.translate(W0, L.c); g.rotate(-Math.PI / 2); }
      g.drawImage(im, -L.cw / 2 - L.bp, -L.ext - L.bp, L.cw + 2 * L.bp, L.ext + 2 * L.bp);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // painterly pass: the garden repainted in brush strokes. Each stroke takes the colour beneath it and runs along the
    // drawing's local direction (the structure tensor of its luminance: along a stem, across a petal's veins), tapered,
    // laid in two sizes; the crisp drawing stays faintly beneath so the detail survives
    const src = g.getImageData(0, 0, CW, CH), d = src.data, W = CW, H = CH;
    const lum = new Float32Array(W * H), A = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { A[i] = d[i * 4 + 3] / 255; lum[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255 * A[i] + (1 - A[i]); }
    const J = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, gx = lum[i + 1] - lum[i - 1], gy = lum[i + W] - lum[i - W]; J[0][i] = gx * gx; J[1][i] = gx * gy; J[2][i] = gy * gy; }
    const box = (M, R) => { const T = new Float32Array(W * H);
      for (let y = 0; y < H; y++) { let s = 0; for (let x = -R; x < W; x++) { if (x + R < W) s += M[y * W + x + R]; if (x - R - 1 >= 0) s -= M[y * W + x - R - 1]; if (x >= 0) T[y * W + x] = s; } }
      for (let x = 0; x < W; x++) { let s = 0; for (let y = -R; y < H; y++) { if (y + R < H) s += T[(y + R) * W + x]; if (y - R - 1 >= 0) s -= T[(y - R - 1) * W + x]; if (y >= 0) M[y * W + x] = s; } } };
    J.forEach(M => { box(M, 3); box(M, 3); });
    const ang = i => .5 * Math.atan2(2 * J[1][i], J[0][i] - J[2][i]) + Math.PI / 2;
    const out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d');
    o.globalAlpha = .6; o.drawImage(c, 0, 0); o.globalAlpha = 1; o.lineCap = 'round';
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const [sp, L, wmul] of [[3.2 * SC, 7 * SC, 1.2], [1.8 * SC, 4 * SC, .8]]) {
      for (let y = 0; y < H; y += sp) for (let x = 0; x < W; x += sp) {
        const px = Math.min(W - 1, Math.round(x + (rnd() - .5) * sp)), py = Math.min(H - 1, Math.round(y + (rnd() - .5) * sp)), i = py * W + px;
        if (A[i] < .25) continue;
        const a = ang(i), len = L * (.5 + rnd() * .8), dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
        o.strokeStyle = `rgba(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]},${(.55 + rnd() * .4) * A[i]})`;
        o.lineWidth = sp * wmul * (.6 + rnd() * .6);
        o.beginPath(); o.moveTo(px - dx, py - dy); o.quadraticCurveTo(px + Math.sin(a) * len * .08, py - Math.cos(a) * len * .08, px + dx, py + dy); o.stroke();
      }
    }
    // thin parts (stars, sparkles, tendrils, hairline stems) keep the crisp drawing: where the alpha does not survive
    // an erosion of two pixels, the original is put back over the paint
    const R2 = 2, er = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let mn = 1; for (let dy = -R2; dy <= R2 && mn > 0; dy++) for (let dx = -R2; dx <= R2; dx++) { const yy = y + dy, xx = x + dx; const a = yy < 0 || xx < 0 || yy >= H || xx >= W ? 0 : A[yy * W + xx]; if (a < mn) mn = a; } er[y * W + x] = mn; }
    const po = o.getImageData(0, 0, W, H), pd = po.data;
    for (let i = 0; i < W * H; i++) if (A[i] > .2 && er[i] < .2) { const k = i * 4; pd[k] = d[k]; pd[k + 1] = d[k + 1]; pd[k + 2] = d[k + 2]; pd[k + 3] = Math.max(pd[k + 3], d[k + 3]); }
    o.putImageData(po, 0, 0);
    g.clearRect(0, 0, CW, CH); g.drawImage(out, 0, 0);
    return c.toDataURL('image/webp', .84);
  }, layers.map(L => ({ ...L, src: 'data:image/svg+xml;base64,' + readFileSync(L.f).toString('base64') })), CW, CH, m.rects, SC, m.w, m.h);
  await p2.close();
  const buf = Buffer.from(url.split(',')[1], 'base64'); writeFileSync(ROOT + `art/garden-${name}.webp`, buf);
  layers.forEach(L => rmSync(L.f));
  console.log(name, `${Math.round(m.w)}×${Math.round(m.h)} px, ${m.rects.length} obstacles, ${layers.length} plants, ${(buf.length / 1024) | 0} KB`);
}
await b.close();
