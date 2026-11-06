// The voices page (voices.html): drop caps, the figures (gestural score, stages, the listening ladder), the optional
// live section, the header's garden and horses. Figure data: data/voices-figs.json (tools/build_voices_figures.py);
// settings and links: data/voices.json.
import { initType, typeset, typesetAll } from './type.js';
import { ART_V } from './initials.js';
import { nav } from './nav.js';
import { brushStroke } from './brush.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ts = s => typeset(s || '', { words: false });
const audio = $('#vAudio');

// ------------------------------------------------------------------------------------------------ one player
// every play button on the page drives one <audio>; whatever was playing stops, and a playhead (if the button
// belongs to a spectrogram) follows the sound
let playing = null;
function play(src, btn, head) {
  if (playing?.btn === btn && !audio.paused) { audio.pause(); return; }
  stop();
  audio.src = src; audio.currentTime = 0; audio.play().catch(() => {});
  playing = { btn, head }; btn?.classList.add('on');
  const tick = () => {
    if (!playing || playing.btn !== btn) return;
    if (head && audio.duration) head.style.left = (audio.currentTime / audio.duration * 100) + '%';
    if (!audio.paused && !audio.ended) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stop() {
  if (!playing) return;
  playing.btn?.classList.remove('on');
  if (playing.head) playing.head.style.left = '0%';
  playing = null; audio.pause();
}
audio.addEventListener('ended', stop);

// ------------------------------------------------------------------------------------------------ drop caps
// the first letter of each section's opening paragraph, illuminated (tools/build_voices_initials.mjs)
function dropCaps() {
  document.querySelectorAll('.sec > p.lead').forEach(p => {
    const node = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!node) return;
    const t = node.textContent, i = t.search(/\S/), L = t[i];
    node.textContent = t.slice(i + 1);
    const cap = document.createElement('span'); cap.className = 'v-cap';
    cap.innerHTML = `<img src="art/initials/voices/${L.toUpperCase()}.webp?v=${ART_V}" alt="" onerror="this.parentNode.classList.add('plain')"><span class="v-cap-l">${esc(L)}</span>`;
    p.prepend(cap);
  });
}

// ------------------------------------------------------------------------------------------------ figure 2
const TIERS = [['vowel', 'vowel'], ['lip', 'lips'], ['tongue-tip', 'tongue tip'], ['tongue-body', 'tongue body'], ['velic', 'velum'], ['glottal-shape', 'glottis'], ['lung-pressure', 'lungs']];
// short names for the gestures (VocalTractLab's own are long: tt-alveolar-closure); the velum's gesture is its opening
const SHORT = { 'labial-closure': 'closure', 'rounded': 'round', 'alveolar-closure': 'closure', 'alveolar-fricative': 'fricative', 'alveolar-lateral': 'lateral',
  'velar-closure': 'velar', 'palatal-closure': 'palatal', 'uvular-fricative': 'uvular', 'voiceless-fricative': 'open', 'voiceless-plosive': 'stop',
  'voiceless-unaspirated': 'unaspirated', 'voiced-plosive': 'voiced', 'murmur': 'murmur', 'modal': 'modal', 'aspirate': 'aspirate' };
const NAME = (v, k) => k === 'velic' ? 'open' : SHORT[(v || '').replace(/^(ll|tt|tb)-/, '')] || (v || '').replace(/^(ll|tt|tb)-/, '').replace(/-/g, ' ');
function score(F) {
  const host = $('#score'), D = F.duration, clip = F.clips.find(c => c.id === 'vtl-m');
  const W = 1000, rowH = 24, top = 54, specH = 180, tiersH = TIERS.length * rowH, H = top + specH + 14 + tiersH + 8;
  const x = t => (t / D) * W;
  const words = F.words.map(w => `<text class="sw" x="${x((w.s + w.e) / 2)}" y="18" text-anchor="middle">${esc(w.w)}</text>`).join('');   // plain text: SVG takes no HTML
  const phones = F.words.flatMap(w => w.phones).map(p => `<g class="sp ${p.k === 'V' || p.k.endsWith('s') ? 'nuc' : ''}"><line x1="${x(p.s)}" x2="${x(p.s)}" y1="${top - 22}" y2="${top + specH}"/><text x="${x((p.s + p.e) / 2)}" y="${top - 8}" text-anchor="middle">${esc(p.p)}</text></g>`).join('');
  const f0 = F.f0, fmin = 70, fmax = 170, fy = hz => top + specH - ((hz - fmin) / (fmax - fmin)) * specH;
  let path = '', last = -1;
  f0.forEach(([t, hz]) => { path += (t - last > 0.03 ? 'M' : 'L') + x(t).toFixed(1) + ',' + fy(Math.min(fmax, Math.max(fmin, hz))).toFixed(1); last = t; });
  const rows = TIERS.map(([k, label], r) => {
    const y = top + specH + 14 + r * rowH;
    const gs = (F.ges[k] || []).filter(g => !g.n && g.v && k !== 'lung-pressure').map(g => {
      const w = Math.max(1, x(g.e) - x(g.s));
      return `<g class="g"><rect x="${x(g.s)}" y="${y + 3}" width="${w}" height="${rowH - 6}" rx="3"/>${w > NAME(g.v, k).length * 6.1 + 6 ? `<text x="${x(g.s) + 4}" y="${y + rowH / 2 + 4}">${esc(NAME(g.v, k))}</text>` : ''}<title>${esc(label)}: ${esc(NAME(g.v, k))} (${esc(g.v)}), ${Math.round((g.e - g.s) * 1000)} ms</title></g>`;
    }).join('');
    let lung = '';
    if (k === 'lung-pressure') {
      const lg = F.ges[k] || [], mx = Math.max(...lg.map(g => +g.v || 0), 1);
      lung = `<path class="lung" d="${lg.map((g, i) => `${i ? 'L' : 'M'}${x(g.s)},${y + rowH - 3 - ((+g.v || 0) / mx) * (rowH - 6)}L${x(g.e)},${y + rowH - 3 - ((+g.v || 0) / mx) * (rowH - 6)}`).join('')}"/>`;
    }
    return `<text class="tl" x="-10" y="${y + rowH / 2 + 4}" text-anchor="end">${label}</text>${gs}${lung}`;
  }).join('');
  host.innerHTML = `<svg viewBox="-96 0 ${W + 104} ${H}" class="score-svg" role="img" aria-label="Gestural score and spectrogram">
    <text class="tl" x="-10" y="18" text-anchor="end">word</text><text class="tl" x="-10" y="${top - 8}" text-anchor="end">phone</text>
    <text class="tl" x="-10" y="${top + specH / 2}" text-anchor="end">0–7 kHz</text>
    ${words}<image href="${clip.spec}" x="0" y="${top}" width="${W}" height="${specH}" preserveAspectRatio="none"/>
    ${phones}<path class="f0" d="${path}"/>${rows}
    <line class="head" id="scoreHead" x1="0" x2="0" y1="${top - 22}" y2="${H - 4}"/></svg>`;
  // playhead in SVG units
  const head = $('#scoreHead');
  const btn = document.querySelector('.fig-play[data-clip="vtl-m"]');
  btn.onclick = () => {
    play(clip.audio, btn, null);
    const tick = () => { if (playing?.btn !== btn) { head.setAttribute('x1', 0); head.setAttribute('x2', 0); return; }
      const px = (audio.currentTime / D) * W; head.setAttribute('x1', px); head.setAttribute('x2', px); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
}

// ------------------------------------------------------------------------------------------------ figures 3 and 4
function strip(c, label, extra = '') {
  return `<li class="st"><button class="st-play" aria-label="Play: ${esc(label)}"><span class="st-i"></span></button>
    <div class="st-body"><p class="st-l data">${esc(label)}${extra}</p><div class="st-spec"><img src="${c.spec}" alt=""><span class="st-head"></span></div></div></li>`;
}
function wireStrips(root, clips) {
  root.querySelectorAll('.st').forEach((li, i) => {
    const b = li.querySelector('.st-play'); b.onclick = () => play(clips[i].audio, b, li.querySelector('.st-head'));
  });
}
function stages(F) {
  const ids = ['vtl-m', 'conv-m', 'final-m'], names = ['VocalTractLab', 'converted', 'repaired'];
  const clips = ids.map(i => F.clips.find(c => c.id === i));
  $('#stages').innerHTML = `<ol class="strips">${clips.map((c, k) => strip(c, names[k])).join('')}</ol>`;
  wireStrips($('#stages'), clips);
}
let ladderVoice = 'm';
function ladder(F) {
  const rungs = [['espeak', 'eSpeak-NG, custom PIE voice'], ['stock', 'Kokoro-82M, stock Hindi voice'], [`vtl-${ladderVoice}`, 'VocalTractLab'],
    [`conv-${ladderVoice}`, 'converted'], [`final-${ladderVoice}`, 'repaired: the training audio'], [`ours-${ladderVoice}`, 'PIE Kokoro, the voices on this site']];
  const clips = rungs.map(([id]) => F.clips.find(c => c.id === id));
  const maxDur = Math.max(...clips.map(c => c.dur));
  $('#ladder').innerHTML = clips.map((c, k) => strip(c, rungs[k][1], ` <span>${c.dur.toFixed(1)} s</span>`).replace('class="st-spec"', `class="st-spec" style="width:${(c.dur / maxDur * 100).toFixed(1)}%"`)).join('');
  wireStrips($('#ladder'), clips);
}

// ------------------------------------------------------------------------------------------------ the live section
const EXAMPLES = ['h₂ówis h₁éḱwōs-kʷe', 'dyḗws ph₂tḗr', 'ḱléwos ń̥dʰgʷʰitom', 'wĺ̥kʷos h₂ówim widéh₁yeti.'];
async function live(cfg) {
  const L = cfg.live || {}; if (!L.enabled || !L.endpoint) return;
  const base = L.endpoint.replace(/\/$/, '');
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(base + '/health', { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok || !(await r.json()).ok) return;
  } catch { return; }
  const sec = $('#v-live'); sec.hidden = false;
  let voice = 'm', busy = false;
  const inp = $('#vlIn'), out = $('#vlOut'), go = $('#vlGo');
  $('#vlEx').innerHTML = 'Try: ' + EXAMPLES.map(e => `<button class="pie">${ts(e)}</button>`).join(' · ');
  $('#vlEx').querySelectorAll('button').forEach((b, i) => b.onclick = () => { inp.value = EXAMPLES[i]; speak(); });
  sec.querySelectorAll('.vl-voices button').forEach(b => b.onclick = () => { voice = b.dataset.v; sec.querySelectorAll('.vl-voices button').forEach(x => x.classList.toggle('on', x === b)); speak(); });
  const speak = async () => {
    const text = inp.value.trim(); if (!text || busy) return;
    busy = true; go.classList.add('busy'); go.textContent = 'Speaking…';
    try {
      const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }) });
      const js = await r.json(); if (js.error) throw new Error(js.error);
      out.innerHTML = `<p class="vl-line pie">${js.words.map((w, i) => `<span class="vw" data-i="${i}">${ts(w.word)}</span>`).join(' ')}</p><p class="vl-ipa data">[${esc(js.ipa)}]</p>`;
      stop();
      audio.src = 'data:audio/mpeg;base64,' + js.audio; audio.currentTime = 0; await audio.play().catch(() => {});
      const ws = out.querySelectorAll('.vw');
      const tick = () => { const t = audio.currentTime; ws.forEach((el, i) => el.classList.toggle('on', t >= js.words[i].start && t < js.words[i].end + .05)); if (!audio.paused) requestAnimationFrame(tick); else ws.forEach(el => el.classList.remove('on')); };
      requestAnimationFrame(tick);
    } catch (e) {
      out.innerHTML = `<p class="vl-err serif">The voice could not read that line: ${esc(e.message)}</p>`;
    } finally { busy = false; go.classList.remove('busy'); go.textContent = 'Speak'; }
  };
  go.onclick = speak;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); speak(); } });
}

