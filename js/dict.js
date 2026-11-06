// The dictionary (dictionary.html). Static data from tools/build_dict.py: an index of every entry, loaded at once and
// searched in the page; entry details in 64 shards, fetched when an entry opens; daughter-language forms, loaded after
// the first paint, so a word like Latin pater finds its ancestor. The address holds the state (?q=…&e=…), so a search
// or an entry can be linked to, and Back steps through what was opened.
import { initType, typeset } from './type.js';
import { nav } from './nav.js';
import { colophon } from './colophon.js';
import { brushStroke } from './brush.js';
import { ART_V } from './initials.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => innerWidth < 900;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ts = s => typeset(s || '', { words: false });

// ------------------------------------------------------------------------------------------------ search keys
// fold: what a keyboard can type. h₁ → h1, ʰ → h, ʷ → w, accents and the palatal mark dropped (ḱ → k), punctuation gone
const fold = s => s.normalize('NFD').toLowerCase().replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
  .replace(/ʰ/g, 'h').replace(/ʷ/g, 'w').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
// loose: also without laryngeals and without the breath of bh dh gh (ekwos finds h₁éḱwos)
const loose = s => fold(s.normalize('NFC').replace(/h[₁₂₃123]|H/g, '')).replace(/([bdg])h/g, '$1');
const foldAny = s => s.normalize('NFD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
const STOP = new Set('to a an the of be'.split(' '));
const raw = s => s.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z]+/).filter(Boolean);
const words = s => { const r = raw(s), w = r.filter(x => !STOP.has(x)); return w.length ? w : r; };
// the gloss's senses, each as plain words: "stallion, horse" → ["stallion", "horse"]; "to come, to step" → ["come", "step"]
const senses = g => g.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[;,:]/).map(x => words(x).join(' ')).filter(Boolean);

const CLASS = { R: 'root', D: 'derivative', A: 'affix', G: 'grammar', C: 'project', W: 'word' };
const POSN = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', num: 'numeral', pron: 'pronoun', particle: 'particle',
  det: 'determiner', prefix: 'prefix', suffix: 'suffix', conj: 'conjunction', root: 'root', intj: 'interjection', infix: 'infix', phrase: 'phrase' };

let IX = [], BYID = new Map(), RX = null;
const shards = new Map();
function crc32(str) {
  let c, crc = 0xFFFFFFFF; const b = new TextEncoder().encode(str);
  for (const x of b) { c = (crc ^ x) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
async function detail(id) {
  const s = String(crc32(id) % 64).padStart(2, '0');
  if (!shards.has(s)) shards.set(s, fetch(`data/dict/e/${s}.json`).then(r => r.json()));
  return (await shards.get(s))[id];
}

// ------------------------------------------------------------------------------------------------ voices
// spoken headwords (tools/render_dict_audio.py): one file per shard and voice, each entry a slice of it, played
// through Web Audio so the slice starts and stops exactly
let AUDIO = new Set(), AV = '', actx = null, voice = 'm';   // AV: the render's stamp, so a re-render never pairs new offsets with cached audio
try { voice = localStorage.getItem('pie-voice') || 'm'; } catch {}
const offs = new Map(), bufs = new Map();
const shardOf = id => String(crc32(id) % 64).padStart(2, '0');
async function spoken(id) {
  const s = shardOf(id); if (!AUDIO.has(+s)) return null;
  if (!offs.has(s)) offs.set(s, fetch(`data/dict/audio/${s}.json${AV}`).then(r => r.json()).catch(() => ({})));
  return (await offs.get(s))[id] || null;
}
async function say(id, v, btn) {
  const o = await spoken(id); if (!o?.[v]) return;
  actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') await actx.resume();
  const key = shardOf(id) + v;
  if (!bufs.has(key)) bufs.set(key, fetch(`audio/dict/${key.slice(0, 2)}-${v}.mp3${AV}`).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)));
  const buf = await bufs.get(key), src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination);
  const [t, d] = o[v]; src.start(0, t, d);
  btn?.classList.add('playing'); src.onended = () => btn?.classList.remove('playing');
}

