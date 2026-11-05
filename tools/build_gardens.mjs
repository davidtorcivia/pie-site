// Pre-render a florilegium garden for each manuscript leaf, in that leaf's ink, then rasterize it to WebP.
//   node tools/build_gardens.mjs [count]
// florilegium (vendor/florilegium, MIT) draws the garden with a steppe flora (tools/steppe-svg.lua); lua 5.4+.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname, FL = ROOT + 'vendor/florilegium/';
const pal = JSON.parse(readFileSync(ROOT + 'tools/palette.json', 'utf8'));
const n = +(process.argv[2] || JSON.parse(readFileSync(ROOT + 'data/site.json', 'utf8')).specimens.length);
const SEASONS = ['summer', 'spring', 'autumn', 'summer', '0.35', '0.8'];
mkdirSync(ROOT + 'gardens', { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
// where each leaf's text ends, measured on the live page (the dev server must be running): the garden fills the rest
const site = await b.newPage(); await site.setViewport({ width: 1440, height: 900 });
await site.goto('http://localhost:4747/', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 6000));
const ends = await site.evaluate(() => [...document.querySelectorAll('.leaf')].map(l => {
  const L = l.getBoundingClientRect(), t = l.querySelector('.txt'), kids = [...t.children].filter(k => k.offsetParent);
  const bottom = Math.max(...kids.map(k => k.getBoundingClientRect().bottom));
  return (bottom - L.top) / L.height;
}));
await site.close();
console.log('text ends', ends.map(x => x.toFixed(2)).join(' '));
const p = await b.newPage(); await p.setViewport({ width: 605, height: 786, deviceScaleFactor: 2.6 });   // the SVG's own size (160 × 208 mm), at print-like density
// each leaf: the margin garden (no text-end fill), and a second garden grown sideways and turned upright, so its
// plants rise from the foot of the page into the space under the text
const lua = (args, out) => execFileSync('lua', ['../../tools/steppe-svg.lua', ...args, '-o', out], { cwd: FL });
for (let i = 0; i < n; i++) {
  const k = pal[i % pal.length], main = ROOT + `gardens/leaf-${i}.svg`, rise = ROOT + `gardens/rise-${i}.svg`;
  lua(['--seed', String(101 + i * 7), '--paper', '160x208', '--left', '50mm', '--right', '12mm', '--top', '24mm', '--bottom', '22mm',
    '--ink', k.ink.slice(1), '--accent', k.accent.slice(1), '--background', k.paper.slice(1), '--season', SEASONS[i % SEASONS.length], '--nohead'], main);
  // the free body under the text, in mm: from the text's end to the foot, across the text column
  const top = ends[i] * 208 + 4, Hb = Math.max(20, 208 - 14 - top), Wb = 160 - 50 - 8;
  lua(['--seed', String(5003 + i * 11), '--paper', `${Hb.toFixed(1)}x${Wb}`, '--left', `${(Hb - 3).toFixed(1)}mm`, '--right', '1mm', '--top', '2mm', '--bottom', '2mm',
    '--ink', k.ink.slice(1), '--accent', k.accent.slice(1), '--season', SEASONS[(i + 2) % SEASONS.length], '--density', '.7', '--nohead', '--novisitors'], rise);
  await p.setContent(`<body style="margin:0"><canvas id=c width=${Math.round(605 * 2.6)} height=${Math.round(786 * 2.6)}></canvas></body>`);
  const buf = await p.evaluate(async (main, rise, top, Hb, Wb) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const [A, B] = await Promise.all([load(main), load(rise)]), c = document.getElementById('c'), g = c.getContext('2d'), mm = c.width / 160;
    g.drawImage(A, 0, 0, c.width, c.height);
    // rotate the sideways garden so its left edge (where the stems rise) becomes the foot
    g.save(); g.translate(50 * mm, (top + Hb) * mm); g.rotate(-Math.PI / 2); g.drawImage(B, 0, 0, Hb * mm, Wb * mm); g.restore();
    return c.toDataURL('image/webp', .86);
  }, 'data:image/svg+xml;base64,' + readFileSync(main).toString('base64'), 'data:image/svg+xml;base64,' + readFileSync(rise).toString('base64'), top, Hb, Wb);
  const out = Buffer.from(buf.split(',')[1], 'base64'); writeFileSync(ROOT + `gardens/leaf-${i}.webp`, out); rmSync(main); rmSync(rise);
  console.log('leaf', i, k.name, (out.length / 1024).toFixed(0) + ' KB');
}
await b.close();
