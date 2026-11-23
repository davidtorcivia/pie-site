import { api, failText } from './translate-api.js';
import { initType, typeset, typesetAll } from './type.js';
import { noise2, rng, fit, hatchRect } from './hatch.js';
import { mapPlate } from './map.js';
import { brushGround } from './brush.js';
import { nav } from './nav.js';
import { CAP, ART_V } from './initials.js';
import { carve, canCarve, NONE } from './rubric.js';

// The hero's P: the printed initialis plate ('plate', the owner's choice), or carved by illum ('carved').
const HERO_P = new URLSearchParams(location.search).has('carved') ? 'carved' : 'plate';
const heroCarved = () => HERO_P === 'carved' && canCarve();

const C = { yellow: '#ffd21a', deep: '#f2b705', ink: '#0e0d0b', paper: '#efe7d6', red: '#f2471c', blue: '#2633c9', moss: '#2e5b3a', chalk: '#f6f1e4' };
const PALETTE = [
  { name: 'ochre', ink: '#8e2a17', accent: '#2f5e8e', paper: '#f1e8d8' },
  { name: 'malachite', ink: '#1f5a43', accent: '#a8361f', paper: '#eee9dc' },
  { name: 'lapis', ink: '#1f3478', accent: '#b07a2a', paper: '#efebe2' },
  { name: 'charcoal', ink: '#2b2924', accent: '#b23a1e', paper: '#ece6d8' },
  { name: 'bronze', ink: '#5a3b18', accent: '#1f5a43', paper: '#f0e6d2' },
  { name: 'madder', ink: '#6e1f3a', accent: '#b07a2a', paper: '#f1e9df' },
];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);

initType();
gsap.registerPlugin(ScrollTrigger);

// smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in step
let lenis = null;
if (!reduce && window.Lenis && !matchMedia('(pointer: coarse)').matches && innerWidth >= 900) {
  lenis = new Lenis({ lerp: .09, wheelMultiplier: .9 });
  lenis.on('scroll', ScrollTrigger.update);
  window.lenis = lenis;
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ---------------------------------------------------------------------------------------------------- paper tooth
// One compact paper-weave tile, generated lazily only on desktop when the map nears (never blocking first paint)
let toothDone = false;
function tooth() {
  if (toothDone || innerWidth < 900) return;
  toothDone = true;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), im = g.createImageData(S, S), r = rng(11), n = noise2(12);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, weave = (x % 4 === 0 ? 7 : 0) + (y % 4 === 1 ? 5 : 0), mott = n(x / 32, y / 32) * 9;
    const v = 255 - r() * 20 - weave - Math.max(0, mott);
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const url = c.toDataURL('image/webp', .75);
  document.documentElement.style.setProperty('--tooth', `url(${url})`);
}

// ---------------------------------------------------------------------------------------------------- overture
function overture() {
  const hb = $('.open-h').getBoundingClientRect(), size = Math.round(hb.height);
  const sq = innerWidth >= 700 ? size : Math.round(innerWidth * .30), pad = CAP.pad, S = sq / (1 - 2 * pad);
  $('.hero-cap').style.setProperty('--hs', S + 'px');
  $('.hero-cap').style.setProperty('--hm', `${-S * pad}px ${-S * pad * .6}px ${-S * pad}px ${-S * pad}px`);
  $('.hero-cap').innerHTML = heroCarved()
    ? `<p class="hero-drop" aria-hidden="true" style="line-height:${sq / 4}px;font-size:${sq / 5}px;padding:${S * pad}px"><span class="ini drop hero-ini" data-lines="4">P</span></p>`
    : `<img src="art/initials/hero.webp?v=${ART_V}" alt="" width="800" height="800" fetchpriority="high" decoding="async" style="width:100%;height:100%">`;
  const place = () => {
    const tb = $('.hero-title').getBoundingClientRect(), sb = $('#s-open').getBoundingClientRect(), pp = $('.open-p'), padL = parseFloat(getComputedStyle(pp).paddingLeft);
    pp.style.top = (tb.bottom - sb.top + 22) + 'px';
    pp.style.left = (tb.left - sb.left - padL) + 'px';
  };
  place(); addEventListener('repaint', place);
}

