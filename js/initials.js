// Settings for the initials (initialis + our steppe kinds), shared by the page and the build that pre-renders them
// (tools/build_static.mjs), so the page shows images and never draws an initial at load.
// One frame for every initial on the site: no rule lines, a band of horses in an even grid on every side, the same
// margin and band width, so the coloured square sits CAP.pad of the image inside every edge. Pages place an initial by
// that square (css: --cap-pad), and the horses hang outside the text they sit beside.
export const CAP = { margin: 40, gap: 100 };
// bump when the initials are rebuilt: their file names stay the same and browsers cache art
export const ART_V = '4';
CAP.pad = (CAP.margin + CAP.gap) / 1000;
const framed = (P, band = 'horses', perSide = 3) => ({ ...P, frame: 'rect', fRules: 2, fMargin: CAP.margin, fGap: CAP.gap, fW1: 0, fW2: 0, fBand: band, fHorseN: perSide });
// the borders, in turn: horses on about one initial in three, the others beads, pearls or dentils, all laid evenly
// and symmetrically (js/kinds/steppe.js even-*); never a hairline, a zigzag or a band that crosses at the corners
const BANDS = ['even-beads', 'even-dentil', 'horses', 'even-pearls', 'even-beads', 'horses', 'even-dentil', 'even-pearls'];
export const heroP = lib => framed({ ...lib.random(4242), text: 'P', paper: '#ffd21a', inkA: '#1d1a16', inkB: '#a8361f', inkC: '#1d1a16',
  frame: 'rect', fMargin: 6, fRules: 2, fW1: 5, fGap: 96, fW2: 3, fBand: 'horses', fField: 'A', fPattern: 'herd', fPatColor: 'B', fPatScale: 10,
  fCorner: 'sunwheel', fCornerSize: 70, oFlower: 'tulip', oLeaf: 'willow', lFill: 'paper' }, 'horses', 4);
export const leafP = (lib, i, k, letter) => framed({ ...lib.random(7000 + i * 131), text: letter, paper: k.paper, inkA: k.ink, inkB: k.accent, inkC: k.ink,
  frame: 'rect', fRules: 2, fW1: 5, fGap: i % 2 ? 120 : 80, fW2: 2.5, fBand: i % 2 ? 'horses' : 'cord', fField: ['A', 'paper', 'A', 'B'][i % 4],
  fPattern: ['herringbone', 'steps', 'pitcomb', 'herd'][i % 4], fPatColor: ['paper', 'A', 'paper', 'paper'][i % 4], fPatScale: 12,
  fCorner: 'sunwheel', fCornerSize: 46, oFlower: 'tulip', oLeaf: 'willow', lFill: ['paper', 'A', 'paper', 'paper'][i % 4] }, BANDS[i % BANDS.length], 3);
// the first letter of a text (with its accent) for its initial, and the rest of the text
export function splitInitial(pie) {
  const src = pie.normalize('NFD'), at = src.search(/[a-z]/i);
  const [cl, base, marks] = src.slice(at).match(/^([a-z])([\u0300-\u036f]*)/i);
  return { letter: (base.toUpperCase() + marks).normalize('NFC'), rest: src.slice(at + base.length + marks.length), src };
}
