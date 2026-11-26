// The model page (model.html): drop caps, the header's garden and horses, and the figures, drawn from
// data/model-figs.json (tools/build_model_figures.py). Bars where the scale starts at zero; dots where a scale is
// zoomed (a bar on a cut axis lies about size); one colour per contestant, the same in every figure.
import { initType, typesetAll } from './type.js';
import { rubric } from './rubric.js';
import { nav } from './nav.js';
import { colophon } from './colophon.js';
import { isDark } from './theme.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (v, d = 1) => v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, lo, hi) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
// Wekwos-2-Mini, Wekwos-120B, then the two frontier runs; on the dark ground the near-black run turns to bone and the accents brighten
const LIGHT = ['#b81d0e', '#c96f16', '#2a2219', '#7a6a4f'], DARK = ['#e0452a', '#e09a3e', '#cfc3a8', '#8a7a5c'];
let C = LIGHT;

// a horizontal bar: strict solid, lenient hatched beyond it, over subtle 25/50/75 scale guides
const bar = (strict, lenient, color) => `<span class="mb-track"><span class="mb-len" style="width:${lenient}%;--c:${color}"></span><span class="mb-str" style="width:${strict}%;background:${color}"></span></span>`;
const legend = items => `<div class="m-legend data">${items.map(([c, t, hatch]) => `<span><i style="${hatch ? `background:repeating-linear-gradient(45deg,${c} 0 1.5px,transparent 1.5px 6px)` : `background:${c}`}"></i>${t}</span>`).join('')}</div>`;

function bench(F) {
  const B = F.bench, seg = [{ id: 'all', name: 'Overall', weight: null }, ...B.segments];
  $('#chBench').innerHTML = legend([...B.rows.map((r, i) => [C[i], r.name]), ['#9a8f78', 'strict, solid'], ['#9a8f78', 'lenient, hatched', true]]) +
    seg.map(s => `<div class="mb-group"><div class="mb-head data">${s.name}${s.weight ? ` <em>weight ${s.weight}</em>` : ''}</div>
      ${B.rows.map((r, i) => { const v = s.id === 'all' ? r.score : r.seg[s.id];
        return `<div class="mb-row${i === 0 ? ' mb-ours' : ''}" title="${esc(r.name)}: ${fmt(v.strict)} strict, ${fmt(v.lenient)} lenient"><span class="mb-who serif">${esc(r.name.split(',')[0])}</span>${bar(v.strict, v.lenient, C[i])}<span class="mb-val data"><b>${fmt(v.strict)}</b> / ${fmt(v.lenient)}</span></div>`; }).join('')}</div>`).join('');
}

// dots on a zoomed scale, with the scale's ends labelled
const dotRows = (rows, lo, hi, d = 1, unit = '') => `<div class="dr">${rows.map(([label, v, color]) =>
  `<div class="dr-row" title="${esc(label)}: ${fmt(v, d)}${unit}"><span class="dr-l serif">${esc(label)}</span><span class="dr-track"><i style="left:${pct(v, lo, hi)}%;background:${color || C[2]}"></i></span><span class="dr-v data">${fmt(v, d)}${unit}</span></div>`).join('')}
  <div class="dr-axis data"><span></span><span class="dr-ends"><em>${fmt(lo, d)}${unit}</em><em>${fmt(hi, d)}${unit}</em></span><span></span></div></div>`;

function engine(F) {
  $('#chEngine').innerHTML = dotRows(F.engine_classes.map(([n, a, b]) => [`${n} (${a.toLocaleString()} of ${b.toLocaleString()})`, a / b * 100, a === b ? C[0] : C[2]]), 90, 100, 1, '%');
}