// ------------------------------------------------------------------------------------------------ materials
function materials(cfg) {
  document.querySelectorAll('.m-item').forEach(it => {
    const url = cfg.links?.[it.dataset.link];
    const h = it.querySelector('h3');
    if (url) h.innerHTML = `<a href="${esc(url)}" rel="noopener">${h.textContent}</a>`;
    else it.insertAdjacentHTML('beforeend', '<p class="m-soon data">Publishing soon</p>');
  });
}

// ------------------------------------------------------------------------------------------------ header
function garden() {
  if (innerWidth < 700 || location.search.includes('nogarden')) return;
  const host = $('.v-garden'), probe = document.createElement('video');
  const alpha = probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const still = () => { const im = new Image(); im.className = 'gv'; im.alt = ''; im.src = 'art/garden-voices.webp'; im.onerror = () => im.remove(); host.append(im); };
  if (alpha && !reduce) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.className = 'gv'; v.src = 'art/growth-voices.webm'; host.append(v);
    v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true }); v.addEventListener('error', () => { v.remove(); still(); }, { once: true }); }
  else still();
}
// Muybridge's horse, painted (art/horse/paint-dark-NN.webp), galloping along the foot of the header
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
    [0, .55].forEach((x0, i) => { const im = frames[(Math.floor(t / 90) + i * 5) % 11], hh = h * .92, ww = hh * im.naturalWidth / im.naturalHeight;
      g.drawImage(im, ((x0 + t * .000032) % 1.2) * w - ww * .15, h - hh, ww, hh); });
    requestAnimationFrame(run);
  }
}

