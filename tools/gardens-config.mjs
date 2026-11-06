// The section gardens: which box each fills, what it grows round, its inks and seeds (shared by the builders)
// side: 'field' grows round the obstacles over the whole box; 'left' / 'right' is a manuscript margin, a full-height
// garden in a column COL of the box's width (florilegium's own page composition; right is the left one mirrored)
export const COL = .27;
// the growth, as florilegium records it: frames k of 8 (the page plays them in order as the section is discovered)
export const FRAMES = [2, 3, 4, 5, 6, 8];
export const SECTIONS = {
  open: { box: '#s-open', side: 'field', avoid: ['.hero-cap', '.open-h .line', '.open-p'], ink: '2A1F12', accent: 'A8361F', seeds: [23, 58] },
  // a second header garden hanging from the top-right corner: grown as a field turned through 180°, kept to the
  // upper part of the header (the lower part is an obstacle) so it meets the rising garden without crowding it
  opentop: { box: '#s-open', side: 'field', turn: true, avoid: ['.hero-cap', '.open-h .line', '.open-p'], keepTop: .5, ink: '2A1F12', accent: 'A8361F', seeds: [131] },
  wheel: { box: '#s-wheel .wheel-pin', side: 'left', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [77, 141] },
  machine: { box: '#s-machine', side: 'right', avoid: [], ink: '5A3B18', accent: '1F5A43', seeds: [91, 203] },
  voice: { box: '#s-voice', side: 'left', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [17, 99] },
  apps: { box: '#s-apps', side: 'right', avoid: [], ink: 'D9CFB4', accent: 'FFD21A', seeds: [61, 113] },
  // the dictionary's header (dictionary.html): a field round the title, search and alphabet
  dict: { page: 'dictionary.html', box: '.dict-head', side: 'field', avoid: ['.dh-title', '.dh-p', '.dh-search', '.dh-hint', '.dh-letters button', '.nav-bar'], ink: '2A1F12', accent: 'A8361F', seeds: [47, 88], stemx: .84, novisitors: true, above: ['.dh-title'] },
  // the voices page's header (voices.html): a field round the title and lede, the horses gallop along its foot
  voices: { page: 'voices.html', box: '.v-head', side: 'field', avoid: ['.v-title', '.v-lede', '.nav-bar'], ink: '2A1F12', accent: 'A8361F', seeds: [63, 151], stemx: .8, novisitors: true, above: ['.v-title'] },
  foot: { box: 'footer', side: 'both', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [31, 177] },
};
export const MM = 420 / 1440;                    // mm per CSS px: one scale for every garden on the page

// phones (PHONE=1): every garden is a field grown round the section's content, measured at 390 px wide
export const PHONE_AVOID = {
  open: ['.hero-cap', '.open-h .line', '.open-p'],
  opentop: ['.hero-cap', '.open-h .line', '.open-p'],
  wheel: ['.wheel-copy h2', '.wheel-copy p', '.wheel-nav', '#wheel'],
  machine: ['#s-machine h2', '.tier', '.note'],
  voice: ['.voice-top h2', '.voice-top p', '.disc', '.hymn', '.voice-bar'],
  apps: ['#s-apps h2', '.apps-p', '.tr', '.tr-out'],
  foot: ['.foot-pie', 'footer p', '.foot-cols'],
  dict: ['.dh-title', '.dh-p', '.dh-search', '.dh-hint', '.dh-letters button', '.nav-bar'],
};
