// The model page (model.html): drop caps, the header's garden and horses, and the figures, drawn from
// data/model-figs.json (tools/build_model_figures.py). Bars where the scale starts at zero; dots where a scale is
// zoomed (a bar on a cut axis lies about size); one colour per contestant, the same in every figure.
import { initType, typeset, typesetAll } from './type.js';
import { ART_V } from './initials.js';
import { nav } from './nav.js';
import { brushStroke } from './brush.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (v, d = 1) => v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, lo, hi) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
const C = ['#b81d0e', '#2a2219', '#7a6a4f'];          // ours, then the two frontier runs

function dropCaps() {
  document.querySelectorAll('.sec > p.lead').forEach(p => {
    const node = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!node) return;
    const t = node.textContent, i = t.search(/\S/), L = t[i];
    node.textContent = t.slice(i + 1);
    const cap = document.createElement('span'); cap.className = 'v-cap';
    cap.innerHTML = `<img src="art/initials/model/${L.toUpperCase()}.webp?v=${ART_V}" alt="" onerror="this.parentNode.classList.add('plain')"><span class="v-cap-l">${esc(L)}</span>`;
    p.prepend(cap);
  });
}

// a horizontal bar: strict solid, lenient hatched beyond it (as on the home page's evaluation)
const bar = (strict, lenient, color) => `<span class="mb-track"><span class="mb-len" style="width:${lenient}%;--c:${color}"></span><span class="mb-str" style="width:${strict}%;background:${color}"></span></span>`;
const legend = items => `<div class="m-legend data">${items.map(([c, t, hatch]) => `<span><i style="${hatch ? `background:repeating-linear-gradient(45deg,${c} 0 1.5px,transparent 1.5px 6px)` : `background:${c}`}"></i>${t}</span>`).join('')}</div>`;

function bench(F) {
  const B = F.bench, seg = [{ id: 'all', name: 'Overall', weight: null }, ...B.segments];
  $('#chBench').innerHTML = legend([...B.rows.map((r, i) => [C[i], r.name]), ['#9a8f78', 'strict, solid'], ['#9a8f78', 'lenient, hatched', true]]) +
    seg.map(s => `<div class="mb-group"><div class="mb-head data">${s.name}${s.weight ? ` <em>weight ${s.weight}</em>` : ''}</div>
      ${B.rows.map((r, i) => { const v = s.id === 'all' ? r.score : r.seg[s.id];
        return `<div class="mb-row" title="${esc(r.name)}: ${fmt(v.strict)} strict, ${fmt(v.lenient)} lenient"><span class="mb-who serif">${esc(r.name.split(',')[0])}</span>${bar(v.strict, v.lenient, C[i])}<span class="mb-val data"><b>${fmt(v.strict)}</b> / ${fmt(v.lenient)}</span></div>`; }).join('')}</div>`).join('');
}

// dots on a zoomed scale, with the scale's ends labelled
const dotRows = (rows, lo, hi, d = 1, unit = '') => `<div class="dr">${rows.map(([label, v, color]) =>
  `<div class="dr-row" title="${esc(label)}: ${fmt(v, d)}${unit}"><span class="dr-l serif">${esc(label)}</span><span class="dr-track"><i style="left:${pct(v, lo, hi)}%;background:${color || C[1]}"></i></span><span class="dr-v data">${fmt(v, d)}${unit}</span></div>`).join('')}
  <div class="dr-axis data"><span></span><span class="dr-ends"><em>${fmt(lo, d)}${unit}</em><em>${fmt(hi, d)}${unit}</em></span><span></span></div></div>`;

function engine(F) {
  $('#chEngine').innerHTML = dotRows(F.engine_classes.map(([n, a, b]) => [`${n} (${a.toLocaleString()} of ${b.toLocaleString()})`, a / b * 100]), 90, 100, 1, '%');
}

// plain bars from zero, values written beside
const barRows = (rows, max, d = 0, color = C[1]) => `<div class="br">${rows.map(([label, v]) =>
  `<div class="br-row" title="${esc(label)}: ${fmt(v, d)}"><span class="br-l serif">${esc(label)}</span><span class="br-track"><i style="width:${Math.max(.6, v / max * 100)}%;background:${color}"></i></span><span class="br-v data">${fmt(v, d)}</span></div>`).join('')}</div>`;

function corpus(F) {
  const T = F.corpus;
  $('#chCorpus').innerHTML = `<div class="m-two"><div><h4 class="m-h data">Records</h4>${barRows(T.map(t => [t.name, t.records]), Math.max(...T.map(t => t.records)))}</div>
    <div><h4 class="m-h data">Words of PIE</h4>${barRows(T.map(t => [t.name, t.words]), Math.max(...T.map(t => t.words)))}</div></div>`;
}

const KIND = { translate_app: 'translation, app sessions', inflect: 'single inflected forms', en_dialogue: 'dialogue, English turns', gloss: 'interlinear gloss',
  translate_en_pie: 'translation, English → PIE', translate_pie_en: 'translation, PIE → English', paradigm: 'whole paradigms', cognates_to_pie: 'reconstruction from cognates',
  pie_dialogue: 'dialogue, PIE turns', continuation: 'continuing a text', app_session: 'app sessions, several turns', demo_chat: 'demo conversations' };
function exportMix(F) {
  const k = F.export.by_kind;
  $('#chExport').innerHTML = barRows(k.map(([id, n]) => [KIND[id] || id, n]), k[0][1]);
}

