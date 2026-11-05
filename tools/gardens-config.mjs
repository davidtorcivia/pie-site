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
  foot: { box: 'footer', side: 'both', avoid: [], ink: '2A1F12', accent: 'A8361F', seeds: [31, 177] },
};
export const MM = 420 / 1440;                    // mm per CSS px: one scale for every garden on the page