// ------------------------------------------------------------------------------------------------ letters
// the PIE alphabet in its usual order; an entry files under the first letter of its form
const LETTERS = ['a', 'b', 'bʰ', 'd', 'dʰ', 'e', 'g', 'gʰ', 'ǵ', 'ǵʰ', 'gʷ', 'gʷʰ', 'h₁', 'h₂', 'h₃', 'H', 'i', 'k', 'ḱ', 'kʷ', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'w', 'y'];
const BY_LEN = [...LETTERS].sort((a, b) => b.length - a.length);
function letterOf(form) {
  const s = form.normalize('NFC').replace(/^[-*(\s]+/, '');
  for (const L of BY_LEN) if (L.length > 1 && s.startsWith(L)) return L;
  const base = s.normalize('NFD')[0];
  if (s.startsWith('ḱ')) return 'ḱ'; if (s.startsWith('ǵ')) return 'ǵ';
  return LETTERS.includes(base) ? base : LETTERS.includes(base?.toLowerCase()) ? base.toLowerCase() : null;
}

// ------------------------------------------------------------------------------------------------ search
function search(q) {
  q = q.trim(); if (!q) return [];
  const qf = fold(q), ql = loose(q), qw = words(q), qa = foldAny(q), out = [];
  const english = /^[a-z\s'-]+$/i.test(q) && qw.length > 0;
  for (let k = 0; k < IX.length; k++) {
    const e = IX[k]; let s = 0, why = null;
    if (qf && e.f === qf) s = 100;
    else if (ql && e.l === ql) s = 92;
    else if (qf.length >= 2 && e.f.startsWith(qf)) s = 70 - Math.min(20, e.f.length - qf.length);
    else if (ql.length >= 3 && e.l.startsWith(ql)) s = 58 - Math.min(20, e.l.length - ql.length);
    if (english && e.w.length) {
      let g = 0;
      const qs = qw.join(' '), si = e.s.indexOf(qs);
      if (si >= 0) g = 90 - Math.min(si, 4) * 1.5;                // the query is one of the senses
      else if (qw.every(w => e.w.includes(w))) g = e.w[0] === qw[0] ? 80 : e.w.slice(0, 4).includes(qw[0]) ? 74 : 62;
      else if (qw[qw.length - 1].length >= 3 && qw.slice(0, -1).every(w => e.w.includes(w)) && e.w.some(w => w.startsWith(qw[qw.length - 1]))) g = 40;
      if (e.fl.includes('a')) g -= 14;
      if (g > s) s = g;
    }
    if (!s && qf.length >= 3 && e.f.includes(qf)) s = 26;
    if (s) out.push({ k, s: s + Math.log1p(e.u) * 3 + Math.min(e.n, 24) * .3 + (e.c === 'W' || e.c === 'G' ? 4 : e.c === 'D' ? -2 : 0), why });
  }
  // a descendant's form leads to its ancestor
  if (RX && qa.length >= 3) {
    const seen = new Map(out.map(o => [o.k, o]));
    for (const [key, shown, lang, k] of RX) {
      const exact = key === qa; if (!exact && !(qa.length >= 4 && key.startsWith(qa))) continue;
      const s = (exact ? 74 : 34) + Math.log1p(IX[k].u) * 2 + Math.min(IX[k].n, 24) * .35, o = seen.get(k);
      if (!o) { const n = { k, s, why: `${lang} ${shown}` }; out.push(n); seen.set(k, n); }
      else if (s > o.s) { o.s = s; o.why = `${lang} ${shown}`; }
    }
  }
  return out.sort((a, b) => b.s - a.s);
}

// ------------------------------------------------------------------------------------------------ results
const res = $('#results'), ent = $('#entry'), qi = $('#q');
let shown = [], limit = 60, current = null, heading = '';
function row(o) {
  const e = IX[o.k], cls = e.c === 'C' ? 'project' : e.c === 'G' ? (POSN[e.p] || e.p || 'grammar') : e.c === 'R' ? 'root' : e.c === 'A' ? 'affix' : (POSN[e.p] || (e.c === 'D' ? 'derivative' : ''));
  return `<a class="r ${e.id === current ? 'on' : ''} c-${e.c}" href="?e=${encodeURIComponent(e.id)}" data-id="${esc(e.id)}">
    <span class="r-f pie">*${ts(e.form)}</span>
    <span class="r-g serif">${esc(e.g) || '<span class="none">no gloss</span>'}${e.g && e.fl.includes('a') ? '<span class="approx" title="composed from the root and suffix">≈</span>' : ''}</span>
    <span class="r-c data">${esc(cls)}${o.why ? ` · ${esc(o.why)}` : ''}</span></a>`;
}
// ------------------------------------------------------------------------------------------------ translation
// a sentence typed into the search is also translated by the project's engine (/api, the translator on erebus): the
// translation sits above the dictionary's matches, word by word, each word linked to its entry
let trHTML = '', trSeq = 0, trTimer = 0;
const PIE_CHARS = /[₁₂₃ʰʷḱǵ̥áéíóúāēīōūḗṓŕ̥ĺ̥]|h[123]/i;
function looksPie(q) {
  if (PIE_CHARS.test(q)) return true;
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean);
  return ws.filter(w => IX.some(e => e.f === fold(w) && e.c !== 'A')).length >= Math.ceil(ws.length * .6) && !ws.some(w => /^(the|a|an|is|and|of|to|i|you|he|she|we|they)$/.test(w));
}
const post = (path, text) => fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then(r => r.ok ? r.json() : Promise.reject(r.status));
const lexOf = an => (an?.analyses || []).find(x => x.lex_id && BYID.has(x.lex_id))?.lex_id;
function wordCell(form, gloss, id) {
  const f = `<span class="tw-f pie">${ts(form)}</span>`;
  return `<span class="tw">${id ? `<a href="?e=${encodeURIComponent(id)}" data-id="${esc(id)}">${f}</a>` : f}<span class="tw-g data">${esc((gloss || '').replace(/_/g, ' '))}</span></span>`;
}
function translate(q) {
  clearTimeout(trTimer);
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || q.startsWith('letter:')) { if (trHTML) { trHTML = ''; paintResults(); } return; }
  trTimer = setTimeout(async () => {
    const my = ++trSeq, pie = looksPie(q);
    trHTML = `<section class="trc busy"><h2 class="r-head data">Translation</h2><p class="trc-wait serif">Translating…</p></section>`; paintResults();
    try {
      let html;
      if (pie) {
        const d = await post('pie2en', q); if (my !== trSeq) return;
        html = `<p class="trc-main serif">${esc(d.rough_english || '—')}</p><div class="trc-words">${d.words.map(w => wordCell(w.word, (w.analyses || [])[0]?.gloss || 'not found', lexOf(w))).join('')}</div>`;
      } else {
        const out = await post('en2pie', q); if (my !== trSeq) return;
        const parts = await Promise.all(out.map(sn => post('pie2en', sn.pie).catch(() => null)));
        if (my !== trSeq) return;
        html = out.map((sn, k) => { const an = parts[k]?.words || [];
          return `<p class="trc-main pie">${ts(sn.pie)}</p><div class="trc-words">${sn.words.map((w, i) => wordCell(w.form, w.gloss, lexOf(an[i]))).join('')}</div><p class="trc-ipa data">[${esc(sn.ipa || '')}]</p>`; }).join('');
      }
      trHTML = `<section class="trc"><h2 class="r-head data">Translation · ${pie ? 'PIE to English' : 'English to PIE'}</h2>${html}</section>`;
      // a sentence matches no single entry: the list below becomes the entries of the words in the translation
      if (!shown.length) {
        const ids = [...new Set([...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[data-id]')].map(a => a.dataset.id))];
        shown = ids.map(id => ({ k: BYID.get(id), s: 0 })).filter(o => o.k !== undefined); heading = 'The words in the translation';
      }
    } catch (e) {
      trHTML = `<section class="trc"><h2 class="r-head data">Translation</h2><p class="trc-wait serif">The translator is not reachable right now.</p></section>`;
    }
    if (my === trSeq) paintResults();
  }, 550);
}

function paintResults() {
  const list = shown.slice(0, limit);
  res.innerHTML = trHTML + (heading ? `<h2 class="r-head data">${heading}</h2>` : '') +
    (list.length ? list.map(row).join('') : trHTML ? '' : `<p class="r-none serif">Nothing found. Try an English word, a PIE form without accents, or a word in a daughter language.</p>`) +
    (shown.length > limit ? `<button class="r-more data">Show more (${(shown.length - limit).toLocaleString()})</button>` : '');
  $('.r-more', res)?.addEventListener('click', () => { limit += 120; paintResults(); });
  if (!reduce && window.gsap) gsap.from(res.querySelectorAll('.r'), { y: 10, opacity: 0, duration: .45, stagger: .012, ease: 'power3.out', clearProps: 'all' });
}
function setQuery(q, { push = false } = {}) {
  limit = 60;
  const L = q.startsWith('letter:') ? q.slice(7) : null;
  if (L) {
    shown = IX.map((e, k) => ({ k, e })).filter(x => x.e.L === L).map(({ k }) => ({ k, s: 0 }));
    heading = `${shown.length.toLocaleString()} entries under ${ts(L)}`;
  } else if (q.trim()) {
    shown = search(q); heading = shown.length ? `${shown.length.toLocaleString()} ${shown.length === 1 ? 'entry' : 'entries'}` : '';
  } else {
    // nothing typed: the words the corpus uses most
    shown = IX.map((e, k) => ({ k, s: e.u })).filter(x => x.s > 0 && IX[x.k].c !== 'A').sort((a, b) => b.s - a.s);
    heading = 'Most used in the corpus';
  }
  document.querySelectorAll('#letters button').forEach(b => b.classList.toggle('on', b.dataset.l === L));
  $('#count').textContent = q.trim() && !L ? shown.length.toLocaleString() : '';
  paintResults();
  translate(L ? '' : q);
  state({ q }, push);
}
function state(patch, push) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(patch)) v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
  if (u.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', u);
}

// ------------------------------------------------------------------------------------------------ the entry
const CASES = [['NOM', 'nominative'], ['VOC', 'vocative'], ['ACC', 'accusative'], ['GEN', 'genitive'], ['ABL', 'ablative'], ['DAT', 'dative'], ['LOC', 'locative'], ['INS', 'instrumental']];
const NUMS = [['SG', 'singular'], ['DU', 'dual'], ['PL', 'plural']];
const GEN = { m: 'masculine', f: 'feminine', n: 'neuter', mf: 'masculine and feminine', fn: 'feminine and neuter', '': '' };
const TENSES = [['PRS', 'present'], ['PST', 'imperfect'], ['AOR', 'aorist'], ['PRF', 'perfect'], ['SBJV', 'subjunctive'], ['OPT', 'optative'], ['IMP', 'imperative'], ['IMP.FUT', 'future imperative']];
const cell = fs => fs?.length ? `<span class="c1">${ts(fs[0])}</span>${fs.length > 1 ? `<span class="c2">${fs.slice(1, 4).map(ts).join(', ')}</span>` : ''}` : '';

function nounTable(cells) {
  const rows = CASES.filter(([c]) => NUMS.some(([n]) => cells[`${c}.${n}`] || cells[`${c}.${n}.ENCL`]));
  const cols = NUMS.filter(([n]) => CASES.some(([c]) => cells[`${c}.${n}`] || cells[`${c}.${n}.ENCL`]));
  if (!rows.length) return '';
  return `<table class="para pie"><thead><tr><th></th>${cols.map(([, t]) => `<th class="data"><span class="full">${t}</span><span class="abbr">${t.slice(0, 2)}.</span></th>`).join('')}</tr></thead><tbody>
    ${rows.map(([c, t]) => `<tr><th class="data"><span class="full">${t}</span><span class="abbr">${t.slice(0, 3)}.</span></th>${cols.map(([n]) => { const a = cells[`${c}.${n}`], b = cells[`${c}.${n}.ENCL`];
      return `<td>${cell(a)}${b ? `<span class="c2 encl">enclitic ${b.map(ts).join(', ')}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
function verbTables(c) {
  const groups = new Map(), ptcp = [];
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith('PTCP')) { ptcp.push([k, v]); continue; }
    const m = k.match(/^(MID\.)?(.*)\.([123])(SG|DU|PL)$/); if (!m) continue;
    const g = (m[1] ? 'MID.' : 'ACT.') + m[2]; if (!groups.has(g)) groups.set(g, {}); groups.get(g)[m[3] + m[4]] = v;
  }
  const tabs = [];
  for (const voice of ['ACT', 'MID']) for (const [t, name] of TENSES) { const g = groups.get(voice + '.' + t); if (g) tabs.push({ id: voice + '.' + t, name, voice, g }); }
  if (!tabs.length) return '';
  const table = g => `<table class="para pie"><thead><tr><th></th>${NUMS.map(([, t]) => `<th class="data"><span class="full">${t}</span><span class="abbr">${t.slice(0, 2)}.</span></th>`).join('')}</tr></thead><tbody>
    ${['1', '2', '3'].map(p => `<tr><th class="data"><span class="full">${['first', 'second', 'third'][p - 1]}</span><span class="abbr">${p}</span></th>${NUMS.map(([n]) => `<td>${cell(g[p + n])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const voices = [...new Set(tabs.map(t => t.voice))];
  return `<div class="tabs serif" role="tablist">${voices.length > 1 ? `<span class="tv">${voices.map(v => `<button data-voice="${v}" class="${v === 'ACT' ? 'on' : ''}">${v === 'ACT' ? 'active' : 'middle'}</button>`).join(' · ')}</span>` : ''}
    <span class="tt">${tabs.filter(t => t.voice === 'ACT' || voices.length === 1).map((t, i) => `<button data-tab="${t.id.split('.').slice(1).join('.')}" class="${i ? '' : 'on'}">${t.name}</button>`).join(' · ')}</span></div>
    ${tabs.map((t, i) => `<div class="pane" data-pane="${t.id}" ${t.id === (voices[0] + '.' + tabs.find(x => x.voice === voices[0]).id.split('.').slice(1).join('.')) ? '' : 'hidden'}>${table(t.g)}</div>`).join('')}
    ${ptcp.length ? `<p class="ptcp serif">Participles: ${ptcp.map(([k, v]) => `<span class="pie">${ts(v[0])}</span> (${k.endsWith('MID') ? 'middle' : 'active'})`).join(', ')}</p>` : ''}`;
}
function paradigm(p) {
  if (!p) return '';
  if (p.type === 'verb') return verbTables(p.c);
  const gs = Object.entries(p.g).filter(([, c]) => Object.keys(c).length);
  if (!gs.length) return '';
  if (gs.length === 1) return nounTable(gs[0][1]);
  return `<div class="tabs serif"><span class="tt">${gs.map(([g], i) => `<button data-g="${g}" class="${i ? '' : 'on'}">${GEN[g] ?? g}</button>`).join(' · ')}</span></div>
    ${gs.map(([g, c], i) => `<div class="pane" data-gpane="${g}" ${i ? 'hidden' : ''}>${nounTable(c)}</div>`).join('')}`;
}
function wireTabs(root) {
  root.querySelectorAll('.tabs').forEach(tb => {
    const box = tb.parentElement;
    let voice = 'ACT', tab = tb.querySelector('[data-tab]')?.dataset.tab;
    const show = () => {
      box.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== voice + '.' + tab; });
      if (!box.querySelector(`[data-pane="${voice}.${tab}"]`)) { const f = box.querySelector(`[data-pane^="${voice}."]`); if (f) { f.hidden = false; tab = f.dataset.pane.split('.').slice(1).join('.'); } }
      tb.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.disabled = !box.querySelector(`[data-pane="${voice}.${b.dataset.tab}"]`); });
    };
    tb.querySelectorAll('[data-voice]').forEach(b => b.onclick = () => { voice = b.dataset.voice; tb.querySelectorAll('[data-voice]').forEach(x => x.classList.toggle('on', x === b)); show(); });
    tb.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; show(); });
    tb.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { tb.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); box.querySelectorAll('[data-gpane]').forEach(p => p.hidden = p.dataset.gpane !== b.dataset.g); });
    if (tb.querySelector('[data-tab]')) show();
  });
}
const link = x => `<a class="xl" href="?e=${encodeURIComponent(x.id)}" data-id="${esc(x.id)}"><span class="pie">*${ts(x.form)}</span>${x.gloss ? ` <span class="serif">“${esc(x.gloss.split(/[;,]/)[0])}”</span>` : ''}</a>`;
function example(x) {
  const w = (x.w || '').normalize('NFC'); let done = false;
  const line = x.pie.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    const core = tok.normalize('NFC').replace(/[.,;:!?"“”„«»()]/g, '');
    if (!done && w && (core === w || core.split('-').includes(w) || core.includes(w))) { done = true; return `<mark style="--stroke:url(${new URL(`art/brush/${String((crc32(x.id) % 60) + 2).padStart(2, '0')}.webp`, location.href).href})">${ts(tok)}</mark>`; }
    return ts(tok);
  }).join('');
  return `<figure class="ex"><p class="ex-pie pie">${line}</p><figcaption class="ex-en serif">${esc(x.en)}</figcaption></figure>`;
}
function sourceLine(s, d) {
  if (!s) return '';
  if (s.name === 'Wiktionary') return `From <a href="${esc(s.url)}" rel="noopener">Wiktionary</a>.`;
  if (s.name === 'LIV²') return `From LIV²${s.page ? `, p. ${esc(s.page)}` : ''}${s.iew ? ` ${esc(s.iew)}` : ''}.`;
  if (s.name === 'NIL') return `From NIL${s.page ? `, p. ${esc(s.page)}` : ''}.`;
  if (s.name === 'coinage') return `Coined for the project, since no PIE word is reconstructed for this meaning. ${esc(s.note || '')}`;
  if (s.name === 'project') return `Reconstructed by the project from its descendants${s.cite ? ` (${esc(s.cite)})` : ''}.`;
  if (s.name === 'supplement') return `Added by the project${s.cite ? ` from ${esc(s.cite)}` : ''}.`;
  if (s.name === 'closed') return `From the grammar engine's tables of pronouns, particles and numerals, checked against Fortson (2010) and Ringe (2017).`;
  return '';
}
function initialFor(form) {
  const src = form.normalize('NFD'), at = src.search(/[a-z]/i); if (at < 0) return null;
  const m = src.slice(at).match(/^([a-z])([̀-ͯ]*)/i), letter = (m[1].toUpperCase() + m[2]).normalize('NFC');
  return { letter, pre: src.slice(0, at), rest: src.slice(at + m[0].length).normalize('NFC') };
}
const initialSrc = L => `art/initials/dict/${[...L.normalize('NFD')].map(c => c.codePointAt(0).toString(16)).join('-')}.webp?v=${ART_V}`;

async function openEntry(id, { push = true, scroll = true } = {}) {
  const d = await detail(id); if (!d) return;
  current = id;
  res.querySelectorAll('.r').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  const ini = initialFor(d.form), star = true;     // every PIE form is a reconstruction
  const meta = [d.class === 'C' ? (d.source?.name === 'coinage' ? 'coined by the project' : 'reconstructed by the project') : null,
    d.pos, d.gender ? GEN[d.gender] : null, d.accent_class, d.aspect ? { pf: 'perfective', ipf: 'imperfective', stat: 'stative' }[d.aspect] || d.aspect : null].filter(Boolean);
  const sec = (title, body, cls = '') => body ? `<section class="e-sec ${cls}"><h3 class="e-h data">${title}</h3>${body}</section>` : '';
  const formation = [
    d.segmented ? `<p class="pie seg">${ts(d.segmented)}</p>` : '',
    d.root ? `<p class="serif">From the root ${link(d.root)}.</p>` : '',
    d.parents?.length ? `<p class="serif">Built on ${d.parents.map(x => link(x)).join(', ')}.</p>` : '',
    d.gloss_src === 'derived' ? `<p class="serif note">This gloss is composed from the root's meaning and the suffix${d.formation ? ` (${ts(d.formation)})` : ''}, and is approximate.</p>` : '',
    d.gloss_src === 'reflex-confirmed' ? `<p class="serif note">Wiktionary gives no gloss. This one is the meaning its descendants agree on in at least two branches.</p>` : '',
    d.variants?.length ? `<p class="serif">Also reconstructed as ${d.variants.map(v => `<span class="pie">*${ts(v)}</span>`).join(', ')}.</p>` : '',
  ].join('');
  const refl = d.reflexes?.length ? `<div class="refl">${d.reflexes.map(b => `<div class="rb"><h4 class="rb-h data">${b.b === 'Borrowed' ? 'Borrowed into' : esc(b.b)}</h4>
      ${b.l.map(l => `<p class="rl"><span class="rl-lang serif">${esc(l.lang)}</span> ${l.forms.map(f => `<span class="rl-f book">${esc(f.r || f.f)}</span>${f.r ? ` <span class="rl-s">${esc(f.f)}</span>` : ''}${f.g ? ` <span class="rl-g serif">“${esc(f.g)}”</span>` : ''}`).join(', ')}</p>`).join('')}
      ${b.n > b.l.length ? `<p class="rl-more data">and ${b.n - b.l.length} more</p>` : ''}</div>`).join('')}</div>` : '';
  const family = d.family?.length ? `<div class="fam">${d.family.map(x => link(x)).join('')}</div>${d.family_n > d.family.length ? `<p class="data rl-more">and ${d.family_n - d.family.length} more</p>` : ''}` : '';
  const liv = d.liv?.length ? `<p class="liv">${d.liv.map(s => `<span><span class="data">${esc(s.label)}</span> <span class="book">${esc(s.form)}</span></span>`).join('')}</p>` : '';
  const ex = d.examples?.length ? `${d.examples.map(example).join('')}${d.uses > d.examples.length ? `<p class="data rl-more">Used ${d.uses.toLocaleString()} times in the corpus.</p>` : ''}` : '';
  ent.innerHTML = `<div class="e-in">
    <button class="e-back data" aria-label="Back to results">‹ Results</button>
    <header class="e-head">
      ${ini ? `<img class="e-cap" src="${initialSrc(ini.letter)}" alt="" onerror="this.remove(); this.closest('.e-head')?.classList.add('no-cap')">` : ''}
      <h2 class="e-form pie">${star ? '<span class="e-star">*</span>' : ''}${ts(d.form)}</h2>
      <p class="e-meta data">${meta.map(esc).join(' · ')}${d.ipa ? `<span class="e-ipa">[${esc(d.ipa)}]</span>` : ''}</p>
      <div class="e-say" hidden><button class="e-play data" aria-label="Listen"><span class="e-play-i" aria-hidden="true"></span>Listen</button>
        <span class="e-voices serif" role="group" aria-label="Voice"><button data-v="m">male voice</button> · <button data-v="f">female voice</button></span></div>
      ${d.gloss ? `<p class="e-gloss serif">${esc(d.gloss)}</p>` : `<p class="e-gloss serif none">Wiktionary gives no meaning for this form.</p>`}
      ${d.senses?.length > 1 ? `<ol class="e-senses serif">${d.senses.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    </header>
    ${sec('Formation', formation)}
    ${sec('Inflection', paradigm(d.paradigm), 'e-para')}
    ${sec('Stems (LIV²)', liv)}
    ${sec('In the corpus', ex, 'e-ex')}
    ${sec('Descendants', refl, 'e-refl')}
    ${sec(d.class === 'R' ? 'Words from this root' : 'Related words', family)}
    <p class="e-src serif">${sourceLine(d.source, d)}</p>
  </div>`;
  // the initial: the letter the entry is filed under, illuminated beside the headword (which is printed whole)
  const cap = $('.e-cap', ent);
  if (cap) { const done = () => ent.querySelector('.e-head')?.classList.add('has-cap'); cap.complete && cap.naturalWidth ? done() : cap.addEventListener('load', done, { once: true }); }
  wireTabs(ent);
  spoken(id).then(o => {
    const box = ent.querySelector('.e-say'); if (!o || !box || current !== id) return;
    box.hidden = false;
    const mark = () => box.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === voice));
    mark();
    box.querySelector('.e-play').onclick = e => say(id, voice, e.currentTarget);
    box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { voice = b.dataset.v; try { localStorage.setItem('pie-voice', voice); } catch {} mark(); say(id, voice, box.querySelector('.e-play')); });
  });
  ent.querySelector('.e-back').onclick = () => history.length > 1 && history.state?.dict ? history.back() : closeEntry();
  document.documentElement.classList.add('entry-open');
  if (!reduce && window.gsap) {
    gsap.from(ent.querySelectorAll('.e-head > *'), { y: 26, opacity: 0, duration: .8, stagger: .06, ease: 'power4.out', clearProps: 'all' });
    gsap.from(ent.querySelectorAll('.e-sec, .e-src'), { y: 18, opacity: 0, duration: .7, delay: .18, stagger: .07, ease: 'power3.out', clearProps: 'all' });
  }
  if (scroll) {
    if (phone()) ent.scrollTo({ top: 0 });
    else { const top = $('.dict-main').getBoundingClientRect().top + scrollY - 10; if (scrollY > top) scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' }); }
  }
  document.title = `*${d.form} — Dictionary — *PIE`;
  const u = new URL(location.href); u.searchParams.set('e', id);
  if (u.href !== location.href) history[push ? 'pushState' : 'replaceState']({ dict: 1 }, '', u);
}
function closeEntry() {
  document.documentElement.classList.remove('entry-open');
  state({ e: null }, false);
}

// ------------------------------------------------------------------------------------------------ boot
async function boot() {
  initType();
  nav(); colophon();
  const [raw, au] = await Promise.all([fetch('data/dict/index.json').then(r => r.json()), fetch('data/dict/audio/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => [])]);
  const ai = Array.isArray(au) ? { shards: au } : au;   // index.json: {v, shards} (a bare list before the v2 voices)
  AUDIO = new Set(ai.shards || []); AV = ai.v ? `?v=${ai.v}` : '';
  IX = raw.map(([id, form, g, c, p, fl, n, u]) => ({ id, form, g, c, p, fl, n, u, f: fold(form), l: loose(form), w: words(g), s: senses(g), L: letterOf(form) }));
  IX.forEach((e, k) => BYID.set(e.id, k));
  $('#dhP').insertAdjacentHTML('beforeend', ` <span class="dh-n">${IX.length.toLocaleString()} entries.</span>`);
  // letters
  const count = new Map(); IX.forEach(e => count.set(e.L, (count.get(e.L) || 0) + 1));
  $('#letters').innerHTML = LETTERS.filter(L => count.get(L)).map(L => `<button data-l="${L}" title="${count.get(L)} entries">${ts(L)}</button>`).join('');
  $('#letters').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; qi.value = ''; setQuery(b.classList.contains('on') ? '' : 'letter:' + b.dataset.l, { push: true }); });
  // search as you type
  let tm; qi.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => setQuery(qi.value), 90); });
  qi.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = res.querySelector('.r'); if (f) openEntry(f.dataset.id); } });
  addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== qi) { e.preventDefault(); qi.focus(); } });
  // links to entries anywhere on the page
  document.addEventListener('click', e => { const a = e.target.closest('a[data-id]'); if (!a || e.metaKey || e.ctrlKey) return; e.preventDefault(); openEntry(a.dataset.id); });
  addEventListener('popstate', () => route(false));
  const p = new URLSearchParams(location.search);
  qi.value = p.get('q')?.startsWith('letter:') ? '' : (p.get('q') || '');
  setQuery(p.get('q') || '');
  await route(false);
  document.documentElement.classList.remove('arriving'); document.documentElement.classList.add('arrived');
  { const fb = $('.foot-by'); if (fb) fb.style.setProperty('--streak', `url(${brushStroke('#b81d0e', 4242, { w: 900, h: 170 })})`); }
  garden();
  // descendant forms, for searching by a daughter-language word
  fetch('data/dict/reflex.json').then(r => r.json()).then(rx => { RX = rx; if (qi.value.trim()) setQuery(qi.value); });
}
async function route(push) {
  const p = new URLSearchParams(location.search), id = p.get('e');
  const q = p.get('q') || '';
  if (q !== (qi.value || '') && !q.startsWith('letter:')) { qi.value = q; setQuery(q); }
  if (id && BYID.has(id)) await openEntry(id, { push: false, scroll: false });
  else if (!phone()) await openEntry('pie-lex-h1ekjwos', { push: false, scroll: false });
  else closeEntry();
}
// the header's garden: grown once as the page opens (tools/build_growth.mjs, page "dict"), the finished garden on Safari
function garden() {
  const host = $('.dh-garden'), sfx = '';
  if (innerWidth < 700) return;          // a phone's header is all text: no room for a garden
  const probe = document.createElement('video');
  const alpha = probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const still = () => { const im = new Image(); im.className = 'gv'; im.alt = ''; im.src = `art/garden-dict${sfx}.webp`; im.onerror = () => im.remove(); host.append(im); };
  if (location.search.includes('nogarden')) return;
  if (alpha && !reduce) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.className = 'gv'; v.src = `art/growth-dict${sfx}.webm`; host.append(v);
    v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true }); v.addEventListener('error', () => { v.remove(); still(); }, { once: true }); }
  else still();
}
boot();