// ---------------------------------------------------------------------------------------------------- wheel
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
  let rim = '';
  for (let i = 0; i < 360; i++) {
    const a = i / 360 * Math.PI * 2, l = i % 15 === 0 ? 30 : i % 5 === 0 ? 18 : 9, rr = R1 + 8;
    rim += `<line x1="${(Math.cos(a) * rr).toFixed(1)}" y1="${(Math.sin(a) * rr).toFixed(1)}" x2="${(Math.cos(a) * (rr + l)).toFixed(1)}" y2="${(Math.sin(a) * (rr + l)).toFixed(1)}" stroke-width="${i % 15 === 0 ? 2.2 : 1}"/>`;
  }

  svg.innerHTML = `<g class="spin"><g stroke="${C.ink}" stroke-linecap="round">${rim}</g>
    <g stroke="${C.ink}" stroke-width="1.2">${Array.from({ length: 240 }, (_, i) => { const a = i / 240 * Math.PI * 2, r0 = R0 + 6, r1 = R0 + (i % 2 ? 20 : 30); return `<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * r1).toFixed(1)}" y2="${(Math.sin(a) * r1).toFixed(1)}"/>`; }).join('')}</g>
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
    arms.innerHTML = ds.map(([br, d], k) => {
      const a0 = k / ds.length * Math.PI * 2, pts = [];
      for (let s = 0; s <= 40; s++) { const u = s / 40, rr = R0 + 12 + (R1 - R0 - 12) * u, a = a0 + u * 1.15; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      const mid = pts[20], down = mid[1] > 0, run = down ? [...pts].reverse() : [...pts];
      pts.length = 0; run.forEach(([x, y]) => pts.push(`${x.toFixed(1)},${y.toFixed(1)}`));
      const off = down ? ['62%', '20%'] : ['3%', '30%'];
      const end = down ? pts[0] : pts[pts.length - 1];
      return `<path id="arm${k}" d="M${pts.join('L')}" fill="none" stroke="${C.ink}" stroke-width="1.4"/><circle cx="${end.split(',')[0]}" cy="${end.split(',')[1]}" r="7" fill="#8e2a17"/>
        <text font-size="15" class="w-br"><textPath href="#arm${k}" startOffset="${off[0]}">${br}</textPath></text>
        <text font-size="34" class="w-form" dy="-10"><textPath href="#arm${k}" startOffset="${off[1]}">${svgPie(d.form)}</textPath></text>`;
    }).join('');
    $('#wheelCap').textContent = `*${w.form} (“${w.meaning}”) across ${ds.length} branches.`;
  };
  let cur = -1, tl = null;
  const armsIn = () => {
    const paths = [...arms.querySelectorAll('path')], forms = [...arms.querySelectorAll('.w-form, .w-br')], dots = [...arms.querySelectorAll('circle')];
    paths.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    const t = gsap.timeline();
    t.to(paths, { strokeDashoffset: 0, duration: .9, ease: 'power2.out', stagger: .05 }, 0)
     .fromTo(forms, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .7, ease: 'power2.out', stagger: .05 }, .35)
     .fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: .5, ease: 'back.out(3)', stagger: .07 }, .8);
    forms.forEach(f => { const tp = f.querySelector('textPath'); if (!tp) return; const to = parseFloat(tp.getAttribute('startOffset')); t.fromTo(tp, { attr: { startOffset: (to - 8) + '%' } }, { attr: { startOffset: to + '%' }, duration: 1, ease: 'power3.out' }, .35); });
    return t;
  };
  const set = i => {
    if (i === cur) return;
    const first = cur < 0; cur = i;
    if (tl) tl.kill();
    if (first || reduce) { show(i); if (!reduce) armsIn(); return; }
    const paths = [...arms.querySelectorAll('path')];
    paths.forEach(p => { if (!p.style.strokeDasharray) { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = 0; } });
    tl = gsap.timeline()
      .to(arms.querySelectorAll('.w-form, .w-br, circle'), { opacity: 0, duration: .22, ease: 'power1.in' }, 0)
      .to(paths, { strokeDashoffset: (k, p) => p.getTotalLength(), duration: .32, ease: 'power2.in', stagger: .02 }, 0)
      .to([center, mean], { opacity: 0, filter: 'blur(6px)', duration: .35 }, 0)
      .add(() => { show(i); armsIn(); })
      .to([center, mean], { opacity: 1, filter: 'blur(0px)', duration: .6, ease: 'power2.out' });
  };
  set(0);

  const navEl = document.createElement('div'); navEl.className = 'wheel-nav';
  navEl.innerHTML = `<button class="wn-prev" aria-label="Previous word">‹</button><div class="wn-list">${words.map((w, i) => `<button class="wn-w pie" data-i="${i}" title="${w.meaning}">*${typeset(w.form, { words: false })}</button>`).join('')}</div><button class="wn-next" aria-label="Next word">›</button>`;
  $('.wheel-copy').append(navEl);
  const go = i => {
    i = (i + words.length) % words.length; set(i);
    navEl.querySelectorAll('.wn-w').forEach((b, k) => b.classList.toggle('on', k === i));
    gsap.to(svg.querySelector('.spin'), { rotate: '+=36', svgOrigin: '0 0', duration: 1.4, ease: 'power3.inOut' });
  };
  navEl.querySelector('.wn-prev').onclick = () => go(cur - 1);
  navEl.querySelector('.wn-next').onclick = () => go(cur + 1);
  navEl.querySelectorAll('.wn-w').forEach(b => b.onclick = () => go(+b.dataset.i));
  navEl.querySelector('.wn-w').classList.add('on');

  const spin = svg.querySelector('.spin');
  svg.classList.add('grabbable'); svg.style.touchAction = matchMedia('(pointer: coarse)').matches ? 'pan-y' : 'none';
  let drag = null, vel = 0, coast = 0, acc = 0;
  const STEP = 40, pick = i => { i = (i + words.length) % words.length; set(i); navEl.querySelectorAll('.wn-w').forEach((b, k) => b.classList.toggle('on', k === i)); };
  const turned = d => { acc += d; while (acc >= STEP) { acc -= STEP; pick(cur + 1); } while (acc <= -STEP) { acc += STEP; pick(cur - 1); } };
  const angle = e => { const b = svg.getBoundingClientRect(); return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI; };
  svg.addEventListener('pointerdown', e => {
    cancelAnimationFrame(coast); gsap.killTweensOf(spin);
    drag = { a: angle(e), r: +gsap.getProperty(spin, 'rotation') || 0, t: performance.now() }; vel = 0; acc = 0;
    svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing');
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    let a = angle(e), d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
    const now = performance.now(); vel = d / Math.max(1, now - drag.t) * 16.7; drag.a = a; drag.t = now; drag.r += d;
    gsap.set(spin, { rotation: drag.r, svgOrigin: '0 0' }); turned(d);
  });
  const release = () => {
    if (!drag) return; drag = null; svg.classList.remove('grabbing');
    const step = () => { if (Math.abs(vel) < .04 || reduce) return; vel *= .955; gsap.set(spin, { rotation: '+=' + vel, svgOrigin: '0 0' }); turned(vel); coast = requestAnimationFrame(step); };
    step();
  };
  svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
}

