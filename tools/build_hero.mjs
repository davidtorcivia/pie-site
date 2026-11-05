// The header's field: upright steppe gardens (florilegium, tools/steppe-svg.lua), one in each free column of the
// header, rising from their own foot, never under the title, the initial, the paragraph or the herd. Rendered in
// charcoal with a madder accent on transparent, laid on the yellow, saved as art/hero.webp.
//   node tools/build_hero.mjs          (dev server running: the columns are measured on the live page at 1440×900)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname, FL = ROOT + 'vendor/florilegium';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
await pg.goto('http://localhost:4747/', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 5000));
// free columns: right of the title; under the title right of the paragraph (two); a narrow one left of the paragraph
const cols = await pg.evaluate(() => {
  const H = document.querySelector('#s-open').getBoundingClientRect(), q = s => document.querySelector(s).getBoundingClientRect();
  const t = q('.hero-title'), p = q('.open-p'), herd = q('.hero-herd'), W = H.width, Hh = H.height, pad = 18;
  const foot = herd.top - H.top + 20, out = [];
  const add = (x0, y0, x1, y1) => { if (x1 - x0 > 60 && y1 - y0 > 70) out.push([x0 / W, y0 / Hh, x1 / W, y1 / Hh]); };
  add(t.right + pad, 8, W - 6, foot);
  // pockets right of the shorter title lines, above the longest
  const lines = [...document.querySelectorAll('.open-h .line')].map(l => l.getBoundingClientRect());
  const longest = lines.reduce((a, b) => b.right > a.right ? b : a);
  const shortR = Math.max(...lines.filter(l => l !== longest && l.top < longest.top).map(l => l.right));
  if (longest.top - 8 > 120) add(shortR + pad, 8, t.right + pad, longest.top - 4);
  const mx = (p.right + pad + (t.right + pad)) / 2;
  add(p.right + pad, t.bottom + pad, mx, foot); add(mx, t.bottom + pad, t.right + pad, foot);
  add(6, p.bottom + 6, p.right + pad, foot);
  return out;
});
console.log('columns', cols.map(c => c.map(v => v.toFixed(2)).join(',')).join(' | '));
const PW = 420, PH = 262, files = [], BL = 10;           // bleed, mm: nothing is cut square at a column's edge
// split each free area into narrow, overlapping plants of differing height, like a meadow
const plants = [];
cols.forEach(([x0, y0, x1, y1], ci) => {
  const n = Math.max(1, Math.round((x1 - x0) * PW / 48));
  for (let k = 0; k < n; k++) {
    const a = x0 + (x1 - x0) * k / n, b = x0 + (x1 - x0) * (k + 1) / n, ov = (b - a) * .18;
    const top = y0 + (y1 - y0) * [0, .12, .05, .2, .08][(ci * 3 + k) % 5];
    plants.push([Math.max(x0, a - ov), top, Math.min(x1, b + ov), y1]);
  }
});
plants.forEach(([x0, y0, x1, y1], i) => {
  const w = (x1 - x0) * PW, h = (y1 - y0) * PH, out = ROOT + `art/hero-${i}.svg`;
  let ok = false;
  for (let tr = 0; tr < 6 && !ok; tr++) try { execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', String(311 + i * 17 + tr * 1000), '--paper', `${w.toFixed(1)}x${h.toFixed(1)}`,
    '--left', `${(w - 2).toFixed(1)}mm`, '--right', '1mm', '--top', '4mm', '--bottom', '4mm', '--ink', '2A1F12', '--accent', 'A8361F',
    '--season', ['summer', 'spring', 'autumn', '0.35', '0.7'][i % 5], '--bleed', `${BL}mm`, '--nohead', '-o', out], { cwd: FL, env: { ...process.env, PIE_NOFOOTER: '1' }, stdio: 'pipe' }); ok = true; } catch { /* a seed florilegium cannot grow on this page: the next */ }
  if (!ok) return;
  files.push([out, x0 - BL / PW, y0 - BL / PH, x1 + BL / PW, y1 + BL / PH]);
});
const S = 1.9, CW = Math.round(1440 * S), CH = Math.round(900 * S);
await pg.setContent(`<body style="margin:0"><canvas id=c width=${CW} height=${CH}></canvas></body>`);
const url = await pg.evaluate(async (parts, CW, CH) => {
  const c = document.getElementById('c'), g = c.getContext('2d');
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, CW, CH);
  for (const [src, x0, y0, x1, y1] of parts) { const im = new Image(); im.src = src; await im.decode(); g.drawImage(im, x0 * CW, y0 * CH, (x1 - x0) * CW, (y1 - y0) * CH); }
  return c.toDataURL('image/webp', .86);
}, files.map(([f, ...r]) => ['data:image/svg+xml;base64,' + readFileSync(f).toString('base64'), ...r]), CW, CH);
writeFileSync(ROOT + 'art/hero.webp', Buffer.from(url.split(',')[1], 'base64'));
files.forEach(([f]) => rmSync(f)); await b.close(); console.log('hero', CW, CH);
