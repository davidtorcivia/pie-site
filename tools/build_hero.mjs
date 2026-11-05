// The header's field: one continuous steppe garden (florilegium, tools/steppe-svg.lua) over the whole header,
// growing round the title, the initial, the paragraph and the herd, never under them (PIE_OBSTACLES, measured on the
// live page at 1440×900), with no footer stem. Three sparse gardens of different seeds are laid one over another so
// their species interleave instead of one plant repeating across the field.
//   node tools/build_hero.mjs          (dev server running)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname, FL = ROOT + 'vendor/florilegium';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
await pg.goto('http://localhost:4747/', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 5000));
const boxes = await pg.evaluate(() => {
  const H = document.querySelector('#s-open').getBoundingClientRect();
  const f = el => { const r = el.getBoundingClientRect(); return [(r.left - H.left) / H.width, (r.top - H.top) / H.height, (r.right - H.left) / H.width, (r.bottom - H.top) / H.height]; };
  return [...document.querySelectorAll('.hero-cap, .open-h .line, .open-p, .hero-herd')].map(f);
});
// header fractions -> page cm (420×262 mm paper, 6 mm bleed: the image spans 43.2 × 27.4 cm, y up from the foot)
const PAD = .4, obstacles = boxes.map(([a, b, c, d]) => [-0.6 + a * 43.2 - PAD, -0.6 + (1 - d) * 27.4 - PAD, -0.6 + c * 43.2 + PAD, -0.6 + (1 - b) * 27.4 + PAD].map(v => v.toFixed(2)).join(',')).join(';');
const layers = [];
for (const [k, seed] of [[0, 23], [1, 58]]) {
  const out = ROOT + `art/hero-${k}.svg`;
  for (let tr = 0; tr < 6; tr++) try {
    execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', String(seed + tr * 1000), '--paper', '420x262', '--left', '414mm', '--right', '2mm',
      '--top', '6mm', '--bottom', '6mm', '--bleed', '6mm', '--density', '.8', '--ink', '2A1F12', '--accent', 'A8361F',
      '--season', ['summer', 'spring', 'autumn'][k], '--nohead', '-o', out], { cwd: FL, env: { ...process.env, PIE_NOFOOTER: '1', PIE_OBSTACLES: obstacles }, stdio: 'pipe' });
    layers.push(out); break;
  } catch { /* a seed florilegium cannot grow here: the next */ }
}
const S = 1.9, CW = Math.round(1440 * S), CH = Math.round(900 * S);
await pg.setContent(`<body style="margin:0"><canvas id=c width=${CW} height=${CH}></canvas></body>`);
const url = await pg.evaluate(async (srcs, CW, CH) => {
  const c = document.getElementById('c'), g = c.getContext('2d');
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, CW, CH);
  for (const src of srcs) { const im = new Image(); im.src = src; await im.decode(); g.drawImage(im, 0, 0, CW, CH); }
  return c.toDataURL('image/webp', .86);
}, layers.map(f => 'data:image/svg+xml;base64,' + readFileSync(f).toString('base64')), CW, CH);
writeFileSync(ROOT + 'art/hero.webp', Buffer.from(url.split(',')[1], 'base64'));
layers.forEach(f => rmSync(f)); await b.close(); console.log('hero layers', layers.length);