// ---------------------------------------------------------------------------------------------------- machine
function machine(s) {
  const tiers = [
    ['I', s.lexicon_entries, '', 'Lexicon', '7,401 entries from Wiktionary, 829 verbal roots transcribed from LIV², and 135 nouns from NIL—each tied back to its source.'],
    ['II', s.engine_agreement, '%', 'Grammar engine', `Inflects nouns, adjectives and verbs by rule, reproducing ${s.engine_cells} cells from Wiktionary's published paradigms.`],
    ['III', s.records, '', 'Corpus', `${s.pie_words.toLocaleString('en')} words across ~50 genres—hymns, laws, riddles, laments, oaths, and everyday talk.`],
    ['IV', 86.2, '', 'Model', 'Strict score on my held-out benchmark, where frontier models drop into the 40s and 50s.'],
  ];
  $('#cascade').innerHTML = tiers.map(([rm, n, u, l, d]) => `<div class="tier"><div class="num" data-n="${n}" data-u="${u}">0</div><div class="lab"><b class="display"><em class="tier-i data">${rm}</em>${l}</b><span class="serif">${d}</span></div></div>`).join('');
  document.querySelectorAll('.tier .num').forEach(el => {
    const n = +el.dataset.n, dec = n % 1 ? 1 : 0, o = { v: 0 };
    el.textContent = n.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + el.dataset.u;
    if (reduce) return;
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () =>
      gsap.to(o, { v: n, duration: 1.25, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + el.dataset.u; } }) });
  });
}

