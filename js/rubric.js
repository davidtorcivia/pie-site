// The site's rubrication (illum, "Rock carving": the pecked and painted figures of Tanum, in iron-oxide red), from a
// pinned copy of the library in illum/<hash>/ (the hash is the kit's own, illum/<hash>/hash.json). /illum/* is served
// immutable for a year (_headers), and the kit's imports are relative and unversioned, so an update never goes into
// the same directory: copy the new kit to illum/<its new hash>/, change KIT below, delete the old directory, one commit.
// The text carries the hooks: `.ini` for a
// carved initial (`.ini.drop` opening a paragraph), p.par where the argument turns, <hr> between parts (data-rank 2 at
// a major turn, 3 at the end); paragraph ends are filled and figures framed by the library. Everything illum draws is
// on aria-hidden canvases behind the text, inside the host.
//   /voices and /model: rubric(), over main.v-art
//   the dictionary: each entry's initial, the filler after its gloss and the breaks between its sections (js/dict.js)
//   the home page: the hero's P and the copy on the yellow sections (js/main.js)
// The theme: illum follows <html data-theme> (light unless the nav's toggle chose dark, js/theme.js) and redraws when
// it changes; a host on yellow passes theme 'light', whatever the page's. Without OffscreenCanvas and module workers
// nothing runs and the text stays plain (the CSS that hides a carved letter's own glyph applies only under html.illum).
const KIT = '../illum/d2fe4bf38bfdabd9/illum.js';
export const canCarve = () => typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && !location.search.includes('noillum');

let kit;
const loadKit = () => kit ??= (async () => {
  if (!canCarve()) return null;
  // the faces the text is set in, so the lines illum measures are the final ones
  await Promise.all(['900 20px Archivo', '500 20px Newsreader', '600 20px Newsreader', 'italic 20px "Instrument Serif"', '500 14px "JetBrains Mono"']
    .map(f => document.fonts.load(f).catch(() => {})));
  try { const m = await import(KIT); document.documentElement.classList.add('illum'); return m; } catch { return null; }
})();

// rubricate one host (its own text is the root unless opts.root says otherwise); null when it cannot run.
// The result redraws when the theme changes, until destroyed.
export async function carve(host, opts = {}) {
  const m = await loadKit(); if (!m || !host?.isConnected) return null;
  const { root = host, ...o } = opts;
  const r = m.rubricate(root, { host, style: 'rock', rich: 0.5, draw: 'still', ...o });
  const on = () => r.redraw(); addEventListener('themechange', on);
  return { redraw: () => r.redraw(), destroy() { removeEventListener('themechange', on); r.destroy(); } };
}

// the article pages
export function rubric() {
  const art = document.querySelector('main.v-art');
  return art ? carve(art, { select: { filler: '.sec > p.book' } }) : null;
}

// no element: for a host that wants only some of illum's cases
export const NONE = ':not(*)';