// ------------------------------------------------------------------------------------------------ boot
async function boot() {
  initType(); nav(); typesetAll(); dropCaps();
  const [F, cfg] = await Promise.all([fetch('data/voices-figs.json').then(r => r.json()), fetch('data/voices.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))]);
  await document.fonts?.ready;
  document.documentElement.classList.remove('arriving'); document.documentElement.classList.add('arrived');
  score(F); stages(F); ladder(F); materials(cfg);
  document.querySelectorAll('.lad-voices button').forEach(b => b.onclick = () => { stop(); ladderVoice = b.dataset.v; document.querySelectorAll('.lad-voices button').forEach(x => x.classList.toggle('on', x === b)); ladder(F); });
  { const fb = $('.foot-by'); if (fb) fb.style.setProperty('--streak', `url(${brushStroke('#b81d0e', 4242, { w: 900, h: 170 })})`); }
  // headings on painted grounds, each its own stroke
  document.querySelectorAll('.v-art .v-h2 span').forEach((s, i) => s.style.setProperty('--stroke', `url(${new URL(`art/brush/${String((i * 7 + 9) % 64).padStart(2, '0')}.webp`, location.href).href})`));
  garden(); herd(); live(cfg);
  if (!reduce && window.gsap) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { gsap.from(e.target, { y: 24, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'all' }); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.fig, .recipes > div').forEach(el => io.observe(el));
  }
}
boot();
