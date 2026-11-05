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
const p = await b.newPage(); await p.setViewport({ width: 605, height: 786, deviceScaleFactor: 2.6 });   // the SVG's own size (160 × 208 mm), at print-like density
for (let i = 0; i < n; i++) {
  const k = pal[i % pal.length], svg = ROOT + `gardens/leaf-${i}.svg`;
  execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', String(101 + i * 7), '--paper', '160x208', '--left', '50mm', '--right', '12mm',
    '--top', '22mm', '--bottom', '22mm', '--ink', k.ink.slice(1), '--accent', k.accent.slice(1), '--background', k.paper.slice(1),
    '--season', SEASONS[i % SEASONS.length], '--nohead', '-o', svg], { cwd: FL });
  await p.goto('file://' + svg); await new Promise(r => setTimeout(r, 300));
  const buf = await p.screenshot({ type: 'webp', quality: 86, clip: { x: 0, y: 0, width: 604.7, height: 786.1 } });
  writeFileSync(ROOT + `gardens/leaf-${i}.webp`, buf); rmSync(svg);
  console.log('leaf', i, k.name, (buf.length / 1024).toFixed(0) + ' KB');
}
await b.close();
