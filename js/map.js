// The dispersal, as an engraved atlas plate: hachured relief and water-lined seas (map/relief-l.webp, built by
// tools/build_map.py) printed as ink on paper, lettered in spaced capitals and italics, with each branch's route
// engraved in red ochre as the reader scrolls, ending at its first written witness. A painted horse gallops along
// the route being drawn.
import { brushUrl } from './brush.js';

// Miller cylindrical projection constants (matches map/projection.json, inlined to avoid an extra boot round trip)
const PROJ = { lon0: -12.0, pxd: 40.74074074074074, r: 2334.2724986811318, y1: 1.9143949710937171, w: 4400, h: 6487 };

// routes: lon/lat waypoints along each branch's usual archaeological path (steppe hypothesis, simplified),
// from the steppe to the place of its earliest substantial texts
export const ROUTES = [
  { b: 'Anatolian', w: 'Hittite tablets', at: 'Hattusa', y: -1650, pts: [[37, 47.4], [33, 46.8], [28.6, 45.2], [26.6, 42.8], [28.9, 41.1], [31.8, 40.3], [34.6, 40.0]] },
  { b: 'Indo-Iranian', w: 'the Rigveda', at: 'Punjab', y: -1400, pts: [[44.5, 49.2], [46, 50.6], [53, 52.4], [59.5, 52.6], [65.5, 50.6], [68.5, 46.5], [66.8, 41.5], [66, 37.6], [69.5, 35.2], [72.3, 34.1], [75.5, 30.8]] },
  { b: 'Greek', w: 'Linear B', at: 'Mycenae', y: -1400, pts: [[36.6, 47.2], [33, 46.8], [29.2, 45.3], [26.2, 43.4], [23.6, 41.4], [22.4, 39.6], [22.75, 37.73]] },
  { b: 'Italic', w: 'Latin inscriptions', at: 'Rome', y: -600, pts: [[36.4, 47.6], [32, 47.6], [26, 46.6], [20.6, 47.1], [16.6, 46.4], [13.6, 45.9], [11.4, 44.7], [11.9, 43.2], [12.5, 41.9]] },
  { b: 'Celtic', w: 'Lepontic inscriptions', at: 'Lake Como', y: -550, pts: [[36.6, 48.1], [32, 47.9], [25.5, 47.6], [20.2, 47.8], [16.4, 48.2], [13.6, 47.8], [10.4, 47.9], [8.6, 47.4], [9.1, 46.0]] },
  { b: 'Germanic', w: 'the first runes', at: 'Vimose', y: 200, pts: [[37.4, 48.6], [33, 49.4], [26.5, 49.6], [21.5, 51.1], [17.5, 52.4], [13.8, 53.5], [10.8, 54.8], [10.2, 55.3]] },
  { b: 'Armenian', w: 'the Armenian Bible', at: 'Vagharshapat', y: 410, pts: [[40.6, 47.2], [40.4, 45.8], [42.4, 44.3], [44.6, 42.7], [44.6, 41.4], [44.3, 40.16]] },
  { b: 'Tocharian', w: 'Tarim Basin manuscripts', at: 'Kucha', y: 600, pts: [[45, 49.8], [47, 50.6], [54.5, 51.7], [63.5, 52.6], [72.5, 52.7], [80.5, 52.1], [85.6, 50.6], [86.2, 47.4], [85.2, 44.8], [83.2, 41.7]] },
  { b: 'Balto-Slavic', w: 'Old Church Slavonic', at: 'Great Moravia', y: 870, pts: [[38, 48.9], [34.5, 49.6], [30.5, 50.8], [26.5, 51.6], [22.5, 51.2], [19.6, 50.2], [17.4, 49.1]] },
  { b: 'Albanian', w: 'a baptismal formula', at: 'Mat', y: 1462, pts: [[36.8, 46.9], [33, 46.8], [28.9, 45.2], [24.6, 44.2], [21.6, 43.4], [20.4, 42.4], [19.9, 41.6]] },
];