// plain bars from zero, values written beside; optional per-row accent color
const barRows = (rows, max, d = 0, color = C[2]) => `<div class="br">${rows.map(([label, v, rowColor]) =>
  `<div class="br-row" title="${esc(label)}: ${fmt(v, d)}"><span class="br-l serif">${esc(label)}</span><span class="br-track"><i style="width:${Math.max(.8, v / max * 100)}%;background:${rowColor || color}"></i></span><span class="br-v data">${fmt(v, d)}</span></div>`).join('')}</div>`;

function corpus(F) {
  const T = F.corpus;
  $('#chCorpus').innerHTML = `<div class="m-two"><div><h4 class="m-h data">Records</h4>${barRows(T.map(t => [t.name, t.records, t.tier === 'tier3' ? C[0] : C[2]]), Math.max(...T.map(t => t.records)))}</div>
    <div><h4 class="m-h data">Words of PIE</h4>${barRows(T.map(t => [t.name, t.words, t.tier === 'tier3' ? C[0] : C[2]]), Math.max(...T.map(t => t.words)))}</div></div>`;
}

const KIND = { translate_app: 'translation, app sessions', inflect: 'single inflected forms', en_dialogue: 'dialogue, English turns', gloss: 'interlinear gloss',
  translate_en_pie: 'translation, English → PIE', translate_pie_en: 'translation, PIE → English', paradigm: 'whole paradigms', cognates_to_pie: 'reconstruction from cognates',
  pie_dialogue: 'dialogue, PIE turns', continuation: 'continuing a text', app_session: 'app sessions, several turns', demo_chat: 'demo conversations' };
function exportMix(F) {
  const k = F.export.by_kind;
  $('#chExport').innerHTML = barRows(k.map(([id, n], i) => [KIND[id] || id, n, i === 0 ? C[0] : C[2]]), k[0][1]);
}

function sweep(F) {
  const E = F.epochs;
  $('#chSweep').innerHTML = `<div class="m-two"><div><h4 class="m-h data">Held-out loss after 100 steps</h4>${barRows(F.sweep.map(([n, v], i) => [n.replace(/r(\d+)$/, 'rank $1'), v, i === 0 ? C[0] : C[2]]), .65, 3)}</div>
    <div><h4 class="m-h data">Held-out loss by epoch</h4>${dotRows(E.map(e => [`epoch ${e.epoch}`, e.nll]), .2, .35, 3)}
      <h4 class="m-h data m-h2">Benchmark, strict ● and lenient ○</h4>
      <div class="dr">${E.map(e => `<div class="dr-row" title="epoch ${e.epoch}: ${fmt(e.strict)} strict, ${fmt(e.lenient)} lenient"><span class="dr-l serif">epoch ${e.epoch}</span><span class="dr-track"><i style="left:${pct(e.strict, 82, 90)}%;background:${C[0]}"></i><i class="o" style="left:${pct(e.lenient, 82, 90)}%;border-color:${C[0]}"></i></span><span class="dr-v data">${fmt(e.strict)}/${fmt(e.lenient)}</span></div>`).join('')}
      <div class="dr-axis data"><span></span><span class="dr-ends"><em>82</em><em>90</em></span><span></span></div></div></div></div>`;
}

