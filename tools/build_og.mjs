// The share images (Open Graph / Twitter): tools/og.html rendered at 1200 x 630 for each page -> art/og/<page>.jpg
import puppeteer from 'puppeteer-core'; import { mkdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname; mkdirSync(ROOT + 'art/og', { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--disable-gpu'] });
for (const page of ['home', 'dictionary', 'voices']) {
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://localhost:4747/tools/og.html?page=${page}`); await p.waitForFunction(() => document.title === 'ready', { timeout: 60000 });
  await p.screenshot({ path: ROOT + `art/og/${page}.jpg`, type: 'jpeg', quality: 88 }); await p.close(); console.log(page);
}
await b.close();
