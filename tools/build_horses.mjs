// Paints the gallop once, in each palette the page uses, to art/horse/paint-<pal>-NN.webp (dev server running).
import puppeteer from 'puppeteer-core'; import { writeFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
for (const pal of ['ochre', 'dark']) {
  const p = await b.newPage(); await p.goto(`http://localhost:4747/tools/horse-render.html?pal=${pal}`);
  await p.waitForFunction(() => document.title === 'done', { timeout: 300000 });
  (await p.evaluate(() => window.OUT)).forEach((d, i) => writeFileSync(ROOT + `art/horse/paint-${pal}-${String(i + 1).padStart(2, '0')}.webp`, Buffer.from(d.split(',')[1], 'base64')));
  await p.close(); console.log(pal, 'done');
}
await b.close();
