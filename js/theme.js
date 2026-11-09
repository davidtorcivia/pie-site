// Light and dark. The site follows the reader's system unless they choose otherwise with the toggle in the nav (three
// states: system, light, dark, kept in localStorage 'pie-theme'). In system mode <html> carries no data-theme at all
// (the CSS and illum then read prefers-color-scheme); a choice sets data-theme="light" or "dark". An inline script at
// the top of every page's <head> applies a stored choice before the first paint, so nothing flashes.
// Every change, and a change of the system's scheme while following it, fires a 'themechange' event on window:
// anything drawn in colour (charts, the map, illum's rubrication) redraws on it.
const KEY = 'pie-theme';
const mq = matchMedia('(prefers-color-scheme: dark)');
const MODES = ['system', 'light', 'dark'];

export function mode() {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; }
}
export const isDark = () => { const m = mode(); return m === 'dark' || (m === 'system' && mq.matches); };
const fire = () => dispatchEvent(new CustomEvent('themechange', { detail: { mode: mode(), dark: isDark() } }));

export function setMode(m) {
  try { if (m === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch { /* private window: this page only */ }
  const r = document.documentElement;
  if (m === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', m);
  sync(); fire();
}
mq.addEventListener('change', () => { if (mode() === 'system') { sync(); fire(); } });

// the toggle: one small glyph, a half-lit disc for "as your system", an open disc for light, a crescent for dark
const GLYPH = {
  system: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g></svg>',
  dark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 1.6a6.6 6.6 0 1 0 3.8 10.1A5.4 5.4 0 0 1 10.6 1.6z" fill="currentColor"/></svg>',
};
const NAME = { system: 'as your device', light: 'light', dark: 'dark' };
const buttons = new Set();
function sync() {
  const m = mode(), next = MODES[(MODES.indexOf(m) + 1) % 3];
  document.documentElement.classList.toggle('dark', isDark());     // the resolved theme, for css/dark.css
  for (const b of buttons) {
    b.innerHTML = GLYPH[m];
    b.setAttribute('aria-label', `Theme: ${NAME[m]}. Switch to ${NAME[next]}`);
    b.title = `Theme: ${NAME[m]}`;
    b.dataset.mode = m;
  }
}
export function themeButton(cls = '') {
  const b = document.createElement('button'); b.type = 'button'; b.className = `theme-toggle ${cls}`.trim();
  b.addEventListener('click', () => setMode(MODES[(MODES.indexOf(mode()) + 1) % 3]));
  buttons.add(b); sync(); return b;
}
