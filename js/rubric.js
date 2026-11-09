// The article pages' rubrication (illum, "Rock carving": the pecked and painted figures of Tanum, in iron-oxide red),
// from a pinned copy of the library in illum/kit (hash in illum/kit/hash.json). The text carries the hooks: each
// section's lead paragraph opens with <span class="ini drop">, p.par where the argument turns, an <hr> between
// sections (data-rank 2 at a major turn, 3 at the end); figures are framed and paragraph ends filled by the library.
// Everything illum draws is on aria-hidden canvases behind the text, inside main.v-art.
//
// The theme: illum follows <html data-theme> (light unless the nav's toggle chose dark, js/theme.js) and redraws
// when it changes. Without OffscreenCanvas and module workers, nothing runs and the text stays plain (the CSS that
// hides the real drop letter applies only under html.illum).
export async function rubric() {
  const art = document.querySelector('main.v-art');
  if (!art || typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined' || location.search.includes('noillum')) return;
  // the faces the text is set in, so the lines illum measures are the final ones
  await Promise.all(['900 20px Archivo', '500 20px Newsreader', 'italic 20px "Instrument Serif"', '500 14px "JetBrains Mono"']
    .map(f => document.fonts.load(f).catch(() => {})));
  let rubricate;
  try { ({ rubricate } = await import('../illum/kit/illum.js')); } catch { return; }
  document.documentElement.classList.add('illum');
  const r = rubricate(art, { host: art, style: 'rock', rich: 0.5, draw: 'still', select: { filler: '.sec > p.book' } });
  addEventListener('themechange', () => r.redraw());          // the nav's toggle (js/theme.js)
  return r;
}
