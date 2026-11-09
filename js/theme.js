// Light and dark. The site is light by default, whatever the reader's system prefers; the toggle in the nav switches to
// dark and back, and the choice is kept in localStorage 'pie-theme'. <html> always carries data-theme="light" or
// "dark" (illum reads it before the system's scheme), plus class "dark" in dark for css/dark.css. An inline script at
// the top of every page's <head> applies a stored choice before the first paint, so nothing flashes.
// Every change fires a 'themechange' event on window: anything drawn in colour (charts, illum's rubrication) redraws.
const KEY = 'pie-theme';

export const isDark = () => document.documentElement.dataset.theme === 'dark';

export function setDark(dark) {
  try { if (dark) localStorage.setItem(KEY, 'dark'); else localStorage.removeItem(KEY); } catch { /* private window: this page only */ }
  const r = document.documentElement; r.setAttribute('data-theme', dark ? 'dark' : 'light'); r.classList.toggle('dark', dark);
  sync(); dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}

// the toggle: a crescent in light (to go dark), a sun in dark (to go light)
const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 1.6a6.6 6.6 0 1 0 3.8 10.1A5.4 5.4 0 0 1 10.6 1.6z" fill="currentColor"/></svg>';
const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g></svg>';
const buttons = new Set();
function sync() {
  const dark = document.documentElement.dataset.theme === 'dark';
  for (const b of buttons) {
    b.innerHTML = dark ? SUN : MOON;
    b.setAttribute('aria-label', 'Dark mode'); b.setAttribute('aria-pressed', String(dark));
    b.title = dark ? 'Light mode' : 'Dark mode';
  }
}
export function themeButton(cls = '') {
  const b = document.createElement('button'); b.type = 'button'; b.className = `theme-toggle ${cls}`.trim();
  b.addEventListener('click', () => setDark(document.documentElement.dataset.theme !== 'dark'));
  buttons.add(b); sync(); return b;
}
