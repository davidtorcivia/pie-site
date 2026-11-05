// The dispersal, as an engraved atlas plate: hachured relief and water-lined seas (map/relief.webp, built by
// tools/build_map.py) printed as ink on paper, lettered in spaced capitals and italics, with each branch's route
// engraved in red ochre as the reader scrolls, ending at its first written witness. A painted horse gallops along
// the route being drawn.
import { loadMask, paintSilhouette } from './painter.js';

// routes: lon/lat waypoints from the steppe to the place of each branch's earliest substantial texts
export const ROUTES = [
  { b: 'Anatolian', w: 'Hittite tablets', at: 'Hattusa', y: -1650, pts: [[40, 48], [32, 47.2], [28, 44.5], [28.6, 41.4], [31.5, 40.4], [34.6, 40.0]] },
  { b: 'Indo-Iranian', w: 'the Rigveda', at: 'Punjab', y: -1400, pts: [[40, 48], [50, 51], [59.5, 52.6], [66, 47.5], [64, 40.5], [66.5, 35.5], [71.5, 32.5], [75.5, 30.8]] },
  { b: 'Greek', w: 'Linear B', at: 'Mycenae', y: -1400, pts: [[40, 48], [32, 47.2], [28, 45], [25.5, 42.5], [22.9, 40.4], [22.75, 37.73]] },
  { b: 'Italic', w: 'Latin inscriptions', at: 'Rome', y: -600, pts: [[40, 48], [30, 47.2], [22, 46.6], [15.5, 46.0], [12.2, 44.2], [12.5, 41.9]] },
  { b: 'Celtic', w: 'Lepontic inscriptions', at: 'Lake Como', y: -550, pts: [[40, 48], [30, 48.4], [21, 48.5], [14, 47.9], [10.5, 47], [9.1, 46.0]] },
  { b: 'Germanic', w: 'the first runes', at: 'Vimose', y: 200, pts: [[40, 48], [31, 51.2], [22, 52.6], [15, 54], [10.2, 55.3]] },
  { b: 'Armenian', w: 'the Armenian Bible', at: 'Vagharshapat', y: 410, pts: [[40, 48], [43, 45.6], [44.6, 42.9], [44.3, 40.16]] },
  { b: 'Tocharian', w: 'Tarim Basin manuscripts', at: 'Kucha', y: 600, pts: [[40, 48], [52, 51], [66, 51.8], [80, 51.6], [86.5, 49.8], [86.5, 45.5], [83.2, 41.7]] },
  { b: 'Balto-Slavic', w: 'Old Church Slavonic', at: 'Great Moravia', y: 870, pts: [[40, 48], [34, 51.5], [28, 53.6], [23.5, 54.4], [19.5, 51.2], [17.4, 49.1]] },
  { b: 'Albanian', w: 'a baptismal formula', at: 'Mat', y: 1462, pts: [[40, 48], [30, 47.2], [24.5, 44.6], [21, 42.6], [19.9, 41.6]] },
];
// lettering: regions in spaced roman capitals, waters in italic
const REGIONS = [
  ['PONTIC–CASPIAN STEPPE', 44.5, 48.6, 46], ['ANATOLIA', 32.5, 38.0, 30], ['IRANIAN PLATEAU', 56, 32.2, 30], ['TARIM', 83, 39.6, 26],
  ['BALKANS', 22.6, 43.6, 22], ['ALTAI', 87.5, 50.5, 20], ['INDUS', 70.2, 27.4, 22], ['ARABIA', 45, 24, 30], ['SCANDINAVIA', 15.5, 61, 24], ['GAUL', 2.2, 46.2, 24],
];
const WATERS = [['Black Sea', 34.5, 43.3, 30], ['Caspian Sea', 50.8, 41.6, 26], ['Mediterranean Sea', 18, 34.6, 34], ['Baltic', 19.4, 57.4, 24], ['Atlantic Ocean', -8.2, 41, 28], ['Aral', 59.9, 45.3, 18], ['Persian Gulf', 51.2, 27.3, 20], ['Arabian Sea', 64.5, 20, 30]];

const fmtYear = y => y < 0 ? `${-y} BCE` : `${y} CE`;
const NS = 'http://www.w3.org/2000/svg';

