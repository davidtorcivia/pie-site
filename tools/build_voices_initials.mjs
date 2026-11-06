// Pre-renders the voices page's drop caps (tools/voices-initials.html) to art/initials/voices/<L>.webp (dev server running)
import puppeteer from 'puppeteer-core'; import { writeFileSync, mkdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname; mkdirSync(ROOT + 'art/initials/voices', { recursive: true });
const PORT = process.env.PORT || 4747;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://localhost:${PORT}/tools/voices-initials.html`); await p.waitForFunction(() => document.title === 'done', { timeout: 300000 });
for (const [k, d] of Object.entries(await p.evaluate(() => window.OUT))) writeFileSync(ROOT + `art/initials/voices/${k}.webp`, Buffer.from(d.split(',')[1], 'base64'));
await b.close(); console.log('voices initials built');