// ---------------------------------------------------------------------------------------------------- results
function results(bench) {
  const ours = bench.find(b => b.id === 'ours-nemotron35-e3-bf16');
  const best = fam => bench.filter(b => b.id.startsWith(fam)).sort((a, b) => b.lenient - a.lenient)[0];
  const rows = [{ ...ours, name: 'Mine · PIE e3' }, ...['claude-opus', 'codex-gpt-6.1-sol', 'claude-sonnet', 'codex-gpt-6.1-terra', 'claude-haiku'].map(best).filter(Boolean)];
  const box = $('#bars');
  box.innerHTML = rows.map(r => `<div class="bar ${r.family === 'ours' ? 'ours' : ''}"><div class="who">${r.name}<div class="nums"><span class="sv">${r.strict.toFixed(1)}</span><span class="lv">/ ${r.lenient.toFixed(1)} lenient</span></div></div><div class="track"><canvas></canvas></div></div>`).join('')
    + `<div class="legend data small"><span><i style="background:${C.yellow}"></i>strict</span><span><i style="background:repeating-linear-gradient(45deg,rgba(255,210,26,.62) 0 1.5px,transparent 1.5px 7px)"></i>lenient</span><span>0 — 100</span></div>`;
  const draws = [...box.querySelectorAll('.bar')].map((el, i) => {
    const r = rows[i], cv = el.querySelector('canvas');
    const paint = k => {
      const { ctx, w, h } = fit(cv);
      ctx.clearRect(0, 0, w, h);
      // subtle track background & 25 / 50 / 75 / 100 reference hairlines so scores read effortlessly against 100
      ctx.fillStyle = 'rgba(246,241,228,.05)'; ctx.fillRect(0, 2, w, h - 4);
      ctx.strokeStyle = 'rgba(246,241,228,.12)'; ctx.lineWidth = 1;
      for (const p of [.25, .5, .75, 1]) { const x = Math.min(w - .5, Math.round(w * p) + .5); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      const L = w * r.lenient / 100 * k, S = w * r.strict / 100 * k;
      ctx.globalAlpha = .62; hatchRect(ctx, 0, 2, L, h - 4, { color: C.yellow, gap: 7.5, lw: 1.1 }); ctx.globalAlpha = 1;
      ctx.fillStyle = r.family === 'ours' ? C.yellow : C.deep; ctx.fillRect(0, 2, S, h - 4);
    };
    paint(0);
    return { el, paint };
  });
  draws.forEach(({ el, paint }, i) => {
    const o = { k: reduce ? 1 : 0 };
    if (reduce) { paint(1); } else {
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { k: 1, duration: 1.2, delay: i * .07, ease: 'power3.out', onUpdate: () => paint(o.k) }) });
    }
    addEventListener('repaint', () => paint(o.k));
  });
}

