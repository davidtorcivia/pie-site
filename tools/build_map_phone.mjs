// Half-size copies of the map plate's images for phones (map/*-m.webp): iOS Safari kills a page whose decoded images
// and canvases outgrow its memory, and the full plate (4400 x 6487, three layers) does. Dev server running.
import puppeteer from 'puppeteer-core'; import { writeFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--disable-gpu'] });
const p = await b.newPage(); await p.goto('http://localhost:4747/tools/palette.json');
for (const [src, q] of [['relief-l', .62], ['wash', .8], ['arrows', .9]]) {
  const d = await p.evaluate(async (src, q) => { const im = new Image(); im.src = `/map/${src}.webp`; await im.decode();
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth / 2); c.height = Math.round(im.naturalHeight / 2);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/webp', q); }, src, q);
  writeFileSync(ROOT + `map/${src}-m.webp`, Buffer.from(d.split(',')[1], 'base64')); console.log(src, 'done');
}
await b.close();
