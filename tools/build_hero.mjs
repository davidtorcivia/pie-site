// The header's field: a steppe garden (florilegium, tools/steppe-svg.lua) grown over the whole page, in charcoal
// ink with a madder accent on the yellow ground, rasterized to art/hero.webp.
//   node tools/build_hero.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname, svg = ROOT + 'art/hero.svg';
execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', '211', '--paper', '420x262', '--left', '10mm', '--right', '6mm', '--top', '8mm',
  '--bottom', '6mm', '--textend', '1mm', '--bleed', '8mm', '--ink', '2A1F12', '--accent', 'A8361F', '--background', 'FFD21A', '--nohead', '-o', svg], { cwd: ROOT + 'vendor/florilegium' });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1648, height: 1050, deviceScaleFactor: 1.6 });
await p.goto('file://' + svg); await new Promise(r => setTimeout(r, 500));
const dims = await p.evaluate(() => { const s = document.querySelector('svg').getBoundingClientRect(); return [s.width, s.height]; });
await p.setViewport({ width: Math.ceil(dims[0]), height: Math.ceil(dims[1]), deviceScaleFactor: 1.6 });
writeFileSync(ROOT + 'art/hero.webp', await p.screenshot({ type: 'webp', quality: 84 }));
rmSync(svg); await b.close(); console.log('hero', dims);