// ---------------------------------------------------------------------------------------------------- voice
function voice(h) {
  if (innerWidth < 700) { const bar = $('.voice-bar'), stage = $('.voice-stage'); if (bar && stage) stage.insertBefore(bar, $('#hymn')); }
  const audio = $('#audio'), hymn = $('#hymn'), disc = $('#disc'), ipa = $('#ipa'), en = $('#hymnEn');
  let voiceName = 'male';
  audio.src = h.audio[voiceName];
  const lines = [];
  h.words.forEach((w, i) => { (lines[w.line - 1] ||= []).push(i); });
  hymn.innerHTML = lines.map((ix, li) => `<div class="hline" data-l="${li}"><span class="hl">${ix.map(i => `<span class="w" data-i="${i}">${typeset(h.words[i].word, { words: false })}</span>`).join(' ')}</span><span class="hen">${h.english_lines[li] || ''}</span></div>`).join('');
  const hlines = [...hymn.querySelectorAll('.hline')];
  const spans = [...hymn.querySelectorAll('.w')];
  en.textContent = '';

  const ring = $('#ring');
  let actx, an, buf;
  const setupAudio = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio); an = actx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = .8;
    src.connect(an); an.connect(actx.destination); buf = new Uint8Array(an.frequencyBinCount);
  };
  const n = noise2(77);
  let cur = -1, visible = false, raf = 0, lastIdle = 0;

  const drawRing = t => {
    const { ctx, w, h: hh } = ring._fit || (ring._fit = fit(ring));
    ctx.clearRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2, R = w / 2 / 1.28;
    if (an && !audio.paused) an.getByteFrequencyData(buf);
    const N = 180;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 - Math.PI / 2, bin = (buf && !audio.paused) ? buf[Math.floor((i < N / 2 ? i : N - i) / (N / 2) * 70)] / 255 : 0;
      const idle = .18 + .12 * (n(Math.cos(a) * 1.5 + t * .0003, Math.sin(a) * 1.5) + 1);
      const L = R * (.06 + (audio.paused ? idle * .25 : bin * .32 + idle * .05));
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
      ctx.lineTo(cx + Math.cos(a + .02) * (R + 6 + L), cy + Math.sin(a + .02) * (R + 6 + L));
      ctx.strokeStyle = i % 9 === 0 ? C.red : C.ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
    }
  };

  const frame = t => {
    raf = 0;
    if (!visible && audio.paused) return;
    // throttle idle motion to ~24fps when paused; full 60fps during audio playback
    if (!audio.paused || t - lastIdle > 42) {
      drawRing(t);
      lastIdle = t;
    }
    const tt = audio.currentTime;
    let k = -1;
    const T = h.timing ? h.timing[voiceName === 'male' ? 'm' : 'f'] : h.words;
    for (let i = 0; i < T.length; i++) if (tt + .06 >= T[i].start) k = i;
    if (audio.paused && tt === 0) k = -1;
    if (k !== cur) {
      cur = k;
      spans.forEach((s, i) => { s.classList.toggle('now', i === k); s.classList.toggle('done', i < k); });
      if (k >= 0) { ipa.textContent = `[${h.words[k].ipa}]`; hlines.forEach((l, i) => l.classList.toggle('now', i === h.words[k].line - 1)); }
    }
    if (visible || !audio.paused) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(e => {
    visible = e[0].isIntersecting;
    if (visible) kick();
    else if (audio.paused && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe($('#s-voice'));

  addEventListener('repaint', () => { ring._fit = null; if (visible) drawRing(performance.now()); });
  disc.addEventListener('click', async () => {
    setupAudio(); if (actx.state === 'suspended') await actx.resume();
    if (audio.paused) { if (audio.ended) audio.currentTime = 0; await audio.play(); } else audio.pause();
  });
  audio.addEventListener('play', () => { hymn.classList.add('playing'); $('#discLabel').textContent = 'Pause'; kick(); });
  audio.addEventListener('pause', () => { $('#discLabel').textContent = audio.ended ? 'Again' : 'Play'; });
  audio.addEventListener('ended', () => { hymn.classList.remove('playing'); });
  document.querySelectorAll('.voices button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.v === voiceName) return;
    voiceName = b.dataset.v;
    document.querySelectorAll('.voices button').forEach(x => x.classList.toggle('on', x === b));
    const t = audio.currentTime, playing = !audio.paused;
    audio.src = h.audio[voiceName]; audio.currentTime = t; if (playing) audio.play();
  }));
  spans.forEach((s, i) => s.addEventListener('click', async () => { setupAudio(); await actx.resume(); const T = h.timing ? h.timing[voiceName === 'male' ? 'm' : 'f'] : h.words; audio.currentTime = T[i].start; audio.play(); }));
  spans.forEach(s => s.style.cursor = 'pointer');
}

// ---------------------------------------------------------------------------------------------------- specimens
function specimens(list) {
  const pal = PALETTE;
  const track = $('#specTrack');
  track.innerHTML = list.map((s, i) => {
    const k = pal[i % pal.length];
    return `<article class="leaf" style="--lf-ink:${k.ink};--lf-paper:${k.paper};--lf-accent:${k.accent}">
      <video class="leaf-garden" muted playsinline preload="none" data-src="gardens/leaf-${i}.mp4" data-still="gardens/leaf-${i}.webp"></video>
      <div class="rh"><span>${s.genre}</span><span class="fo">${s.id}</span></div>
      <div class="txt"><p class="p"><span class="ini"></span><span class="pt"></span></p><p class="e">${s.english}</p>
      ${s.audio ? `<p class="lis serif"><button class="play" aria-label="Listen">listen</button> · <button data-v="male" class="on">male</button> / <button data-v="female">female</button></p>` : ''}</div></article>`;
  }).join('');
  const leaves = [...track.querySelectorAll('.leaf')];
  const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const v = e.target.querySelector('.leaf-garden'); if (!v.src) { v.preload = 'auto'; v.src = v.dataset.src; } near.unobserve(e.target); } }), { rootMargin: '0px 60% 0px 60%' });
  leaves.forEach(l => near.observe(l));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const v = e.target.querySelector('.leaf-garden'); if (!v.src) v.src = v.dataset.src;
    v.play().catch(() => { v.poster = v.dataset.still; }); e.target.classList.add('grown'); io.unobserve(e.target); } }), { threshold: .35 });
  leaves.forEach(l => io.observe(l));

  const build = (el, i) => {
    const s = list[i];
    const src = s.pie.normalize('NFD'), at = src.search(/[a-z]/i);
    const [, base, marks] = src.slice(at).match(/^([a-z])([\u0300-\u036f]*)([ʰʷ₁₂₃]*)/i);
    const ini = el.querySelector('.ini');
    const sent = t => t.match(/[^.!?]+[.!?]+/g)?.map(x => x.trim()) || [t];
    const ps = sent(s.pie), es = sent(s.english), pair = ps.length === es.length && ps.length > 1;
    const body = pair ? ps.map((x, k) => `<span class="ps">${typeset(k ? x : x.normalize('NFD').slice(at + base.length + marks.length))}</span><span class="pe">${es[k]}</span>`).join(' ')
      : typeset(src.slice(at + base.length + marks.length));
    el.querySelector('.pt').innerHTML = body;
    el.querySelector('.e').style.display = pair ? 'none' : '';
    ini.innerHTML = `<img src="art/initials/leaf-${i}.webp?v=${ART_V}" alt="" decoding="async" loading="lazy" style="width:100%;height:100%">`;
  };
  leaves.forEach(build);

  const player = new Audio(); let playing = null, raf = 0;
  const stopLeaf = () => { if (playing) { playing.el.classList.remove('reading'); playing.el.querySelectorAll('.w.now').forEach(w => w.classList.remove('now')); playing.el.querySelector('.play').textContent = 'listen'; } playing = null; cancelAnimationFrame(raf); };
  const tickLeaf = () => { if (!playing) return; const T = playing.T, t = player.currentTime + .06; let k = -1; for (let i = 0; i < T.length; i++) if (t >= T[i].start) k = i;
    playing.ws.forEach((w, i) => w.classList.toggle('now', i === k)); raf = requestAnimationFrame(tickLeaf); };
  leaves.forEach((el, i) => {
    const s = list[i]; if (!s.audio) return;
    const lb = el.querySelector('.lis'); if (lb) brushGround(lb, 0, '#ffd21a');
    let voiceName = 'male';
    el.querySelectorAll('.lis [data-v]').forEach(b => b.onclick = () => { voiceName = b.dataset.v; el.querySelectorAll('.lis [data-v]').forEach(x => x.classList.toggle('on', x === b)); if (playing?.el === el) { stopLeaf(); el.querySelector('.play').click(); } });
    el.querySelector('.play').onclick = () => {
      if (playing?.el === el) { player.pause(); stopLeaf(); return; }
      stopLeaf(); player.src = s.audio[voiceName]; player.currentTime = 0; player.play();
      playing = { el, T: s.timing[voiceName === 'male' ? 'm' : 'f'], ws: [...el.querySelectorAll('.pt .w')] };
      el.classList.add('reading'); el.querySelector('.play').textContent = 'stop'; tickLeaf();
    };
  });
  player.addEventListener('ended', stopLeaf);

  const fitLeaf = el => { const t = el.querySelector('.txt'), p = el.querySelector('.p'); let fs;
    p.style.fontSize = ''; fs = parseFloat(getComputedStyle(p).fontSize);
    for (let n = 0; n < 24 && t.scrollHeight > t.clientHeight + 2; n++) { fs *= .95; p.style.fontSize = fs + 'px'; } };
  if (innerWidth >= 700) { leaves.forEach(fitLeaf); addEventListener('repaint', () => leaves.forEach(fitLeaf)); }
  const dist = () => track.scrollWidth - innerWidth;
  if (innerWidth >= 700) gsap.to(track, { x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: '#s-spec', start: 'top top', end: () => '+=' + dist(), pin: '.spec-pin', scrub: true, invalidateOnRefresh: true } });
}