export async function mapPlate(root) {
  const P = await fetch('map/projection.json').then(r => r.json());
  const xy = (lon, lat) => [(lon - P.lon0) * P.k * P.px, (P.lat1 - lat) * P.px];
  const stage = root.querySelector('.plate'), svg = root.querySelector('.plate svg');
  svg.setAttribute('viewBox', `0 0 ${P.w} ${P.h}`);
  stage.style.setProperty('--pw', P.w); stage.style.setProperty('--ph', P.h);
  // Catmull–Rom through the waypoints
  const smooth = pts => {
    const p = pts.map(([a, b]) => xy(a, b)); let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const [hx, hy] = xy(40, 48);
  svg.innerHTML = `
    <g class="letters">${REGIONS.map(([t, lo, la, s]) => { const [x, y] = xy(lo, la); return `<text class="rg" x="${x}" y="${y}" font-size="${s}" text-anchor="middle">${t}</text>`; }).join('')}
      ${WATERS.map(([t, lo, la, s]) => { const [x, y] = xy(lo, la); return `<text class="wt" x="${x}" y="${y}" font-size="${s}" text-anchor="middle">${t}</text>`; }).join('')}</g>
    <g class="home"><ellipse cx="${hx}" cy="${hy}" rx="150" ry="70" /><ellipse cx="${hx}" cy="${hy}" rx="128" ry="56" class="in"/></g>
    <g class="routes">${ROUTES.map((r, i) => `<path id="rt${i}" class="rt" d="${smooth(r.pts)}"/><path class="rt2" d="${smooth(r.pts)}"/>`).join('')}</g>
    <g class="ends">${ROUTES.map((r, i) => { const [x, y] = xy(...r.pts[r.pts.length - 1]); return `<g class="end" data-i="${i}"><circle cx="${x}" cy="${y}" r="13"/><circle cx="${x}" cy="${y}" r="5" class="dot"/>
      <text class="br" x="${x + 22}" y="${y - 10}" font-size="34">${r.b.toUpperCase()}</text><text class="wit" x="${x + 22}" y="${y + 26}" font-size="22">${r.w}, ${r.at}, ${fmtYear(r.y)}</text></g>`; }).join('')}</g>
    <image class="horse" width="190" height="110" href=""/>`;
  const paths = [...svg.querySelectorAll('.rt')], under = [...svg.querySelectorAll('.rt2')], ends = [...svg.querySelectorAll('.end')];
  const lens = paths.map(p => p.getTotalLength());
  paths.forEach((p, i) => { p.style.strokeDasharray = `${lens[i]}`; p.style.strokeDashoffset = `${lens[i]}`; under[i].style.strokeDasharray = `2 9`; under[i].style.opacity = 0; });
  // the painted gallop: 11 Muybridge frames, painted once
  const horseImg = svg.querySelector('.horse'), frames = [];
  (async () => {
    const pal = { ground: '#2a120c', mids: ['#5e1a0e', '#7a2414', '#8e2a17', '#a8361f', '#c0582f'], lights: ['#d9824e', '#e8a46a', '#f0c08a'], paper: '#efe7d6', accent: '#2f5e8e' };
    for (let k = 1; k <= 11; k++) {
      const m = await loadMask(`art/horse/frame-${String(k).padStart(2, '0')}.png`), ar = m.naturalHeight / m.naturalWidth;
      const c = document.createElement('canvas'), w = 300, h = w * ar; c.width = w * 2.4; c.height = h * 2.4; const g = c.getContext('2d'); g.scale(2, 2);
      paintSilhouette(g, m, w * .1, h * .1, w, h, { ...pal, seed: 4, density: 1.4, mane: [.6, .84] });
      frames.push(c.toDataURL());
    }
  })();
  let frame = 0, last = 0;
  // the camera: close on the steppe at first, pulling back as the branches spread
  const cam = { x: hx, y: hy, s: 2.6 };
  const place = () => {
    const vw = stage.clientWidth, vh = stage.clientHeight, base = Math.max(vw / P.w, vh / P.h) * 1.0;
    const s = base * cam.s, tx = vw / 2 - cam.x * s, ty = vh / 2 - cam.y * s;
    const lim = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    root.querySelector('.plate-inner').style.transform = `translate(${lim(tx, vw - P.w * s, 0)}px, ${lim(ty, vh - P.h * s, 0)}px) scale(${s})`;
  };
  const yearEl = root.querySelector('.mig-year');
  const update = p => {
    // 0–.08 the homeland; .08–.92 the branches, in order of their first texts; the camera eases out to the whole plate
    const n = ROUTES.length, span = .84 / n;
    cam.s = 2.6 - 1.6 * Math.min(1, p / .7); cam.x = hx + (P.w * .52 - hx) * Math.min(1, p / .7); cam.y = hy + (P.h * .5 - hy) * Math.min(1, p / .7);
    place();
    let active = -1;
    ROUTES.forEach((r, i) => {
      const k = Math.min(1, Math.max(0, (p - .08 - i * span) / (span * 1.6)));
      paths[i].style.strokeDashoffset = `${lens[i] * (1 - k)}`;
      under[i].style.opacity = k > 0 ? .55 : 0;
      ends[i].style.opacity = Math.min(1, Math.max(0, (k - .85) / .15));
      if (k > 0 && k < 1) active = i;
    });
    const k0 = p < .08 ? -1 : Math.min(n - 1, Math.floor((p - .08) / span));
    yearEl.textContent = p < .08 ? 'c. 4000 BCE' : fmtYear(ROUTES[Math.max(0, k0)].y);
    root.querySelectorAll('.mig-p').forEach(el => { const on = +el.dataset.step === Math.min(3, Math.floor(p * 4.2)); el.classList.toggle('on', on); });
    // the horse rides the route being drawn
    if (active >= 0 && frames.length === 11) {
      const i = active, k = Math.min(1, Math.max(0, (p - .08 - i * span) / (span * 1.6))), L = lens[i] * k;
      const a = paths[i].getPointAtLength(Math.max(0, L - 1)), b = paths[i].getPointAtLength(L);
      const flip = b.x < a.x;
      horseImg.setAttribute('x', b.x - 95); horseImg.setAttribute('y', b.y - 100);
      horseImg.setAttribute('transform', flip ? `translate(${2 * b.x},0) scale(-1,1)` : '');
      horseImg.style.opacity = 1;
    } else horseImg.style.opacity = 0;
  };
  // the gallop keeps time on its own, at 11 frames a second
  const tick = t => { if (frames.length === 11 && t - last > 90) { frame = (frame + 1) % 11; horseImg.setAttribute('href', frames[frame]); last = t; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  update(0);
  ScrollTrigger.create({ trigger: root, start: 'top top', end: '+=420%', pin: root.querySelector('.mig-pin'), scrub: true, onUpdate: s => update(s.progress) });
  addEventListener('resize', () => place());
}
