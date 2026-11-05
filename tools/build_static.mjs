// Pre-renders everything the page would otherwise draw at load (dev server running): the initials, the brush strokes,
// the painted map arrows; and re-encodes the map relief smaller.
import puppeteer from 'puppeteer-core'; import { writeFileSync, mkdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
for (const d of ['art/initials', 'art/brush']) mkdirSync(ROOT + d, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const save = (path, d) => writeFileSync(ROOT + path, Buffer.from(d.split(',')[1], 'base64'));
let p = await b.newPage(); await p.goto('http://localhost:4747/tools/static-render.html');
await p.waitForFunction(() => document.title === 'done', { timeout: 300000 });
for (const [k, d] of Object.entries(await p.evaluate(() => window.OUT))) save('art/' + k, d);
p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:4747/?buildarrows&nogarden'); await p.waitForFunction(() => window.__ARROWS, { timeout: 300000 });
save('map/arrows.webp', await p.evaluate(() => window.__ARROWS));
await b.close(); console.log('static art built');
