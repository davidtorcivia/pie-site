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
// where each leaf's text ends, measured on the live page (the dev server must be running): the garden fills the rest
const site = await b.newPage(); await site.setViewport({ width: 1440, height: 900 });
await site.goto('http://localhost:4747/', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 6000));
const ends = await site.evaluate(() => [...document.querySelectorAll('.leaf')].map(l => {
  const L = l.getBoundingClientRect(), t = l.querySelector('.txt'), kids = [...t.children].filter(k => k.offsetParent);
  const bottom = Math.max(...kids.map(k => k.getBoundingClientRect().bottom));
  return (bottom - L.top) / L.height;
}));
await site.close();
console.log('text ends', ends.map(x => x.toFixed(2)).join(' '));
const p = await b.newPage(); await p.setViewport({ width: 605, height: 786, deviceScaleFactor: 2.6 });   // the SVG's own size (160 × 208 mm), at print-like density
// each leaf: the margin garden (no text-end fill), and a second garden grown sideways and turned upright, so its
// plants rise from the foot of the page into the space under the text
// GROW=N: also render the growth (frames 1..N of florilegium's recording) as gardens/leaf-<i>.mp4, played as the leaf is reached
const GROW = +(process.env.GROW || 0);
const lua = (args, out, f) => execFileSync('lua', ['../../tools/steppe-svg.lua', ...args, '-o', out], { cwd: FL, env: { ...process.env, ...(f ? { PIE_FRAME: `${f}/${GROW}` } : {}) } });
const ONLY = process.env.LEAVES ? process.env.LEAVES.split(',').map(Number) : null;
for (let i = 0; i < n; i++) {
  if (ONLY && !ONLY.includes(i)) continue;
  const k = pal[i % pal.length], main = ROOT + `gardens/leaf-${i}.svg`, rise = ROOT + `gardens/rise-${i}.svg`;
  const top = ends[i] * 208 + 14, Hb = Math.max(14, 208 - 14 - top), Wb = 160 - 50 - 8;
  const mainArgs = ['--seed', String(101 + i * 7), '--paper', '160x208', '--left', '43mm', '--right', '12mm', '--top', '24mm', '--bottom', '22mm',
    '--ink', k.ink.slice(1), '--accent', k.accent.slice(1), '--background', k.paper.slice(1), '--season', SEASONS[i % SEASONS.length], '--nohead'];
  const riseArgs = ['--seed', String(5003 + i * 11), '--paper', `${Hb.toFixed(1)}x${Wb}`, '--left', `${(Hb - 3).toFixed(1)}mm`, '--right', '1mm', '--top', '2mm', '--bottom', '2mm',
    '--ink', k.ink.slice(1), '--accent', k.accent.slice(1), '--season', SEASONS[(i + 2) % SEASONS.length], '--density', '.7', '--nohead', '--novisitors'];
  const frame = async (f, type) => {
    lua(mainArgs, main, f);
    const hasRise = Hb >= 28;                        // a leaf whose text runs long has no room under it
    if (hasRise) lua(riseArgs, rise, f);
    await p.setContent(`<body style="margin:0"><canvas id=c width=${Math.round(605 * 2.6)} height=${Math.round(786 * 2.6)}></canvas></body>`);
    const buf = await p.evaluate(async (main, rise, top, Hb, Wb, type, PAPER) => {
      const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
      const [A, B] = await Promise.all([load(main), rise ? load(rise) : null]), c = document.getElementById('c'), g = c.getContext('2d'), mm = c.width / 160;
      g.drawImage(A, 0, 0, c.width, c.height);
      // rotate the sideways garden so its left edge (where the stems rise) becomes the foot
      if (B) { g.save(); g.translate(50 * mm, (top + Hb) * mm); g.rotate(-Math.PI / 2); g.drawImage(B, 0, 0, Hb * mm, Wb * mm); g.restore(); }
      return c.toDataURL(type, .86);
    }, 'data:image/svg+xml;base64,' + readFileSync(main).toString('base64'), hasRise ? 'data:image/svg+xml;base64,' + readFileSync(rise).toString('base64') : null, top, Hb, Wb, type, k.paper);
    return Buffer.from(buf.split(',')[1], 'base64');
  };
  const out = await frame(0, 'image/webp'); writeFileSync(ROOT + `gardens/leaf-${i}.webp`, out);
  if (GROW) {
    const dir = ROOT + `gardens/grow-${i}`; mkdirSync(dir, { recursive: true });
    for (let f = 1; f <= GROW; f++) writeFileSync(`${dir}/f${String(f).padStart(3, '0')}.png`, await frame(f, 'image/png'));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '12', '-i', `${dir}/f%03d.png`, '-vf', 'scale=1000:-2,tpad=stop_mode=clone:stop_duration=0.5,format=yuv420p',
      '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', ROOT + `gardens/leaf-${i}.mp4`]);
    rmSync(dir, { recursive: true });
  }
  rmSync(main); rmSync(rise, { force: true });
  console.log('leaf', i, k.name, (out.length / 1024).toFixed(0) + ' KB', GROW ? `+ growth ${(readFileSync(ROOT + `gardens/leaf-${i}.mp4`).length / 1024) | 0} KB` : '');
}
await b.close();
