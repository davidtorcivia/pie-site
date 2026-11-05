// Growth videos for the section gardens: florilegium's own growth recording (frames 1..N of N: stems rise, leaves
// open, flowers bloom in the order they grew), each frame painted (tools/paintpass.js, steady from frame to frame) and
// encoded as WebM with transparency. The page plays it once when the section is reached and rests on the last frame;
// art/garden-<name>.webp (the finished garden) stays as the poster and the fallback.
//   node tools/build_growth.mjs [name ...]          (dev server running: the layout is measured on the live page)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { SECTIONS as DESK, COL, MM, PHONE_AVOID } from './gardens-config.mjs';
const PHONE = !!process.env.PHONE, SFX = PHONE ? '-m' : '';
// on phones every garden is a field round the content
const SECTIONS = PHONE ? Object.fromEntries(Object.entries(DESK).map(([k, S]) => [k, { ...S, side: 'field', avoid: PHONE_AVOID[k] || S.avoid, keepTop: S.keepTop ? .35 : 0 }])) : DESK;
const ROOT = new URL('..', import.meta.url).pathname, FL = ROOT + 'vendor/florilegium', N = +(process.env.FRAMES || 40), SC = process.env.PHONE ? 2.2 : 1.25;
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SECTIONS);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--disable-gpu'] });
const pg = await b.newPage(); await pg.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
await pg.goto('http://localhost:4747/?nogarden', { waitUntil: 'networkidle2' }); await new Promise(r => setTimeout(r, 6000));
for (const name of names) {
  const S = SECTIONS[name];
  const m = await pg.evaluate(S => {
    const box = document.querySelector(S.box); if (!box) return null;
    const B = box.getBoundingClientRect(), rects = [];
    for (const sel of S.avoid) document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height) rects.push([r.left - B.left, r.top - B.top, r.right - B.left, r.bottom - B.top]); });
    return { w: B.width, h: B.height, rects };
  }, S);
  if (!m) continue;
  if (S.keepTop) m.rects.push([0, m.h * S.keepTop, m.w, m.h]);                  // grow only in the upper part
  if (S.turn) m.rects = m.rects.map(([x0, y0, x1, y1]) => [m.w - x1, m.h - y1, m.w - x0, m.h - y0]);   // in the turned page
  const W = m.w * MM, H = m.h * MM, PAD = .5, field = S.side === 'field';
  const obstacles = m.rects.map(([x0, y0, x1, y1]) => [x0 * MM / 10 - PAD, (m.h - y1) * MM / 10 - PAD, x1 * MM / 10 + PAD, (m.h - y0) * MM / 10 + PAD].map(v => v.toFixed(2)).join(',')).join(';');
  const dir = ROOT + `art/growth-${name}${SFX}`; mkdirSync(dir, { recursive: true });
  // one working seed per layer, found on the final frame and kept for every frame
  const seeds = S.seeds.map((seed, k) => {
    for (let tr = 0; tr < 8; tr++) { try { lua(seed + tr * 1000, k, N, '/tmp/pie-probe.svg'); return seed + tr * 1000; } catch {} }
    return null;
  }).filter(x => x !== null);
  function lua(seed, k, f, out) {
    const geo = field ? ['--left', `${(W - 4).toFixed(1)}mm`, '--right', '2mm', '--top', '5mm', '--bottom', '4mm', '--density', '.8']
      : ['--left', `${(W * (S.side === 'both' ? .24 : COL)).toFixed(1)}mm`, '--right', '15mm', '--top', '10mm', '--bottom', '8mm', '--density', S.side === 'both' ? '1' : k ? '.55' : '1'];
    execFileSync('lua', ['../../tools/steppe-svg.lua', '--seed', String(seed), '--paper', `${W.toFixed(1)}x${H.toFixed(1)}`, ...geo,
      '--ink', S.ink, '--accent', S.accent, '--season', ['summer', 'spring', 'autumn'][(S.seeds[k] + k) % 3], '--nohead', ...(S.turn ? ['--novisitors'] : []), ...(k ? ['--novisitors'] : []), '-o', out],
      { cwd: FL, env: { ...process.env, PIE_NOFOOTER: '1', PIE_FRAME: `${f}/${N}`, ...(field ? { PIE_OBSTACLES: obstacles } : {}) }, stdio: 'pipe' });
  }
  const CW = Math.round(m.w * SC) & ~1, CH = Math.round(m.h * SC) & ~1;
  const p2 = await b.newPage();
  await p2.setContent(`<body style="margin:0"><canvas id=c width=${CW} height=${CH}></canvas></body>`);
  await p2.addScriptTag({ content: readFileSync(ROOT + 'tools/paintpass.js', 'utf8') });
  for (let f = 1; f <= N; f++) {
    const svgs = seeds.map((seed, k) => { const out = `${dir}/l${k}.svg`; lua(seed, k, f, out); return { src: 'data:image/svg+xml;base64,' + readFileSync(out).toString('base64'), mirror: S.side === 'right' || (S.side === 'both' && k === 1), turn: !!S.turn }; });
    const url = await p2.evaluate(async (L, CW, CH, SC) => {
      const c = document.getElementById('c'), g = c.getContext('2d'); g.clearRect(0, 0, CW, CH);
      for (const l of L) { const im = new Image(); im.src = l.src; await im.decode(); g.save(); if (l.mirror) { g.translate(CW, 0); g.scale(-1, 1); } if (l.turn) { g.translate(CW, CH); g.rotate(Math.PI); } g.drawImage(im, 0, 0, CW, CH); g.restore(); }
      window.paintPass(c, SC);
      return c.toDataURL('image/png');
    }, svgs, CW, CH, SC);
    writeFileSync(`${dir}/f${String(f).padStart(3, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
    if (f === N) writeFileSync(ROOT + `art/garden-${name}${SFX}.webp`, Buffer.from((await p2.evaluate(() => document.getElementById('c').toDataURL('image/webp', .84))).split(',')[1], 'base64'));
  }
  await p2.close();
  // VP9 with alpha; the last frame held a moment so the video ends on the finished garden
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '12', '-i', `${dir}/f%03d.png`, '-vf', 'tpad=stop_mode=clone:stop_duration=0.5',
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '36', '-auto-alt-ref', '0', '-row-mt', '1', ROOT + `art/growth-${name}${SFX}.webm`]);
  rmSync(dir, { recursive: true });
  console.log(name + SFX, `${N} frames`, (readFileSync(ROOT + `art/growth-${name}${SFX}.webm`).length / 1024 | 0) + ' KB');
}
await b.close();