// ---------------------------------------------------------------------------------------------------- translator
const EXAMPLES = {
  en2pie: ['The wolf sees the sheep, and the dog guards them.', 'The king gives the horses to the shepherd.', 'Dawn, daughter of the sky, shines.', 'We carry water to the house.'],
  pie2en: ['h₂ówis h₁éḱwōs-kʷe', 'dyḗws ph₂tḗr h₁ésti', 'wĺ̥kʷos h₂ówim widéh₁yeti', 'ḱléwos ń̥dʰgʷʰitom'],
};
function translator() {
  const inp = $('#trIn'), out = $('#trOut'), ex = $('#trEx');
  let dir = 'en2pie', tm, seq = 0;
  const examples = () => { ex.innerHTML = 'Try: ' + EXAMPLES[dir].map(e => `<button>${dir === 'pie2en' ? typeset(e, { words: false }) : e}</button>`).join(' · ');
    ex.querySelectorAll('button').forEach((b, i) => b.onclick = () => { inp.value = EXAMPLES[dir][i]; run(); }); };
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const q = x => `“${esc(x)}”`;
  const nothing = s => { const u = s.unknown || []; return `<div class="tr-notes serif">${u.length ? `No reconstructed PIE word for ${u.map(q).join(u.length > 2 ? ', ' : ' or ').replace(/, ([^,]*)$/, ', or $1')}, so there is nothing to translate.` : 'Nothing here the engine could translate.'}</div>`; };
  const run = async () => {
    const text = inp.value.trim(), my = ++seq;
    if (!text) { out.innerHTML = ''; return; }
    out.classList.add('busy');
    try {
      const js = await api(dir, text);
      if (my !== seq) return;
      if (dir === 'en2pie') {
        const subOf = s => { const m = {}; (s.notes || []).forEach(n => { const x = n.match(/^'([^']+)' ≈ '([^']+)'/); if (x) m[x[2]] = x[1]; }); return m; };
        out.innerHTML = js.map(s => { if (!s.pie) return nothing(s); const sub = subOf(s);
          return `<div class="tr-line pie">${typeset(s.pie)}</div>
          <div class="tr-words">${s.words.map(w => { const gl = w.gloss || '', base = gl.split('-')[0].replace(/_/g, ' '), was = sub[base];
            return `<div class="tw ${was ? 'sub' : ''} st-${esc(w.status)}"><span class="f">${typeset(w.form, { words: false })}</span><span class="gl">${esc(gl.replace(/_/g, ' ').replace(/~/g, ''))}</span>${was ? `<span class="was">for ${q(was)}</span>` : ''}</div>`; }).join('')}</div>
          ${s.ipa ? `<div class="tr-ipa">[${esc(s.ipa)}]</div>` : ''}
          ${Object.keys(sub).length || (s.unknown || []).length ? `<div class="tr-notes serif">${Object.entries(sub).map(([pie, en]) => `There is no reconstructed word for ${q(en)}; the nearest, ${q(pie)}, stands in.`).join(' ')}${(s.unknown || []).length ? ` Left out, with no word to stand in: ${s.unknown.map(q).join(', ')}.` : ''}</div>` : ''}`; }).join('');
      } else {
        out.innerHTML = `<div class="tr-line serif">${esc(js.rough_english || '—')}</div>
          <div class="tr-words">${(js.words || []).map(w => { const a = (w.analyses || [])[0]; return `<div class="tw"><span class="f">${typeset(w.word, { words: false })}</span><span class="gl">${a ? esc((a.gloss || '').replace(/_/g, ' ').replace(/~/g, '')) : 'not found'}</span></div>`; }).join('')}</div>
          ${js.ipa ? `<div class="tr-ipa">[${esc(js.ipa)}]</div>` : ''}`;
      }
      if (!reduce) gsap.from(out.querySelectorAll('.tr-line, .tw'), { y: 14, opacity: 0, duration: .45, stagger: .03, ease: 'power3.out' });
    } catch (e) {
      if (my === seq) out.innerHTML = `<div class="err">${failText(e)}</div>`;
    } finally { out.classList.remove('busy'); }
  };
  document.querySelectorAll('.tr-dir button').forEach(b => b.onclick = () => {
    if (b.dataset.d === dir) return; dir = b.dataset.d;
    document.querySelectorAll('.tr-dir button').forEach(x => x.classList.toggle('on', x === b));
    inp.value = EXAMPLES[dir][0]; examples(); run();
  });
  examples();
  inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 700); });
  $('#trGo').onclick = run;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
  ScrollTrigger.create({ trigger: '#s-apps', start: 'top 70%', once: true, onEnter: run });
}

