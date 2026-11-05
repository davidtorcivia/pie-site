// One thick brush stroke, painted once per seed: hundreds of bristle hairs dragged left to right, each starting a
// little before or after the others (a ragged, loaded start), thinning and lifting toward the end (dry brush),
// with the edges wavering. Returned as a data URL, stretched over whatever it grounds (HTML or SVG).
const cache = new Map();
export function brushStroke(color = '#ffd21a', seed = 1, { w = 900, h = 180 } = {}) {
  const key = color + seed + w + h; if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hex = color.replace('#', ''), base = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const tint = k => `rgb(${base.map(v => Math.max(0, Math.min(255, Math.round(v + k)))).join(',')})`;
  // the body's outline: a slight swell after the start, edges wandering
  const wob = [r() * 6, r() * 6, r() * 6];
  // each stroke its own: where it swells, how it slants, how long the dry tail, how loaded the start
  const swell = .15 + r() * .5, slant = (r() - .5) * .16, tail = .62 + r() * .25, load = .7 + r() * .6, thin = .32 + r() * .14, rough = .5 + r();
  const half = x => (thin + .1 + .07 * Math.exp(-((x - swell) ** 2) / .03) + .03 * rough * Math.sin(x * 11 + wob[1])) * h * Math.min(1, .55 + x * 6) * (1 - .3 * Math.pow(x, 3));
  const mid = x => h / 2 + slant * h * (x - .5) + .05 * h * Math.sin(x * 2.4 + wob[2]);
  g.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const v = r() * 2 - 1, x0 = (r() * .05 + Math.abs(v) * .035) * w, x1 = w * (.86 + r() * .14 - Math.pow(Math.abs(v), 2) * .12);
    g.strokeStyle = tint((r() - .5) * 26); g.globalAlpha = .55 + r() * .45; g.lineWidth = 1.2 + r() * 3.2;
    let px = x0, py = mid(x0 / w) + v * half(x0 / w);
    for (let x = x0; x < x1; x += 6) {
      const u = x / w, ny = mid(u) + v * half(u) + (r() - .5) * .8;
      // dry brush: toward the end the hair skips
      if (u > tail && r() < (u - tail) * 1.8) { px = x; py = ny; continue; }
      g.beginPath(); g.moveTo(px, py); g.lineTo(x + 6, ny); g.stroke(); px = x + 6; py = ny;
    }
  }
  // the loaded start: a rounded blot where the brush touched down
  g.globalAlpha = .9; g.fillStyle = color;
  g.beginPath(); g.ellipse(w * .035, mid(.03), w * .03 * load, half(.04) * (.9 + .2 * load), slant, 0, Math.PI * 2); g.fill();
  const url = c.toDataURL(); cache.set(key, url); return url;
}

// every stroke on the page takes a new seed, so no two are alike
let counter = 0;
export const uniqueSeed = () => 1000 + 7919 * ++counter;
// ground an HTML element with a brush stroke (as its background)
// the page uses pre-rendered strokes (art/brush/NN.webp, tools/build_static.mjs): one per element, none repeated
export const BRUSHES = 64;
let nextBrush = 0;
export const brushUrl = () => `art/brush/${String(nextBrush++ % BRUSHES).padStart(2, '0')}.webp`;
export function brushGround(el, _seed, color) {
  if (!el._brush) el._brush = brushUrl();
  el.style.backgroundImage = `url(${el._brush})`;
  el.style.backgroundSize = '100% 100%'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundColor = 'transparent';
}
