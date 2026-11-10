// Type system. Every face plays a role (display, pie, serif, data, accent), set as CSS variables on :root, so a
// whole set of faces swaps at once (press F to cycle). PIE is typeset so that any face can set it: the glyphs most
// faces lack are built from ones they have. Laryngeal digits ₁₂₃ become small figures (.lar), modifier letters
// ʰ ʷ become raised small letters (.mod), and precomposed accented letters are decomposed to base + combining mark.
// The site's own set ('steppe') needs none of that: its Newsreader carries ₁₂₃ ʰ ʷ ḱ ǵ ḗ ṓ and the ring below of n̥
// (tools/build_fonts.py), so there the real characters are set (and copy as themselves).

const G = 'https://fonts.googleapis.com/css2?display=swap&family=';

// local OFL faces (Velvetyne), fonts/*.woff2; licenses in fonts/licenses
const LOCAL = [
  ['Basteleur', 'Basteleur-Bold', 700], ['Basteleur', 'Basteleur-Moonlight', 400],
  ['Ouroboros', 'Ouroboros-Regular', 400], ['Gulax', 'Gulax-Regular', 400],
  ['Compagnon', 'Compagnon-Roman', 400], ['Compagnon', 'Compagnon-Bold', 700],
  ['Compagnon', 'Compagnon-Italic', 400, 'italic'],
  ['Happy Times', 'happy-times-NG_regular_master_web', 400], ['Happy Times', 'happy-times-NG_bold_master_web', 700],
  ['Happy Times', 'happy-times-NG_italic_master_web', 400, 'italic'],
];

// a set: family names plus the variation/weight each role uses; google: families to fetch
export const SETS = [
  // the site's own set: its four faces are self-hosted (css/fonts.css, fonts/), nothing to fetch from Google
  { name: 'steppe', google: [],
    book: ["'Newsreader'", 500, "'opsz' 18"],
    display: ["'Archivo'", 900, "'wdth' 125"], pie: null, serif: ["'Instrument Serif'", 400, 'normal', 'italic'],
    data: ["'JetBrains Mono'", 500], accent: ["'Basteleur'", 700] },
  { name: 'ouroboros', google: ['JetBrains+Mono:wght@400;700'],
    book: ["'Compagnon'", 400],
    display: ["'Ouroboros'", 400], pie: null, serif: ["'Happy Times'", 400, 'normal', 'italic'],
    data: ["'JetBrains Mono'", 500], accent: ["'Gulax'", 400] },
  { name: 'climate', book: ["'Fraunces'", 400, "'SOFT' 60, 'WONK' 0, 'opsz' 18"], google: ['Climate+Crisis:YEAR@1979..2048', 'Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800',
      'Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;1,9..144,100..900,0..100,0..1', 'JetBrains+Mono:wght@400;700'],
    display: ["'Climate Crisis'", 400, "'YEAR' 1979"], pie: null,
    serif: ["'Fraunces'", 300, "'SOFT' 100, 'WONK' 1", 'italic'], data: ["'JetBrains Mono'", 500], accent: ["'Basteleur'", 400] },
  { name: 'anybody', book: ["'Gloock'", 400], google: ['Anybody:ital,wdth,wght@0,50..150,100..900;1,50..150,100..900', 'Gloock', 'Space+Mono:wght@400;700'],
    display: ["'Anybody'", 900, "'wdth' 150"], pie: null, serif: ["'Gloock'", 400],
    data: ["'Space Mono'", 400], accent: ["'Gulax'", 400] },
  { name: 'syne', book: ["'Bodoni Moda'", 500, "'opsz' 14"], google: ['Syne:wght@400..800', 'Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900', 'Handjet:ELGR,ELSH,wght@1..2,0..16,100..900'],
    display: ["'Syne'", 800], pie: null, serif: ["'Bodoni Moda'", 400, "'opsz' 11", 'italic'],
    data: ["'Handjet'", 400, "'ELSH' 2"], accent: ["'Ouroboros'", 400] },
];

const ROLES = ['display', 'pie', 'book', 'serif', 'data', 'accent'];
const loaded = new Set();

function loadLocal() {
  const css = LOCAL.map(([fam, file, w, st]) =>
    `@font-face{font-family:'${fam}';src:url(fonts/${file}.woff2) format('woff2');font-weight:${w};font-style:${st || 'normal'};font-display:swap}`).join('');
  const s = document.createElement('style'); s.textContent = css; document.head.append(s);
}

function loadGoogle(fams) {
  if (!fams.length) return;
  const href = G + fams.join('&family=');
  if (loaded.has(href)) return;
  loaded.add(href);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
}

export function applySet(i) {
  const set = SETS[(i + SETS.length) % SETS.length];
  loadGoogle(set.google);
  const r = document.documentElement.style;
  for (const role of ROLES) {
    const [fam, w, v, st] = set[role] || set.book;   // PIE is set in the book face
    r.setProperty(`--f-${role}`, `${fam}, system-ui, sans-serif`);
    r.setProperty(`--w-${role}`, w);
    r.setProperty(`--v-${role}`, v || 'normal');
    r.setProperty(`--s-${role}`, st || 'normal');
  }
  document.documentElement.dataset.type = set.name;
  try { localStorage.setItem('pie-type', set.name); } catch {}
  return set;
}

export function initType() {
  loadLocal();
  let start = 0;
  try { start = Math.max(0, SETS.findIndex(s => s.name === (new URLSearchParams(location.search).get('type') || localStorage.getItem('pie-type')))); } catch {}
  let cur = start;
  applySet(cur);
  addEventListener('keydown', e => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (/input|textarea/i.test(document.activeElement?.tagName)) return;
    cur = (cur + (e.shiftKey ? -1 : 1) + SETS.length) % SETS.length;
    const set = applySet(cur);
    flash(set.name);
    dispatchEvent(new CustomEvent('typechange', { detail: set }));
  });
}

function flash(name) {
  let el = document.getElementById('typeflash');
  if (!el) { el = document.createElement('div'); el.id = 'typeflash'; document.body.append(el); }
  el.textContent = name;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

// PIE typesetting --------------------------------------------------------------------------------------------
const LAR = { '₁': '1', '₂': '2', '₃': '3' };
const MOD = { 'ʰ': 'h', 'ʷ': 'w' };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// returns HTML: each word in <span class="w">, laryngeals and modifier letters rebuilt in the current face
export function typeset(text, { words = true } = {}) {
  const out = [], own = document.documentElement.dataset.type === 'steppe';   // the site's own faces have every PIE glyph
  for (const tok of text.normalize('NFD').split(/(\s+)/)) {
    if (!tok) continue;
    if (/^\s+$/.test(tok)) { out.push(tok); continue; }
    let h = '';
    for (const ch of tok) {
      if (LAR[ch] && !own) h += `<span class="lar">${LAR[ch]}</span>`;
      else if (MOD[ch] && !own) h += `<span class="mod">${MOD[ch]}</span>`;
      else h += esc(ch);
    }
    out.push(words ? `<span class="w">${h}</span>` : h);
  }
  return out.join('');
}

// fill every [data-pie] element from its text
export function typesetAll(root = document) {
  root.querySelectorAll('[data-pie]').forEach(el => {
    if (!el.dataset.src) el.dataset.src = el.textContent.trim();
    el.innerHTML = typeset(el.dataset.src, { words: el.dataset.pie !== 'flat' });
  });
}
