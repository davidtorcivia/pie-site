// The touch and manifest icons (art/icon-180.png, art/icon-512.png): the favicon's mark, a black asterisk on yellow
import puppeteer from 'puppeteer-core';
const ROOT = new URL('..', import.meta.url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--disable-gpu'] });
for (const n of [180, 512]) {
  const p = await b.newPage(); await p.setViewport({ width: n, height: n });
  await p.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?display=block&family=Archivo:wdth,wght@62..125,100..900">
    <body style="margin:0;width:${n}px;height:${n}px;background:#ffd21a;display:flex;align-items:center;justify-content:center;overflow:hidden">
    <span style="font-family:Archivo;font-weight:900;font-variation-settings:'wdth' 125;font-size:${n * 1.15}px;line-height:1;transform:translateY(${n * .2}px);color:#0e0d0b">*</span></body>`);
  await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: ROOT + `art/icon-${n}.png` }); await p.close();
}
await b.close(); console.log('icons');
