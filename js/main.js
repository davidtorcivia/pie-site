import { initType, typeset, typesetAll } from './type.js';
import { noise2, rng, fit, field, draw, speckle, hatchRect } from './hatch.js';
import { loadMask, paintSilhouette } from './painter.js';
import { ramp, cord, wheel as sunWheel } from './illum.js';
import { mapPlate } from './map.js';
import { brushGround } from './brush.js';

const C = { yellow: '#ffd21a', deep: '#f2b705', ink: '#0e0d0b', paper: '#efe7d6', red: '#f2471c', blue: '#2633c9', moss: '#2e5b3a', chalk: '#f6f1e4' };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);

initType();
gsap.registerPlugin(ScrollTrigger);

// smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in step
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: .09, wheelMultiplier: .9 });
  lenis.on('scroll', ScrollTrigger.update);
  window.lenis = lenis;
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}


// ---------------------------------------------------------------------------------------------------- paper tooth
// one fine texture over the whole page (body::after): noise and a faint weave, multiplied
function tooth() {
  const c = document.createElement('canvas'); c.width = c.height = 384; const g = c.getContext('2d'), im = g.createImageData(384, 384), r = rng(11), n = noise2(12);
  for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) {
    const i = (y * 384 + x) * 4, weave = (x % 4 === 0 ? 7 : 0) + (y % 4 === 1 ? 5 : 0), mott = n(x / 60, y / 60) * 9;
    const v = 255 - r() * 20 - weave - Math.max(0, mott);
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  document.documentElement.style.setProperty('--tooth', `url(${c.toDataURL()})`);
}

