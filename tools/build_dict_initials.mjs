// Pre-renders the dictionary's initials (tools/dict-initials.html) to art/initials/dict/<codepoints>.webp (dev server running)
import puppeteer from 'puppeteer-core'; import { writeFileSync, mkdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname; mkdirSync(ROOT + 'art/initials/dict', { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:4747/tools/dict-initials.html'); await p.waitForFunction(() => document.title === 'done', { timeout: 600000 });
const out = await p.evaluate(() => window.OUT);
for (const [k, d] of Object.entries(out)) writeFileSync(ROOT + `art/initials/dict/${k}.webp`, Buffer.from(d.split(',')[1], 'base64'));
await b.close(); console.log(Object.keys(out).length, 'initials');