// ---------------------------------------------------------------------------------------------------- gardens
function gardens() {
  if (location.search.includes('nogarden')) return;
  const probe = document.createElement('video');
  const phone = innerWidth < 700, sfx = phone ? '-m' : '';
  let busy = false; const waiting = [];
  const queue = job => { if (!phone) return job(() => {}); waiting.push(job); next(); };
  function next() { if (busy || !waiting.length) return; busy = true; waiting.shift()(() => { busy = false; next(); }); }
  const alphaVideo = !!probe.canPlayType && probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  for (const [name, sel] of [['open', '#s-open'], ['opentop', '#s-open'], ['wheel', '#s-wheel .wheel-pin'], ['machine', '#s-machine'], ['voice', '#s-voice'], ['apps', '#s-apps'], ['foot', 'footer']]) {
    const host = $(sel); if (!host) continue;
    const g = document.createElement('div'); g.className = 'garden ' + (host.classList.contains('ms-right') ? 'g-right' : host.classList.contains('ms-left') ? 'g-left' : 'g-field'); host.prepend(g);
    const play = done => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.className = 'gv';
      v.src = `art/growth-${name}${sfx}.webm`; g.append(v);
      const finish = () => { if (v._done) return; v._done = true; still(() => { v.removeAttribute('src'); v.load(); v.remove(); }); done(); };
      v.addEventListener('canplay', () => v.play().catch(finish), { once: true });
      v.addEventListener('ended', finish, { once: true });
      v.addEventListener('error', finish, { once: true });
      setTimeout(finish, 20000);
    };
    const start = () => (alphaVideo && !reduce) ? queue(play) : still();
    const still = then => { const im = new Image(); im.className = 'gv'; im.src = `art/garden-${name}${sfx}.webp`;
      im.decode().catch(() => {}).then(() => { g.append(im); then?.(); }); };
    if (name.startsWith('open')) { start(); continue; }
    const target = phone ? (() => { const s = document.createElement('div'); s.className = 'g-sentinel'; host.append(s); return s; })() : host;
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { start(); o.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' }).observe(target);
  }
}

