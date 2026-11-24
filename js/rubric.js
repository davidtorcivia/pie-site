// The site's rubrication (illum, "Rock carving": the pecked and painted figures of Tanum, in iron-oxide red), from a
// pinned copy of the library in illum/<hash>/ (the hash is the kit's own, illum/<hash>/hash.json). /illum/* is served
// immutable for a year (_headers), and the kit's imports are relative and unversioned, so an update never goes into
// the same directory: copy the new kit to illum/<its new hash>/, change KIT below, delete the old directory, one commit.
const KIT = '../illum/d2fe4bf38bfdabd9/illum.js';
export const canCarve = () => typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && !location.search.includes('noillum');

const whenIdle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 350 }) : setTimeout(fn, 180));

let kit;
const loadKit = () => kit ??= (async () => {
  if (!canCarve()) return null;
  await Promise.all(['900 20px Archivo', '500 20px Newsreader', '600 20px Newsreader', 'italic 20px "Instrument Serif"', '500 14px "JetBrains Mono"']
    .map(f => document.fonts.load(f).catch(() => {})));
  try { const m = await import(KIT); document.documentElement.classList.add('illum'); return m; } catch { return null; }
})();

// Wait until the host is near the viewport and the browser has a brief idle beat before loading illum's ~175 KB kit,
// so hero fonts and initial art arrive first without delaying carving until mid-scroll.
function waitReady(host, eager, margin = '480px 0px') {
  if (eager) return Promise.resolve();
  return new Promise(resolve => {
    let done = false, io;
    const go = () => { if (done) return; done = true; io?.disconnect(); kit ? resolve() : whenIdle(resolve); };
    const r = host.getBoundingClientRect();
    if (r.top < innerHeight + 480 && r.bottom > -480) { go(); return; }
    io = new IntersectionObserver(es => { if (es[0].isIntersecting) go(); }, { rootMargin: margin });
    io.observe(host);
  });
}

// rubricate one host (its own text is the root unless opts.root says otherwise); null when it cannot run.
// Uses cache: false by default so illum never stalls scrolling with main-thread PNG band serialization
// (styles/rock.js already reuses rendered piece bitmaps in memory).
export async function carve(host, opts = {}) {
  if (!canCarve() || !host?.isConnected) return null;
  const { root = host, eager = false, ...o } = opts;
  await waitReady(host, eager);
  if (!host.isConnected) return null;
  const m = await loadKit(); if (!m || !host.isConnected) return null;
  let busy = true, lastW = host.clientWidth, lastH = host.clientHeight, timer;
  const onDrawn = () => { busy = false; lastW = host.clientWidth; lastH = host.clientHeight; };
  root.addEventListener('illum:drawn', onDrawn);
  const r = m.rubricate(root, { host, style: 'rock', rich: 0.5, draw: 'still', cache: false, ...o });
  const redraw = () => { busy = true; r.redraw(); };
  const on = () => redraw(); addEventListener('themechange', on);
  // illum already redraws on width change; only redraw here if height shifts after drawing settles (e.g. lazy content)
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (busy) return;
      const w = host.clientWidth, h = host.clientHeight;
      if (w !== lastW) { lastW = w; lastH = h; return; }
      if (Math.abs(h - lastH) > 4) { lastH = h; redraw(); }
    }, 250);
  });
  ro.observe(host);
  return { redraw, destroy() { ro.disconnect(); clearTimeout(timer); root.removeEventListener('illum:drawn', onDrawn); removeEventListener('themechange', on); r.destroy(); } };
}

// the article pages: carve each section and divider lazily as it nears the viewport so GPU canvas memory stays ~20 MB
// instead of a single 300 MB full-page canvas.
export function rubric() {
  const art = document.querySelector('main.v-art');
  if (!art || !canCarve()) return null;
  // Wrap bare <hr> dividers inside a positioned .v-brk host (void elements cannot host canvases directly)
  art.querySelectorAll(':scope > hr').forEach(hr => {
    const wrap = document.createElement('div');
    wrap.className = 'v-brk';
    hr.replaceWith(wrap);
    wrap.append(hr);
  });
  const jobs = [];
  art.querySelectorAll(':scope > section.sec').forEach(sec => {
    jobs.push(carve(sec, { select: { filler: ':scope > p.book', figure: 'figure:not(.fig-ex)' } }));
  });
  art.querySelectorAll(':scope > .v-brk').forEach((brk, i) => {
    jobs.push(carve(brk, { seed: 4100 + i * 97, select: { initial: NONE, drop: NONE, heading: NONE, paraph: NONE, filler: NONE, figure: NONE, quote: NONE, code: NONE, pull: NONE, aside: NONE, nav: NONE } }));
  });
  return Promise.all(jobs);
}

// no element: for a host that wants only some of illum's cases
export const NONE = ':not(*)';