// lettering: regions in spaced roman capitals, waters in italic
const REGIONS = [
  ['PONTIC–CASPIAN STEPPE', 44.5, 48.6, 46], ['ANATOLIA', 32.5, 38.0, 30], ['IRANIAN PLATEAU', 56, 32.2, 30], ['TARIM', 83, 39.6, 26],
  ['BALKANS', 22.6, 43.6, 22], ['ALTAI', 87.5, 50.5, 20], ['INDUS', 70.2, 27.4, 22], ['ARABIA', 45, 24, 30], ['SCANDINAVIA', 15.5, 61, 24], ['GAUL', 2.2, 46.2, 24],
];
const WATERS = [['Black Sea', 34.5, 43.3, 30], ['Caspian Sea', 50.8, 41.6, 26], ['Mediterranean Sea', 18, 34.6, 34], ['Baltic', 19.4, 57.4, 24], ['Atlantic Ocean', -8.2, 41, 28], ['Aral', 59.9, 45.3, 18], ['Persian Gulf', 51.2, 27.3, 20], ['Arabian Sea', 64.5, 20, 30]];

const fmtYear = y => y < 0 ? `${-y} BCE` : `${y} CE`;

export function mapPlate(root, { onNear } = {}) {
  const P = PROJ;
  const xy = (lon, lat) => [(lon - P.lon0) * P.pxd, (P.y1 - 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180))) * P.r];
  const stage = root.querySelector('.plate'), svg = root.querySelector('.plate svg');
  const PHONE = innerWidth < 900, SC = PHONE ? .3 : .75, M = PHONE ? '-m' : '';
  const paintCv = document.createElement('canvas');
  paintCv.className = 'paint'; paintCv.width = Math.round(P.w * SC); paintCv.height = Math.round(P.h * SC);
  svg.before(paintCv);
  svg.setAttribute('viewBox', `0 0 ${P.w} ${P.h}`);
  stage.style.setProperty('--pw', P.w); stage.style.setProperty('--ph', P.h);

  // a route: centripetal Catmull–Rom through waypoints, corner-cut twice (Chaikin), resampled by arc length
  const route = r => {
    const pts = r.pts.map(([a, b]) => xy(a, b)), out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), .5) || 1e-3;
      const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
      for (let k = 0; k < 16; k++) {
        const t = t1 + (t2 - t1) * k / 16, L = (a, b, ta, tb) => [0, 1].map(d => ((tb - t) * a[d] + (t - ta) * b[d]) / (tb - ta));
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    out.push(pts[pts.length - 1]);
    let Q = out;
    for (let pass = 0; pass < 2; pass++) { const R = [Q[0]]; for (let i = 0; i < Q.length - 1; i++) { const [a, b] = [Q[i], Q[i + 1]]; R.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } R.push(Q[Q.length - 1]); Q = R; }
    const acc = [0]; for (let i = 1; i < Q.length; i++) acc.push(acc[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
    const total = acc[acc.length - 1];
    return t => {
      if (t < 0) { const a = Math.atan2(Q[3][1] - Q[0][1], Q[3][0] - Q[0][0]), back = -t * total; return [Q[0][0] - Math.cos(a) * back, Q[0][1] - Math.sin(a) * back, a]; }
      const s = Math.min(total, Math.max(0, t * total)); let i = 1; while (i < acc.length - 1 && acc[i] < s) i++;
      const u = (s - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1), x = Q[i - 1][0] + (Q[i][0] - Q[i - 1][0]) * u, y = Q[i - 1][1] + (Q[i][1] - Q[i - 1][1]) * u;
      const j = Math.min(Q.length - 1, i + 2), h = Math.max(0, i - 3);
      return [x, y, Math.atan2(Q[j][1] - Q[h][1], Q[j][0] - Q[h][0])];
    };
  };
  const curves = ROUTES.map(route);

  // the arrow drawn to t = k: broad at the steppe, narrowing as it goes, with a head at its tip
  const W0 = 44, W1 = 9, HEAD = 62;
  const arrow = (f, k) => {
    if (k <= 0.002) return '';
    const CAP = .02, N = 140, L = [], R = [];
    const wOf = t => t < 0 ? W0 / 2 * 1.1 * Math.sqrt(Math.max(0, 1 - (t / CAP) ** 2)) : (W0 * (1 + .1 * Math.exp(-t * 40)) + (W1 - W0) * Math.pow(t, .8)) / 2;
    for (let i = 0; i <= N; i++) {
      const t = -CAP + (k + CAP) * i / N, [x, y, a] = f(t), w = wOf(t);
      L.push([x - Math.sin(a) * w, y + Math.cos(a) * w]); R.push([x + Math.sin(a) * w, y - Math.cos(a) * w]);
    }
    const [tx, ty, ta] = f(k), hw = Math.max(W1 * 1.9, wOf(k) * 2.3);
    const hx = tx + Math.cos(ta) * HEAD * .9, hy = ty + Math.sin(ta) * HEAD * .9;
    const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    return `M${L.map(pt).join('L')}L${pt([tx - Math.sin(ta) * hw, ty + Math.cos(ta) * hw])}L${pt([hx, hy])}L${pt([tx + Math.sin(ta) * hw, ty - Math.cos(ta) * hw])}L${R.reverse().map(pt).join('L')}Z`;
  };
  const [hx, hy] = xy(40, 48);

  svg.innerHTML = `
    <g class="letters">${REGIONS.map(([t, lo, la, s]) => { const [x, y] = xy(lo, la); return `<text class="rg" x="${x}" y="${y}" font-size="${s}" text-anchor="middle">${t}</text>`; }).join('')}
      ${WATERS.map(([t, lo, la, s]) => { const [x, y] = xy(lo, la); return `<text class="wt" x="${x}" y="${y}" font-size="${s}" text-anchor="middle">${t}</text>`; }).join('')}</g>
    <defs><pattern id="engr" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="7" height="7" fill="#9c2f19"/><line x1="0" y1="0" x2="0" y2="7" stroke="#6e1d0f" stroke-width="2.4"/></pattern></defs>
    <g class="routes">${ROUTES.map((r, i) => `<path class="arw" data-i="${i}" d=""/>`).join('')}</g>
    <g class="ends">${ROUTES.map((r, i) => { const [x, y] = xy(...r.pts[r.pts.length - 1]); return `<g class="end" data-i="${i}"><circle cx="${x}" cy="${y}" r="9"/>
      <g class="tag"><image class="lab" preserveAspectRatio="none" href="${brushUrl()}"/><text class="br" x="0" y="0" font-size="44">${r.b.toUpperCase()}</text><text class="wit" x="0" y="32" font-size="26">${r.w}, ${r.at}, ${fmtYear(r.y)}</text></g></g>`; }).join('')}</g>
    <g class="horses">${ROUTES.map(() => `<image class="horse" width="200" height="118" href=""/>`).join('')}</g>`;
  const ends = [...svg.querySelectorAll('.end')];

  // place every label so none overlaps another, or the lettering, or the plate's edge
  {
    const placed = [], hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const letters = [...svg.querySelectorAll('.letters text')].map(el => ({ el, b: el.getBBox() }));
    ends.forEach((g, i) => {
      const [x, y] = xy(...ROUTES[i].pts[ROUTES[i].pts.length - 1]), tag = g.querySelector('.tag'), txt = [...tag.querySelectorAll('text')];
      const bw = Math.max(...txt.map(e => e.getComputedTextLength())) + 44, bh = 96;
      const C = [[22, 18], [22, -bh - 14], [-bw - 22, 18], [-bw - 22, -bh - 14], [-bw / 2, 26], [-bw / 2, -bh - 26], [22, 60], [-bw - 22, 60], [22, -bh - 60], [-bw - 22, -bh - 60]];
      let best = null;
      for (const [dx, dy] of C) {
        const b = { x: x + dx, y: y + dy, w: bw, h: bh };
        if (b.x < 0 || b.y < 0 || b.x + bw > P.w || b.y + bh > P.h) continue;
        if (placed.some(p => hit(p, b))) continue;
        best = b; if (!letters.some(l => hit(l.b, b))) break;
      }
      best ||= { x: x + 22, y: y + 18, w: bw, h: bh };
      placed.push(best);
      tag.setAttribute('transform', `translate(${best.x},${best.y})`);
      txt[0].setAttribute('x', 22); txt[0].setAttribute('y', 50); txt[1].setAttribute('x', 22); txt[1].setAttribute('y', 82);
      const im = tag.querySelector('image'); im.setAttribute('width', bw); im.setAttribute('height', bh);
    });
    letters.forEach(l => { if (placed.some(p => hit(p, l.b))) l.el.style.display = 'none'; });
  }

  // Defer heavy map textures (relief, wash, arrows, horses) and the blurred homeland canvas until the reader
  // starts scrolling toward the map, so initial hero load downloads zero map megabytes and has zero long tasks.
  let painted = null, homeCv = null, assetsStarted = false, lastKs = ROUTES.map(() => 0);

  const buildHome = () => {
    const HOME = [[29, 47], [32.5, 49.3], [37, 51.2], [42.5, 52.4], [48.5, 52.2], [53, 50.4], [52.5, 47.6], [49, 45.8], [44, 44.9], [39, 45.3], [34, 45.6], [30.5, 46]];
    // A 34–48px blurred wash painted at 0.25× scale looks identical and runs 16× faster (~8ms vs 320ms)
    const HSC = SC * .25;
    const cv = document.createElement('canvas'); cv.width = Math.round(P.w * HSC); cv.height = Math.round(P.h * HSC);
    const g = cv.getContext('2d'); g.scale(HSC, HSC);
    const pts = HOME.map(([a, b]) => xy(a, b)), path = new Path2D(`M${pts.map(p => p.join(',')).join('L')}Z`);
    let s = 7; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    g.save(); g.filter = `blur(${34 * HSC / .75}px)`; g.fillStyle = 'rgba(178,40,18,.3)'; g.fill(path); g.restore();
    const marks = document.createElement('canvas'); marks.width = cv.width; marks.height = cv.height;
    const mk = marks.getContext('2d'); mk.scale(HSC, HSC); mk.lineCap = 'round';
    const [x0, y0] = xy(27, 54), [x1, y1] = xy(55, 43.5);
    for (let n = 0; n < 900; n++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), L = 30 + r() * 70, a = -.25 + r() * .5;
      mk.strokeStyle = ['rgba(176,36,16,.24)', 'rgba(150,28,12,.22)', 'rgba(200,70,30,.2)'][n % 3]; mk.lineWidth = 4 + r() * 8;
      mk.beginPath(); mk.moveTo(x, y); mk.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); mk.stroke();
    }
    mk.setTransform(1, 0, 0, 1, 0, 0); mk.globalCompositeOperation = 'destination-in'; mk.filter = `blur(${48 * HSC}px)`; mk.scale(HSC, HSC);
    mk.fillStyle = '#000'; mk.fill(path);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(marks, 0, 0);
    marks.width = marks.height = 0;
    return cv;
  };

  const pc = paintCv.getContext('2d');
  const paintArrows = ks => {
    lastKs = ks;
    if (!homeCv && !painted) return;
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, paintCv.width, paintCv.height);
    if (homeCv) {
      pc.globalAlpha = Math.max(.45, 1 - (window.__migP || 0) * 1.2);
      pc.drawImage(homeCv, 0, 0, paintCv.width, paintCv.height);
      pc.globalAlpha = 1;
    }
    if (painted) {
      pc.setTransform(SC, 0, 0, SC, 0, 0);
      const clip = new Path2D();
      ks.forEach((k, i) => { if (k > .002) clip.addPath(new Path2D(arrow(curves[i], k))); });
      pc.save(); pc.clip(clip); pc.setTransform(1, 0, 0, 1, 0, 0); pc.drawImage(painted, 0, 0); pc.restore();
    }
  };

  const horses = [...svg.querySelectorAll('.horse')];
  const frames = Array.from({ length: 11 }, (_, k) => `art/horse/paint-ochre-${String(k + 1).padStart(2, '0')}.webp`);

  const loadMapAssets = () => {
    if (assetsStarted) return;
    assetsStarted = true;
    document.documentElement.classList.add('map-near');
    onNear?.();
    homeCv = buildHome();
    paintArrows(lastKs);
    const im = new Image(); im.src = `map/arrows${M}.webp`;
    im.decode().catch(() => {}).then(() => {
      if (!im.naturalWidth) return;
      painted = document.createElement('canvas'); painted.width = paintCv.width; painted.height = paintCv.height;
      painted.getContext('2d').drawImage(im, 0, 0, painted.width, painted.height);
      paintArrows(lastKs);
    });
    frames.forEach(f => { const hi = new Image(); hi.src = f; });
  };

  // Trigger map asset load once the reader starts scrolling (not at y=0, where hero + fonts want the full pipe)
  const onScrollArm = () => { if (scrollY > 40) { removeEventListener('scroll', onScrollArm); loadMapAssets(); } };
  if (scrollY > 40) loadMapAssets();
  else addEventListener('scroll', onScrollArm, { passive: true });

  let frame = 0, last = 0, visible = false, raf = 0;
  const cam = { x: hx, y: hy, s: 2.6 };
  const EXT = (() => {
    const ps = ROUTES.flatMap(r => r.pts.map(([a, b]) => xy(a, b))), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  })();

  const place = () => {
    const vw = stage.clientWidth, vh = stage.clientHeight, cover = Math.max(vw / P.w, vh / P.h);
    const tall = vh > vw * .9, out = Math.min(1, Math.max(0, (2.6 - cam.s) / 1.6));
    const s = tall ? Math.exp(Math.log(cover * 2.6) + (Math.log(Math.max(vh / P.h, vw / (EXT.w * 1.08))) - Math.log(cover * 2.6)) * out) : cover * cam.s, cx = cam.x, cy = cam.y;
    const tx = vw / 2 - cx * s, ty = vh / 2 - cy * s;
    const lim = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
    const B = Math.min(1, cover * 2.6 * 1.05);
    if (B !== place.B) { place.B = B; stage.style.setProperty('--pw', P.w * B); stage.style.setProperty('--ph', P.h * B); }
    root.querySelector('.plate-inner').style.transform = `translate(${lim(tx, vw - P.w * s, 0)}px, ${lim(ty, vh - P.h * s, 0)}px) scale(${s / B})`;
  };

  const yearEl = root.querySelector('.mig-year');
  const update = p => {
    window.__migP = p;
    if (p > 0 && !assetsStarted) loadMapAssets();
    const n = ROUTES.length, span = .84 / n;
    const z = Math.min(1, p / .32), ez = 1 - Math.pow(1 - z, 3);
    cam.s = 2.6 - 1.6 * ez; cam.x = hx + (EXT.cx - hx) * ez; cam.y = hy + (EXT.cy - hy) * ez;
    place();
    const ks = [];
    ROUTES.forEach((r, i) => {
      const k = Math.min(1, Math.max(0, (p - .08 - i * span) / (span * 1.6)));
      ks[i] = k;
      const q = Math.min(1, Math.max(0, (k - .85) / .15));
      ends[i].style.opacity = q > 0 ? 1 : 0;
      ends[i].querySelector('.tag').style.clipPath = `inset(-20px ${(100 - q * 100).toFixed(1)}% -20px -20px)`;
      ends[i].querySelector('circle').style.transform = `scale(${q})`;
    });
    paintArrows(ks);
    const k0 = p < .08 ? -1 : Math.min(n - 1, Math.floor((p - .08) / span));
    yearEl.textContent = p < .08 ? 'c. 4000 BCE' : fmtYear(ROUTES[Math.max(0, k0)].y);
    root.querySelectorAll('.mig-p').forEach(el => { const on = +el.dataset.step === Math.min(3, Math.floor(p * 4.2)); el.classList.toggle('on', on); });
    let anyHorse = false;
    ROUTES.forEach((r, i) => {
      const k = ks[i], h = horses[i];
      if (k <= 0) { h.style.opacity = 0; return; }
      const [bx, by, ba] = curves[i](k), flip = Math.cos(ba) < 0, deg = (flip ? ba - Math.PI : ba) * 180 / Math.PI;
      h.setAttribute('x', bx - 100); h.setAttribute('y', by - 112);
      h.setAttribute('transform', `rotate(${deg.toFixed(1)} ${bx} ${by})` + (flip ? ` translate(${2 * bx},0) scale(-1,1)` : ''));
      const op = k < 1 ? 1 : Math.max(0, 1 - (p - (.08 + i * span + span * 1.6)) / .03);
      h.style.opacity = op;
      if (op > 0) anyHorse = true;
    });
    if (anyHorse && visible && !raf) raf = requestAnimationFrame(tick);
  };

  // the gallop runs ONLY while #s-mig is visible and at least one horse is on the route
  const tick = t => {
    raf = 0;
    if (!visible) return;
    let active = false;
    const step = t - last > 90;
    if (step) { frame = (frame + 1) % 11; last = t; }
    horses.forEach((h, i) => {
      if (+h.style.opacity > 0) {
        active = true;
        if (step) h.setAttribute('href', frames[(frame + i * 3) % 11]);
      }
    });
    if (active) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(e => {
    visible = e[0].isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick);
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(root);

  update(0);
  ScrollTrigger.create({ trigger: root, start: 'top top', end: '+=420%', pin: root.querySelector('.mig-pin'), scrub: true, onUpdate: s => update(s.progress) });
  addEventListener('resize', () => place());
}