// two small multiples over the same steps in one SVG so illum frames both panels cleanly at full width
function curve(F) {
  const P = F.rl8_curve, narrow = innerWidth <= 760;
  const PW = 580, PH = 205, gapX = 64, gapY = 36, pad = { l: 44, r: 16, t: 42, b: 28 };
  const panel = (title, idx, lo, hi, color, line, ox, oy) => {
    const X = s => ox + pad.l + (s - P[0][0]) / (P[P.length - 1][0] - P[0][0]) * (PW - pad.l - pad.r);
    const Y = v => oy + pad.t + (1 - (v - lo) / (hi - lo)) * (PH - pad.t - pad.b);
    const pts = P.map(p => `${X(p[0]).toFixed(1)},${Y(p[idx]).toFixed(1)}`).join(' ');
    const baseY = Y(lo).toFixed(1);
    const area = `${X(P[0][0]).toFixed(1)},${baseY} ${pts} ${X(P[P.length - 1][0]).toFixed(1)},${baseY}`;
    const last = P[P.length - 1];
    const ticks = [lo, (lo + hi) / 2, hi];
    return `<g>
      <text x="${ox}" y="${oy + 18}" class="m-svg-h">${esc(title)}</text>
      ${ticks.map(t => `<line x1="${ox + pad.l}" x2="${ox + PW - pad.r}" y1="${Y(t)}" y2="${Y(t)}" class="m-grid"/><text x="${ox + pad.l - 8}" y="${Y(t) + 4}" class="m-tick" text-anchor="end">${t.toFixed(2)}</text>`).join('')}
      ${line ? `<line x1="${ox + pad.l}" x2="${ox + PW - pad.r}" y1="${Y(line)}" y2="${Y(line)}" class="m-stop"/><text x="${ox + PW - pad.r}" y="${Y(line) - 6}" class="m-tick" text-anchor="end">stop at ${line}</text>` : ''}
      <polygon points="${area}" fill="${color}" fill-opacity=".1"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[idx]).toFixed(1)}" r="4" fill="${color}"/>
      ${P.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[idx]).toFixed(1)}" r="9" fill="transparent"><title>step ${p[0]}: ${p[idx]}</title></circle>`).join('')}
      ${[P[0][0], 50, 100, 150].map(s => `<text x="${X(s)}" y="${oy + PH - 6}" class="m-tick" text-anchor="middle">${s === P[0][0] ? 'step ' + s : s}</text>`).join('')}
    </g>`;
  };
  const W = narrow ? PW : PW * 2 + gapX, H = narrow ? PH * 2 + gapY : PH;
  $('#chCurve').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="m-svg" role="img" aria-label="Mean reward and KL divergence from starting weights over 150 steps">
    ${panel('Mean reward', 2, .6, 1, C[0], null, 0, 0)}
    ${panel('KL from the starting weights', 1, 0, .3, C[2], .3, narrow ? 0 : PW + gapX, narrow ? PH + gapY : 0)}
  </svg>`;
}

function stages(F) {
  const S = F.stages, col = (title, key, lo, hi, d, unit = '') => `<div><h4 class="m-h data">${title}</h4>${dotRows(S.filter(s => s[key] != null).map(s => [s.name, s[key], s.name.startsWith('Final RL') ? C[0] : C[2]]), lo, hi, d, unit)}</div>`;
  $('#chStages').innerHTML = `<div class="m-grid2">${col('chrF, all prompts', 'chrF', 70, 74, 2)}${col('English → PIE chrF', 'en_pie', 72, 80, 1)}${col('Paradigm cells', 'cells', .87, .91, 3)}${col('Targeted words never right, of 83', 'never', 0, 80, 0)}</div>`;
}

function inkling(F) {
  const el = $('#chInkling');
  if (!el || !F.inkling) return;
  el.innerHTML = `<h4 class="m-h data">Weighted benchmark score, strict ● and lenient ○</h4><div class="dr">${F.inkling.map(r => {
    const col = r.top ? C[0] : r.ref ? C[1] : C[2];
    return `<div class="dr-row${r.top ? ' mb-ours' : ''}" title="${esc(r.name)}: ${fmt(r.strict)} strict, ${fmt(r.lenient)} lenient"><span class="dr-l serif">${esc(r.name)}</span><span class="dr-track"><i style="left:${pct(r.strict, 75, 92)}%;background:${col}"></i><i class="o" style="left:${pct(r.lenient, 75, 92)}%;border-color:${col}"></i></span><span class="dr-v data"><b>${fmt(r.strict)}</b>/${fmt(r.lenient)}</span></div>`;
  }).join('')}<div class="dr-axis data"><span></span><span class="dr-ends"><em>75</em><em>92</em></span><span></span></div></div>`;
}