function sweep(F) {
  const E = F.epochs;
  $('#chSweep').innerHTML = `<div class="m-two"><div><h4 class="m-h data">Held-out loss after 100 steps</h4>${barRows(F.sweep.map(([n, v]) => [n.replace(/r(\d+)$/, 'rank $1'), v]), .65, 3)}</div>
    <div><h4 class="m-h data">Held-out loss by epoch</h4>${dotRows(E.map(e => [`epoch ${e.epoch}`, e.nll]), .2, .35, 3)}
      <h4 class="m-h data m-h2">Benchmark, strict ● and lenient ○</h4>
      <div class="dr">${E.map(e => `<div class="dr-row" title="epoch ${e.epoch}: ${fmt(e.strict)} strict, ${fmt(e.lenient)} lenient"><span class="dr-l serif">epoch ${e.epoch}</span><span class="dr-track"><i style="left:${pct(e.strict, 82, 90)}%;background:${C[0]}"></i><i class="o" style="left:${pct(e.lenient, 82, 90)}%;border-color:${C[0]}"></i></span><span class="dr-v data">${fmt(e.strict)}/${fmt(e.lenient)}</span></div>`).join('')}
      <div class="dr-axis data"><span></span><span class="dr-ends"><em>82</em><em>90</em></span><span></span></div></div></div></div>`;
}

// two small multiples over the same steps: reward, and KL with its stop line
function curve(F) {
  const P = F.rl8_curve, W = 600, H = 170, pad = { l: 44, r: 12, t: 14, b: 26 };
  const panel = (title, idx, lo, hi, color, line) => {
    const X = s => pad.l + (s - P[0][0]) / (P[P.length - 1][0] - P[0][0]) * (W - pad.l - pad.r), Y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const pts = P.map(p => `${X(p[0]).toFixed(1)},${Y(p[idx]).toFixed(1)}`).join(' ');
    const ticks = [lo, (lo + hi) / 2, hi];
    return `<div><h4 class="m-h data">${title}</h4><svg viewBox="0 0 ${W} ${H}" class="m-svg" role="img" aria-label="${esc(title)} over 150 steps">
      ${ticks.map(t => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(t)}" y2="${Y(t)}" class="m-grid"/><text x="${pad.l - 8}" y="${Y(t) + 4}" class="m-tick" text-anchor="end">${t.toFixed(2)}</text>`).join('')}
      ${line ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(line)}" y2="${Y(line)}" class="m-stop"/><text x="${W - pad.r}" y="${Y(line) - 6}" class="m-tick" text-anchor="end">stop at ${line}</text>` : ''}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      ${P.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[idx]).toFixed(1)}" r="9" fill="transparent"><title>step ${p[0]}: ${p[idx]}</title></circle>`).join('')}
      ${[P[0][0], 50, 100, 150].map(s => `<text x="${X(s)}" y="${H - 6}" class="m-tick" text-anchor="middle">${s === P[0][0] ? 'step ' + s : s}</text>`).join('')}</svg></div>`;
  };
  $('#chCurve').innerHTML = `<div class="m-two">${panel('Mean reward', 2, .6, 1, C[0])}${panel('KL from the starting weights', 1, 0, .3, C[1], .3)}</div>`;
}

function stages(F) {
  const S = F.stages, col = (title, key, lo, hi, d, unit = '') => `<div><h4 class="m-h data">${title}</h4>${dotRows(S.filter(s => s[key] != null).map((s, i) => [s.name, s[key], s.name.startsWith('Stage 8') ? C[0] : C[1]]), lo, hi, d, unit)}</div>`;
  $('#chStages').innerHTML = `<div class="m-grid2">${col('v1 chrF, all prompts', 'chrF', 70, 74, 2)}${col('English → PIE chrF', 'en_pie', 72, 80, 1)}${col('Paradigm cells, drills', 'cells', .87, .91, 3)}${col('Targeted words never right, of 83', 'never', 0, 80, 0)}</div>`;
}

function garden() {
  if (innerWidth < 700 || location.search.includes('nogarden')) return;
  const host = $('.v-garden'), probe = document.createElement('video');
  const alpha = probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const still = () => { const im = new Image(); im.className = 'gv'; im.alt = ''; im.src = 'art/garden-model.webp'; im.onerror = () => im.remove(); host.append(im); };
  if (alpha && !reduce) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.className = 'gv'; v.src = 'art/growth-model.webm'; host.append(v);
    v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true }); v.addEventListener('error', () => { v.remove(); still(); }, { once: true }); }
  else still();
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

async function boot() {
  initType(); nav(); typesetAll(); dropCaps();
  const F = await fetch('data/model-figs.json').then(r => r.json());
  await document.fonts?.ready;
  document.documentElement.classList.remove('arriving'); document.documentElement.classList.add('arrived');
  bench(F); engine(F); corpus(F); exportMix(F); sweep(F); curve(F); stages(F);
  { const fb = $('.foot-by'); if (fb) fb.style.setProperty('--streak', `url(${brushStroke('#b81d0e', 4242, { w: 900, h: 170 })})`); }
  document.querySelectorAll('.v-art .v-h2 span').forEach((s, i) => s.style.setProperty('--stroke', `url(${new URL(`art/brush/${String((i * 7 + 13) % 64).padStart(2, '0')}.webp`, location.href).href})`));
  garden(); herd();
  if (!reduce && window.gsap) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { gsap.from(e.target, { y: 24, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'all' }); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.fig, .nums > div').forEach(el => io.observe(el));
  }
}
boot();
