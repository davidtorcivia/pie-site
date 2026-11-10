// The one registry of styles (research/10-rubricate.md): a key's style, whichever module made it. kit/wayfinding.js fills
// it with the pilot styles, kit/illum.js adds a written style (kit/styles/*.js) when a page first uses it, and a page may add
// its own (STYLES.kelmscott = ...). Kept apart so a page of one written style never loads the pilots.
export const STYLES = {};