function garden() {
  if (innerWidth < 700 || location.search.includes('nogarden')) return;
  const host = $('.v-garden'), probe = document.createElement('video');
  const alpha = probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const still = then => { const im = new Image(); im.className = 'gv'; im.alt = ''; im.src = 'art/garden-model.webp'; im.onerror = () => im.remove(); im.decode().catch(() => {}).then(() => { host.append(im); then?.(); }); };
  if (alpha && !reduce) {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.className = 'gv'; v.src = 'art/growth-model.webm'; host.append(v);
    const finish = () => { if (v._done) return; v._done = true; still(() => { v.removeAttribute('src'); v.load(); v.remove(); }); };
    v.addEventListener('canplay', () => v.play().catch(finish), { once: true });
    v.addEventListener('ended', finish, { once: true });
    v.addEventListener('error', finish, { once: true });
    setTimeout(finish, 20000);
  } else still();
}

async function herd() {
  const cv = $('.v-herd'); if (!cv || reduce) return;
  const frames = await Promise.all(Array.from({ length: 11 }, (_, k) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `art/horse/paint-dark-${String(k + 1).padStart(2, '0')}.webp`; })));
  if (frames.some(f => !f)) return;
  let on = false, fitted = null;
  new IntersectionObserver(e => { on = e[0].isIntersecting; if (on) requestAnimationFrame(run); }).observe(cv);
  addEventListener('resize', () => { fitted = null; });
  function run(t) {
    if (!on) return;
    if (!fitted) { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; fitted = { w: cv.width, h: cv.height }; }
    const g = cv.getContext('2d'), { w, h } = fitted; g.clearRect(0, 0, w, h);
    [.2, .75].forEach((x0, i) => { const im = frames[(Math.floor(t / 90) + i * 4) % 11], hh = h * .92, ww = hh * im.naturalWidth / im.naturalHeight;
      g.drawImage(im, ((x0 + t * .000032) % 1.2) * w - ww * .15, h - hh, ww, hh); });
    requestAnimationFrame(run);
  }
}

function materials(cfg) {
  document.querySelectorAll('.m-item').forEach(it => {
    const url = cfg.links?.[it.dataset.link], h = it.querySelector('h3');
    if (url) { const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.textContent = h.textContent; h.replaceChildren(a); }
    else it.insertAdjacentHTML('beforeend', '<p class="m-soon data">Publishing soon</p>');
  });
}

function wireToc() {
  const links = [...document.querySelectorAll('.m-toc a')];
  if (!links.length) return;
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) {
      links.forEach(a => a.classList.toggle('on', a === byId.get(e.target.id)));
    }
  }, { rootMargin: '-18% 0px -65% 0px' });
  document.querySelectorAll('main .sec[id]').forEach(s => io.observe(s));
}

async function boot() {
  initType(); nav(); colophon(); typesetAll();
  // Start fetches in parallel without delaying hero arrival
  const figsP = fetch('data/model-figs.json').then(r => r.json());
  const cfgP = fetch('data/model.json').then(r => r.json()).catch(() => ({}));

  await document.fonts?.ready;
  document.documentElement.classList.remove('arriving');
  document.documentElement.classList.add('arrived');

  document.querySelectorAll('.v-art .v-h2 span').forEach((s, i) => s.style.setProperty('--stroke', `url(${new URL(`art/brush/${String((i * 7 + 13) % 64).padStart(2, '0')}.webp`, location.href).href})`));
  garden(); herd(); wireToc();

  const F = await figsP;
  const figs = () => { C = isDark() ? DARK : LIGHT; bench(F); engine(F); corpus(F); exportMix(F); sweep(F); curve(F); stages(F); inkling(F); };
  figs(); addEventListener('themechange', figs);
  matchMedia('(max-width: 760px)').addEventListener('change', () => curve(F));
  rubric();
  cfgP.then(materials);

  if (!reduce) {
    const els = document.querySelectorAll('.fig, .nums > div');
    els.forEach(el => el.classList.add('m-reveal'));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  }
}
boot();
