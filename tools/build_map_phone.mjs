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
// the phone plate, flat: the wash with the engraved relief printed over it in ink (what .relief's luminance mask does
// live on desktop), one image instead of a masked layer over a background layer
{
  const d = await p.evaluate(async () => {
    const load = async s => { const im = new Image(); im.src = s; await im.decode(); return im; };
    const [wash, relief] = await Promise.all([load('/map/wash-m.webp'), load('/map/relief-l-m.webp')]);
    const W = wash.naturalWidth, H = wash.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(wash, 0, 0, W, H);
    const r = document.createElement('canvas'); r.width = W; r.height = H; const rg = r.getContext('2d'); rg.drawImage(relief, 0, 0, W, H);
    const A = g.getImageData(0, 0, W, H), R = rg.getImageData(0, 0, W, H).data, a = A.data, ink = [0x2a, 0x22, 0x19];
    for (let i = 0; i < a.length; i += 4) { const m = (R[i] * .2126 + R[i + 1] * .7152 + R[i + 2] * .0722) / 255;   // luminance = ink coverage
      for (let k = 0; k < 3; k++) a[i + k] = a[i + k] * (1 - m) + ink[k] * m; }
    g.putImageData(A, 0, 0); return c.toDataURL('image/webp', .8);
  });
  writeFileSync(ROOT + 'map/plate-m.webp', Buffer.from(d.split(',')[1], 'base64')); console.log('plate-m done');
}
await b.close();