const T0 = performance.now(), mark = n => { if (location.search.includes('perf')) console.log('PERF', n, Math.round(performance.now() - T0)); };

// ---------------------------------------------------------------------------------------------------- carving
function carving() {
  const only = sel => ({ theme: 'light', select: { initial: NONE, drop: NONE, heading: NONE, break: NONE, quote: NONE, figure: NONE, code: NONE, pull: NONE,
    aside: NONE, nav: NONE, paraph: NONE, filler: NONE, ...sel } });
  const cap = $('.hero-cap'), done = new Promise(r => { cap.addEventListener('animationend', r, { once: true }); setTimeout(r, 1800); });
  if ($('.hero-ini')) done.then(() => carve(cap, only({ initial: '.hero-ini', drop: '.hero-ini', text: NONE })));
  carve($('.wheel-copy'), only({ filler: '.wheel-copy > p.serif:not(.cap)' }));
  carve($('.voice-top'), only({ filler: '.voice-top > p' }));
}

async function boot() {
  if (new URLSearchParams(location.search).get('map') !== 'ink') document.documentElement.classList.add('map-wc');
  [['#s-wheel .wheel-pin', 'ms-left'], ['#s-machine', 'ms-right'], ['#s-voice', 'ms-left'], ['#s-apps', 'ms-right']].forEach(([s, c]) => $(s)?.classList.add(c));

  // Start fetching site.json immediately (reusing <link rel="preload">) WITHOUT blocking hero arrival
  const dataP = fetch('data/site.json').then(r => r.json());
  typesetAll();

  const ready = src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; });
  await Promise.all([
    document.fonts.ready,
    heroCarved() ? Promise.resolve() : Promise.race([ready(`art/initials/hero.webp?v=${ART_V}`), new Promise(r => setTimeout(r, 1200))]),
  ]);
  mark('fonts+hero');

  overture(); mark('overture');
  document.documentElement.classList.remove('arriving');
  document.documentElement.classList.add('arrived');

  nav();
  gardens();
  document.querySelectorAll('.mig-p, .mig-year').forEach((el, i) => brushGround(el, 70 + i, '#ffd21a'));
  mapPlate($('#s-mig'), { onNear: tooth }); mark('mapPlate');

  const data = await dataP;
  wheel(data.wheels); mark('wheel');
  machine(data.stats); mark('machine');
  results(data.bench); mark('results');
  voice(data.hymn); mark('voice');
  specimens(data.specimens); mark('specimens');
  translator(); mark('translator');
  carving();

  ScrollTrigger.refresh();
  dispatchEvent(new Event('pie:ready'));
  addEventListener('typechange', () => { typesetAll(); ScrollTrigger.refresh(); });
  let rw; addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(() => dispatchEvent(new Event('repaint')), 250); });
}
boot();