// ---------------------------------------------------------------------------------------------------- overture
// The header is an illuminated page: a steppe garden over the whole field (art/hero.webp), a great initial P from
// our own kinds (a horse frieze, the herd, sun wheels, tulips), the title on brush-stroke grounds, and a herd of
// painted horses galloping across the foot.
async function overture() {
  document.querySelectorAll('.open-h .line, .open-p').forEach((el, i) => brushGround(el, 11 + i, '#ffd21a'));
  try {
    const lib = await import('../vendor/initialis/lib/initialis.js');
    await lib.use(new URL('kinds/steppe.js', import.meta.url).href);
    const P = { ...lib.random(4242), text: 'P', paper: '#ffd21a', inkA: '#1d1a16', inkB: '#a8361f', inkC: '#1d1a16',
      frame: 'rect', fMargin: 6, fRules: 2, fW1: 5, fGap: 96, fW2: 3, fBand: 'horses', fField: 'A', fPattern: 'herd', fPatColor: 'B', fPatScale: 10,
      fCorner: 'sunwheel', fCornerSize: 70, oFlower: 'tulip', oLeaf: 'willow', lFill: 'paper' };
    // the P spans the whole title: its top on the first line's top, its foot on the last line's foot
    const hb = $('.open-h').getBoundingClientRect(), size = Math.round(hb.height);
    $('.hero-cap').style.width = $('.hero-cap').style.height = size + 'px';
    // the paragraph sits under the title, never across it
    const place = () => { const tb = $('.hero-title').getBoundingClientRect(), sb = $('#s-open').getBoundingClientRect(); $('.open-p').style.top = (tb.bottom - sb.top + 26) + 'px'; };
    place(); addEventListener('repaint', place);
    $('.hero-cap').innerHTML = `<initialis-cap settings='${JSON.stringify(P)}' size="${size}" grow></initialis-cap>`;
  } catch (e) { console.info('initialis unavailable', e.message); }
  // the herd: painted Muybridge frames, a few horses out of step with each other
  const cv = $('.hero-herd'), pal = { ground: '#1d1a16', mids: ['#1d1a16', '#2a2620', '#3a352c', '#5a5246'], lights: ['#8e2a17', '#a8361f', '#c86a40'], paper: '#ffd21a', accent: '#a8361f' };
  const frames = [];
  for (let k = 1; k <= 11; k++) {
    const m = await loadMask(`art/horse/frame-${String(k).padStart(2, '0')}.png`), ar = m.naturalHeight / m.naturalWidth;
    const c = document.createElement('canvas'), w = 260, h = w * ar; c.width = w * 2.4; c.height = h * 2.4; const g = c.getContext('2d'); g.scale(2, 2);
    paintSilhouette(g, m, w * .1, h * .1, w, h, { ...pal, seed: 9, density: 1.3, mane: [.6, .84] }); frames.push(c);
  }
  const herd = [{ x: .08, ph: 0, s: 1 }, { x: .32, ph: 4, s: .86 }, { x: .55, ph: 7, s: .94 }, { x: .8, ph: 2, s: .8 }];
  let t0 = 0;
  const run = t => {
    const { ctx, w, h } = cv._fit || (cv._fit = fit(cv));
    ctx.clearRect(0, 0, w, h);
    const f = Math.floor(t / 90);
    herd.forEach(o => {
      const im = frames[(f + o.ph) % 11], hh = h * .92 * o.s, ww = hh * im.width / im.height;
      const x = ((o.x + t * .00002) % 1.2 - .1) * w;
      ctx.drawImage(im, x, h - hh, ww, hh);
    });
    if (!reduce) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
  addEventListener('repaint', () => { cv._fit = null; });
  gsap.to('.hero-field', { scale: 1.03, ease: 'none', scrollTrigger: { trigger: '#s-open', start: 'top top', end: 'bottom top', scrub: true } });
  if (!reduce) gsap.from('.open-h .line', { xPercent: -8, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: .1, delay: .2 });
}

// ---------------------------------------------------------------------------------------------------- migration
// Abstract geography (fractions of the stage): the steppe, and each branch's first written witness. Dates are
// conventional, rounded, for the earliest substantial texts.
const BRANCHES = [
  { b: 'Anatolian', w: 'Hittite tablets', y: -1650, x: .5, yy: .7 },
  { b: 'Indo-Iranian', w: 'the Rigveda', y: -1400, x: .8, yy: .82 },
  { b: 'Greek', w: 'Linear B', y: -1400, x: .4, yy: .73 },
  { b: 'Italic', w: 'Latin inscriptions', y: -600, x: .25, yy: .66 },
  { b: 'Celtic', w: 'Lepontic inscriptions', y: -550, x: .1, yy: .42 },
  { b: 'Germanic', w: 'the first runes', y: 200, x: .3, yy: .26 },
  { b: 'Armenian', w: 'the Armenian Bible', y: 410, x: .63, yy: .72 },
  { b: 'Tocharian', w: 'Tarim Basin manuscripts', y: 600, x: .93, yy: .38 },
  { b: 'Balto-Slavic', w: 'Old Church Slavonic', y: 870, x: .47, yy: .2 },
  { b: 'Albanian', w: 'a baptismal formula', y: 1462, x: .35, yy: .62 },
];
const HOME = { x: .6, y: .44 };
// push apart labels that overlap (map phase), top to bottom
function nudge(lis) {
  const boxes = lis.filter(l => +l.style.opacity > 0).map(l => ({ l, y: parseFloat(l.style.top), x: parseFloat(l.style.left) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
    const a = boxes[j], b = boxes[i];
    if (Math.abs(a.x - b.x) < 230 && Math.abs(a.y - b.y) < 44) { b.y = a.y + 44; b.l.style.top = b.y + 'px'; }
  }
}
const fmtYear = y => y < 0 ? `${Math.round(-y)} BCE` : `${Math.round(y)} CE`;

function migration() {
  const cv = $('#mig'), pin = $('.mig-pin');
  const labels = $('#migLabels');
  labels.innerHTML = BRANCHES.map(b => `<li><b>${b.b}</b><span>${b.w}, ${fmtYear(b.y)}</span></li>`).join('');
  const lis = [...labels.children];
  let ctx, W, H, ground, threads;
  const N = 46;
  const build = () => {
    ({ ctx, w: W, h: H } = fit(cv, 1.5));
    // the ground: dark granite, laid once into an offscreen canvas
    ground = document.createElement('canvas'); ground.width = cv.width; ground.height = cv.height;
    const g = ground.getContext('2d'); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g.fillStyle = C.ink; g.fillRect(0, 0, W, H);
    speckle(g, W, H, { colors: ['#1d1a15', '#262219', '#14120e', '#2c2a22'], density: .06, size: [.6, 2], seed: 4 });
    const r = rng(21);
    threads = BRANCHES.map((b, i) => Array.from({ length: N }, (_, k) => ({
      off: (r() - .5) * 2, wob: r() * 6.28, lw: .6 + r() * 1.5,
      c: r() < .7 ? C.yellow : r() < .5 ? C.deep : r() < .5 ? C.red : C.chalk, d: r() * .25 })));
  };
  // a branch's path at morph m (0 = map, 1 = family tree): start, control, end
  const path = (i, m) => {
    const b = BRANCHES[i];
    const geo = { s: [HOME.x * W, HOME.y * H], e: [b.x * W, b.yy * H] };
    geo.c = [(geo.s[0] + geo.e[0]) / 2 + (geo.e[1] - geo.s[1]) * .35, (geo.s[1] + geo.e[1]) / 2 - (geo.e[0] - geo.s[0]) * .2];
    const order = [4, 3, 9, 2, 0, 6, 1, 7, 8, 5].indexOf(i);           // tree leaves, west to east-ish
    const leafX = W * (.08 + .84 * order / (BRANCHES.length - 1)), tree = { s: [W * .5, H * .16], e: [leafX, H * .8] };
    tree.c = [leafX, H * .3];
    const L = (a, bb) => [a[0] + (bb[0] - a[0]) * m, a[1] + (bb[1] - a[1]) * m];
    return { s: L(geo.s, tree.s), c: L(geo.c, tree.c), e: L(geo.e, tree.e) };
  };
  const q = (p, t) => [(1 - t) * (1 - t) * p.s[0] + 2 * (1 - t) * t * p.c[0] + t * t * p.e[0], (1 - t) * (1 - t) * p.s[1] + 2 * (1 - t) * t * p.c[1] + t * t * p.e[1]];
  const n = noise2(17);
  let last = -1;
  const render = (p, time = 0) => {
    // p 0..1 over the pinned scroll: 0–.1 the steppe, .1–.8 branches leave in order of their first texts, .8–1 the map becomes a tree
    const m = gsap.utils.clamp(0, 1, (p - .8) / .17), grow = i => gsap.utils.clamp(0, 1, (p - .1 - i * .062) / .14);
    ctx.drawImage(ground, 0, 0, W, H);
    // the homeland: a hatched yellow blob that pulses
    const hx = HOME.x * W + (W * .5 - HOME.x * W) * m, hy = HOME.y * H + (H * .16 - HOME.y * H) * m, hr = Math.min(W, H) * (.07 + .02 * Math.sin(time * .002)) * (1 - m * .5);
    ctx.save(); ctx.beginPath();
    for (let a = 0; a <= 6.3; a += .2) { const rr = hr * (1 + .18 * n(Math.cos(a) * 1.3 + time * .0004, Math.sin(a) * 1.3)); ctx.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.clip();
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 1.3;
    for (let k = -hr * 2; k < hr * 2; k += 4.5) { ctx.beginPath(); ctx.moveTo(hx + k - hr, hy + hr); ctx.quadraticCurveTo(hx + k, hy, hx + k + hr, hy - hr); ctx.stroke(); }
    ctx.restore();
    BRANCHES.forEach((b, i) => {
      const gi = grow(i);
      if (gi <= 0) return;
      const P = path(i, m), spread = (14 + 26 * (1 - m)) * Math.min(1, gi * 2);
      for (const t of threads[i]) {
        const k = gsap.utils.clamp(0, 1, gi * 1.25 - t.d);
        if (k <= 0) continue;
        ctx.beginPath();
        for (let s = 0; s <= 28; s++) {
          const u = s / 28 * k, [x, y] = q(P, u), w = Math.sin(u * Math.PI) * spread;
          const dx = P.e[0] - P.s[0], dy = P.e[1] - P.s[1], L = Math.hypot(dx, dy) || 1;
          const off = t.off * w + n(u * 3 + t.wob, i + time * .0003) * 6 * (1 - m);
          const X = x - dy / L * off, Y = y + dx / L * off;
          s ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.strokeStyle = t.c; ctx.lineWidth = t.lw; ctx.globalAlpha = .85; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const li = lis[i], [ex, ey] = P.e;
      li.style.left = ex + 'px'; li.style.top = (ey + (m > .02 ? 30 + ([4, 3, 9, 2, 0, 6, 1, 7, 8, 5].indexOf(i) % 2) * 34 : 0)) + 'px';
      li.style.opacity = gsap.utils.clamp(0, 1, (gi - .7) / .3);
    });
    labels.classList.toggle('tree', m > .02);
    if (m <= .02) nudge(lis);
    if (p !== last) {
      const k = gsap.utils.clamp(0, BRANCHES.length - 1, Math.floor((p - .1) / .062));
      $('#migYear').textContent = p < .1 ? 'c. 4000 BCE' : m > .5 ? 'Common ancestor' : fmtYear(BRANCHES[k].y);
      document.querySelectorAll('.mig-p').forEach(el => {
        const s = +el.dataset.step, on = s === Math.min(3, Math.floor(p * 4.2));
        el.style.opacity = on ? 1 : 0; el.style.transform = `translateY(${on ? 0 : 12}px)`; el.style.transition = 'opacity .5s, transform .5s';
      });
      last = p;
    }
  };
  build();
  let prog = 0;
  ScrollTrigger.create({ trigger: '#s-mig', start: 'top top', end: '+=360%', pin: pin, scrub: true,
    onUpdate: s => { prog = s.progress; } });
  const loop = t => { render(prog, t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  addEventListener('repaint', build);
}

// ---------------------------------------------------------------------------------------------------- wheel
// SVG text can't hold the HTML spans, so the laryngeals and modifier letters are rebuilt as tspans
function svgPie(text) {
  let out = '', shift = 0;
  for (const ch of text.normalize('NFD')) {
    const lar = { '₁': '1', '₂': '2', '₃': '3' }[ch], mod = { 'ʰ': 'h', 'ʷ': 'w' }[ch];
    if (lar || mod) {
      const dy = lar ? .14 : -.38;
      out += `<tspan dy="${dy - shift}em" font-size="55%">${lar || mod}</tspan>`; shift = dy * .55;
      continue;
    }
    if (shift) { out += `<tspan dy="${-shift}em">${ch}</tspan>`; shift = 0; } else out += ch.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');
  }
  return out;
}

function wheel(words) {
  const svg = $('#wheel');
  const R0 = 150, R1 = 470;
  // the rim: an engraved scale, graduated like Russell's charts (every degree, longer every five and fifteen)
  let rim = '';
  for (let i = 0; i < 360; i++) {
    const a = i / 360 * Math.PI * 2, l = i % 15 === 0 ? 30 : i % 5 === 0 ? 18 : 9, rr = R1 + 8;
    rim += `<line x1="${(Math.cos(a) * rr).toFixed(1)}" y1="${(Math.sin(a) * rr).toFixed(1)}" x2="${(Math.cos(a) * (rr + l)).toFixed(1)}" y2="${(Math.sin(a) * (rr + l)).toFixed(1)}" stroke-width="${i % 15 === 0 ? 2.2 : 1}"/>`;
  }
  
  svg.innerHTML = `<g class="spin"><g stroke="${C.ink}" stroke-linecap="round">${rim}</g>
    
    <g class="arms"></g></g>
    <circle r="${R0 - 8}" fill="${C.ink}"/>
    <text class="w-center" text-anchor="middle" dy=".3em" fill="${C.yellow}" style="fill:${C.yellow}"></text>
    <text class="w-mean" text-anchor="middle" y="54" font-size="26" style="fill:${C.yellow}"></text>`;
  const arms = svg.querySelector('.arms'), center = svg.querySelector('.w-center'), mean = svg.querySelector('.w-mean');
  const show = (i) => {
    const w = words[i], ds = Object.entries(w.daughters);
    center.innerHTML = '*' + svgPie(w.form);
    center.setAttribute('font-size', w.form.length > 7 ? 46 : 58);
    mean.textContent = w.meaning.split(',')[0];
    // each daughter rides a spiral arm from the hub to the rim (Russell's vortex)
    arms.innerHTML = ds.map(([br, d], k) => {
      const a0 = k / ds.length * Math.PI * 2, pts = [];
      for (let s = 0; s <= 40; s++) { const u = s / 40, rr = R0 + 12 + (R1 - R0 - 12) * u, a = a0 + u * 1.15; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      // a word on the lower half would read upside down: run its path the other way
      const mid = pts[20], down = mid[1] > 0, run = down ? [...pts].reverse() : [...pts];
      pts.length = 0; run.forEach(([x, y]) => pts.push(`${x.toFixed(1)},${y.toFixed(1)}`));
      const off = down ? ['62%', '20%'] : ['3%', '30%'];
      return `<path id="arm${k}" d="M${pts.join('L')}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>
        <text font-size="15" class="w-br"><textPath href="#arm${k}" startOffset="${off[0]}">${br}</textPath></text>
        <text font-size="34" class="w-form" dy="-10"><textPath href="#arm${k}" startOffset="${off[1]}">${svgPie(d.form)}</textPath></text>`;
    }).join('');
    $('#wheelCap').textContent = `*${w.form}, “${w.meaning}”, and its descendants in ${ds.length} branches, from the project's lexicon.`;
  };
  let cur = -1;
  const set = i => { if (i === cur) return; cur = i; gsap.fromTo(arms, { opacity: 0 }, { opacity: 1, duration: .5 }); show(i); };
  set(0);
  const steps = Math.min(words.length, 6);
  ScrollTrigger.create({ trigger: '#s-wheel', start: 'top top', end: `+=${steps * 70}%`, pin: '.wheel-pin', scrub: true,
    onUpdate: s => { set(Math.min(steps - 1, Math.floor(s.progress * steps))); gsap.set(svg.querySelector('.spin'), { rotate: s.progress * 140, svgOrigin: '0 0' }); } });
}

// ---------------------------------------------------------------------------------------------------- machine
function machine(s) {
  const tiers = [
    [s.lexicon_entries, 'Lexicon', 'Entries from Wiktionary, checked against LIV², the Nomina im Indogermanischen Lexikon and the standard handbooks.'],
    [s.engine_agreement, 'Grammar engine', `The engine inflects nouns, adjectives and verbs. It matches ${s.engine_cells} cells in the published paradigms it was tested on.`, '%'],
    [s.records, 'Corpus', `Texts in about fifty genres, including hymns, laws, riddles, laments, oaths and dialogue: ${s.pie_words.toLocaleString('en')} words.`],
    [122, 'Model', 'Nemotron 3.5 Super, an open model with 122 billion parameters, fine-tuned on the corpus and then trained with reinforcement learning on a Mac.', 'B'],
    [7, 'Voice', 'Lines in the hymn to Dawn below.'],
  ];
  $('#cascade').innerHTML = tiers.map(([n, l, d, u]) => `<div class="tier"><div class="num" data-n="${n}" data-u="${u || ''}">0</div><div class="lab serif"><b>${l}</b>${d}</div></div>`).join('');
  document.querySelectorAll('.tier .num').forEach(el => {
    const n = +el.dataset.n, dec = n % 1 ? 1 : 0, o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () =>
      gsap.to(o, { v: n, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + el.dataset.u; } }) });
  });
}

// ---------------------------------------------------------------------------------------------------- results
function results(bench) {
  const ours = bench.find(b => b.id === 'ours-nemotron35-e3-bf16');
  const best = fam => bench.filter(b => b.id.startsWith(fam)).sort((a, b) => b.lenient - a.lenient)[0];
  const rows = [{ ...ours, name: 'Ours · PIE e3' }, ...['claude-opus', 'codex-gpt-6.1-sol', 'claude-sonnet', 'codex-gpt-6.1-terra', 'claude-haiku'].map(best).filter(Boolean)];
  const box = $('#bars');
  box.innerHTML = rows.map(r => `<div class="bar ${r.family === 'ours' ? 'ours' : ''}"><div class="who">${r.name}<div class="nums"><span class="sv">${r.strict.toFixed(1)}</span><span class="lv">/ ${r.lenient.toFixed(1)} lenient</span></div></div><div class="track"><canvas></canvas>
</div></div>`).join('')
    + `<div class="legend data small"><span><i style="background:${C.yellow}"></i>strict</span><span><i style="background:repeating-linear-gradient(45deg,${C.yellow} 0 2px,transparent 2px 6px)"></i>lenient</span><span>0 — 100</span></div>`;
  const draws = [...box.querySelectorAll('.bar')].map((el, i) => {
    const r = rows[i], cv = el.querySelector('canvas');
    const paint = k => {
      const { ctx, w, h } = fit(cv);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(246,241,228,.18)'; ctx.lineWidth = 1;
      
      const L = w * r.lenient / 100 * k, S = w * r.strict / 100 * k;
      hatchRect(ctx, 0, 2, L, h - 4, { color: C.yellow, gap: 6, lw: 1.3 });
      ctx.fillStyle = r.family === 'ours' ? C.yellow : C.deep; ctx.fillRect(0, 2, S, h - 4);
      
    };
    paint(0);
    return { el, paint };
  });
  draws.forEach(({ el, paint }, i) => {
    const o = { k: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { k: 1, duration: 1.4, delay: i * .08, ease: 'power3.out', onUpdate: () => paint(o.k) }) });
    addEventListener('repaint', () => paint(o.k));
  });
}

// ---------------------------------------------------------------------------------------------------- voice
function voice(h) {
  const audio = $('#audio'), hymn = $('#hymn'), disc = $('#disc'), ipa = $('#ipa'), en = $('#hymnEn');
  let voiceName = 'female';
  audio.src = h.audio[voiceName];
  // lines from the timeline
  const lines = [];
  h.words.forEach((w, i) => { (lines[w.line - 1] ||= []).push(i); });
  hymn.innerHTML = lines.map(ix => `<span class="hl">${ix.map(i => `<span class="w" data-i="${i}">${typeset(h.words[i].word, { words: false })}</span>`).join(' ')}</span>`).join('');
  const spans = [...hymn.querySelectorAll('.w')];
  en.textContent = h.english_lines[0];
  // the ring: hatched spokes around the disc, driven by the audio's spectrum
  const ring = $('#ring');
  let actx, an, buf;
  const setupAudio = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio); an = actx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = .8;
    src.connect(an); an.connect(actx.destination); buf = new Uint8Array(an.frequencyBinCount);
  };
  const n = noise2(77);
  let cur = -1;
  const frame = t => {
    const { ctx, w, h: hh } = ring._fit || (ring._fit = fit(ring));
    ctx.clearRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2, R = w / 2 / 1.28;
    if (an) an.getByteFrequencyData(buf);
    const N = 180;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 - Math.PI / 2, bin = buf ? buf[Math.floor((i < N / 2 ? i : N - i) / (N / 2) * 70)] / 255 : 0;
      const idle = .18 + .12 * (n(Math.cos(a) * 1.5 + t * .0003, Math.sin(a) * 1.5) + 1);
      const L = R * (.06 + (audio.paused ? idle * .25 : bin * .32 + idle * .05));
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
      ctx.lineTo(cx + Math.cos(a + .02) * (R + 6 + L), cy + Math.sin(a + .02) * (R + 6 + L));
      ctx.strokeStyle = i % 9 === 0 ? C.red : C.ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
    }
    // the current word
    const tt = audio.currentTime;
    let k = -1;
    for (let i = 0; i < h.words.length; i++) if (tt >= h.words[i].start - .02) k = i;
    if (audio.paused && tt === 0) k = -1;
    if (k !== cur) {
      cur = k;
      spans.forEach((s, i) => { s.classList.toggle('now', i === k); s.classList.toggle('done', i < k); });
      if (k >= 0) { ipa.textContent = `[${h.words[k].ipa}]`; en.textContent = h.english_lines[h.words[k].line - 1]; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('repaint', () => { ring._fit = null; });
  disc.addEventListener('click', async () => {
    setupAudio(); if (actx.state === 'suspended') await actx.resume();
    if (audio.paused) { if (audio.ended) audio.currentTime = 0; await audio.play(); } else audio.pause();
  });
  audio.addEventListener('play', () => { hymn.classList.add('playing'); $('#discLabel').textContent = 'Pause'; });
  audio.addEventListener('pause', () => { $('#discLabel').textContent = audio.ended ? 'Again' : 'Play'; });
  audio.addEventListener('ended', () => { hymn.classList.remove('playing'); });
  document.querySelectorAll('.voices button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.v === voiceName) return;
    voiceName = b.dataset.v;
    document.querySelectorAll('.voices button').forEach(x => x.classList.toggle('on', x === b));
    const t = audio.currentTime, playing = !audio.paused;
    audio.src = h.audio[voiceName]; audio.currentTime = t; if (playing) audio.play();
  }));
  // click a word to hear from there
  spans.forEach((s, i) => s.addEventListener('click', async () => { setupAudio(); await actx.resume(); audio.currentTime = h.words[i].start; audio.play(); }));
  spans.forEach(s => s.style.cursor = 'pointer');
}

// ---------------------------------------------------------------------------------------------------- specimens
// Each text is a leaf: bone paper, one ink, a grown margin (florilegium, rendered by tools/build_gardens.mjs in the
// leaf's ink) and an illuminated initial (initialis) printed in the same inks on the same paper.
async function specimens(list) {
  const pal = await fetch('tools/palette.json').then(r => r.json());
  const track = $('#specTrack');
  track.innerHTML = list.map((s, i) => {
    const k = pal[i % pal.length];
    return `<article class="leaf" style="--lf-ink:${k.ink};--lf-paper:${k.paper};--lf-accent:${k.accent}">
      <img class="garden" src="gardens/leaf-${i}.webp" alt="" loading="lazy" decoding="async">
      <div class="rh"><span>${s.genre}</span><span class="fo">${s.id}</span></div>
      <div class="txt"><p class="p"><span class="ini"></span><span class="pt"></span></p><p class="e">${s.english}</p></div></article>`;
  }).join('');
  const leaves = [...track.querySelectorAll('.leaf')];
  let lib = null;
  try { lib = await import('../vendor/initialis/lib/initialis.js'); await lib.use(new URL('kinds/steppe.js', import.meta.url).href); } catch (e) { console.info('initialis unavailable', e.message); }
  const build = (el, i) => {
    const s = list[i], k = pal[i % pal.length];
    const src = s.pie.normalize('NFD'), at = src.search(/[a-z]/i);
    const [cl, base, marks, extra] = src.slice(at).match(/^([a-z])([̀-ͯ]*)([ʰʷ₁₂₃]*)/i);
    const ini = el.querySelector('.ini');
    // a parallel text: each PIE sentence with its English beneath, where the sentences match one to one
    const sent = t => t.match(/[^.!?]+[.!?]+/g)?.map(x => x.trim()) || [t];
    const ps = sent(s.pie), es = sent(s.english), pair = ps.length === es.length && ps.length > 1;
    const body = pair ? ps.map((x, k) => `<span class="ps">${typeset(k ? x : x.normalize('NFD').slice(at + base.length + marks.length))}</span><span class="pe">${es[k]}</span>`).join(' ')
      : typeset(src.slice(at + base.length + marks.length));
    el.querySelector('.pt').innerHTML = body;
    el.querySelector('.e').style.display = pair ? 'none' : '';
    if (!lib) return;
    const fs = parseFloat(getComputedStyle(el.querySelector('.p')).fontSize), size = Math.round(fs * 1.28 * 3.4);
    // our own illumination: a cord or a frieze of horses round the frame, an incised ground, sun-wheel corners,
    // tulips for the growing ornament, all in the leaf's inks on its paper
    const P = { ...lib.random(7000 + i * 131), text: (base.toUpperCase() + marks).normalize('NFC'), paper: k.paper, inkA: k.ink, inkB: k.accent, inkC: k.ink,
      frame: 'rect', fRules: 2, fW1: 5, fGap: i % 2 ? 120 : 80, fW2: 2.5, fBand: i % 2 ? 'horses' : 'cord', fField: ['A', 'paper', 'A', 'B'][i % 4],
      fPattern: ['herringbone', 'steps', 'pitcomb', 'herd'][i % 4], fPatColor: ['paper', 'A', 'paper', 'paper'][i % 4], fPatScale: 12,
      fCorner: 'sunwheel', fCornerSize: 46, oFlower: 'tulip', oLeaf: 'willow', lFill: ['paper', 'A', 'paper', 'paper'][i % 4] };
    ini.innerHTML = `<initialis-cap settings='${JSON.stringify(P).replace(/'/g, '&#39;')}' size="${size}" grow></initialis-cap>`;
    ini.style.width = ini.style.height = size + 'px';
  };
  leaves.forEach(build);
  const dist = () => track.scrollWidth - innerWidth;
  gsap.to(track, { x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: '#s-spec', start: 'top top', end: () => '+=' + dist(), pin: '.spec-pin', scrub: true, invalidateOnRefresh: true } });
}

// ---------------------------------------------------------------------------------------------------- translator
function translator() {
  const inp = $('#trIn'), out = $('#trOut');
  let tm, seq = 0;
  const run = async () => {
    const text = inp.value.trim(), my = ++seq;
    if (!text) { out.innerHTML = ''; return; }
    try {
      const r = await fetch('/api/en2pie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const js = await r.json();
      if (my !== seq) return;
      if (js.error) throw new Error(js.error);
      out.innerHTML = js.map(s => s.words.map(w => `<div class="tw"><span class="f">${typeset(w.form, { words: false })}</span><span class="gl">${w.gloss}</span></div>`).join('')
        + `<div class="ipa">[${s.ipa}]</div>`).join('');
      gsap.from(out.querySelectorAll('.tw'), { y: 18, opacity: 0, duration: .5, stagger: .05, ease: 'power3.out' });
    } catch (e) {
      out.innerHTML = `<div class="err">The translator is offline here (${e.message}). On the LAN it runs on the Mac.</div>`;
    }
  };
  inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 450); });
  ScrollTrigger.create({ trigger: '#s-apps', start: 'top 70%', once: true, onEnter: run });
}

async function boot() {
  const data = await fetch('data/site.json').then(r => r.json());
  typesetAll();
  tooth();
  await document.fonts.ready;

  overture();
  document.querySelectorAll('.mig-p, .mig-year').forEach((el, i) => brushGround(el, 70 + i, '#ffd21a'));
  await mapPlate($('#s-mig'));      // first: its pin spacing must exist before later sections measure
  wheel(data.wheels);
  machine(data.stats);
  results(data.bench);
  voice(data.hymn);
  specimens(data.specimens);
  translator();

  ScrollTrigger.refresh();
  addEventListener('typechange', () => { typesetAll(); ScrollTrigger.refresh(); });
  let rw; addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(() => dispatchEvent(new Event('repaint')), 250); });
}
boot();
