// The site's navigation, the same on every page: the pages as a short row of links on one painted stroke at the top
// right. It takes the colour that reads over the section beneath it (chalk over yellow, yellow over paper and ink),
// marks the page you are on with a red stroke, slips away while you scroll down and comes back when you scroll up.
// When the row no longer fits (more pages, a narrow screen) it folds into one "Menu" stroke that opens a full page of
// links with a garden at its foot. A new page is one more line in PAGES.
import { themeButton } from './theme.js';
const PAGES = [
  ['index', '*PIE', 'index.html'],   // the mark stands for home
  ['voices', 'Voices', 'voices.html'],
  ['model', 'Model', 'model.html'],
  ['dictionary', 'Dictionary', 'dictionary.html'],
];
const here = location.pathname.replace(/\/$/, '/index.html');
const PAGE = (PAGES.find(([, , h]) => here.endsWith('/' + h) || here.endsWith('/' + h.replace(/\.html$/, ''))) || PAGES[0])[0];
// absolute: a url() inside a custom property resolves against the stylesheet that uses it, not the page
const stroke = k => new URL(`art/brush/${String(k % 64).padStart(2, '0')}.webp`, location.href).href;
const links = cls => PAGES.map(([id, t, h], k) => `<a href="${h}" class="${cls} ${id === 'index' ? 'mark' : ''} ${id === PAGE ? 'on' : ''}"${id === 'index' ? ' aria-label="Home"' : ''} ${id === PAGE ? 'aria-current="page"' : ''} style="--stroke:url(${stroke(k * 5 + 3)})">${t}</a>`).join('');

export function nav() {
  const n = document.createElement('nav'); n.className = 'nav'; n.setAttribute('aria-label', 'Site');
  n.innerHTML = `<div class="nav-bar data" style="--stroke:url(${stroke(41)})"><div class="nav-links">${links('nl')}</div>
    <button class="nav-open" aria-expanded="false" aria-controls="navSheet">Menu</button></div>`;
  const sheet = document.createElement('div'); sheet.className = 'nav-sheet'; sheet.id = 'navSheet'; sheet.hidden = true;
  sheet.innerHTML = `<button class="nav-close data">Close</button><div class="nav-sheet-links display">${links('sl')}</div>
    <img class="nav-sheet-garden" src="art/garden-foot-m.webp" alt="" loading="lazy">`;
  // light and dark: the toggle closes the row (and stays beside Menu when the row folds); a second one in the menu
  n.querySelector('.nav-bar').append(themeButton('nt'));
  sheet.prepend(themeButton('st'));
  document.body.prepend(sheet); document.body.prepend(n);

  // Home from the home page goes back to the top
  const top = e => { if (PAGE !== 'index' || !e.target.closest('a[href="index.html"]')) return; e.preventDefault(); close();
    window.lenis ? window.lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: 'smooth' }); };
  n.addEventListener('click', top); sheet.addEventListener('click', top);

  // the row, or the menu when the row does not fit
  const fit = () => { n.classList.remove('folded'); const row = n.querySelector('.nav-links');
    if (row.scrollWidth > Math.min(innerWidth * .62, 900)) n.classList.add('folded'); };
  const open = () => { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('on')); n.querySelector('.nav-open').setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('sheet-open'); window.lenis?.stop(); sheet.querySelector('a').focus({ preventScroll: true }); };
  function close() { if (sheet.hidden) return; sheet.classList.remove('on'); n.querySelector('.nav-open').setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('sheet-open'); window.lenis?.start(); setTimeout(() => { sheet.hidden = true; }, 450); }
  n.querySelector('.nav-open').onclick = open; sheet.querySelector('.nav-close').onclick = close;
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  let lastY = scrollY, hidden = false, raf = 0;
  const update = () => {
    raf = 0;
    const y = scrollY, bar = n.querySelector('.nav-bar').getBoundingClientRect();
    const below = document.elementsFromPoint(Math.min(innerWidth - 8, bar.left + bar.width / 2), bar.bottom + 4).find(el => !el.closest('.nav'));
    const sec = below?.closest('section, footer, header, .dict-sec, .dict-entry');
    const tone = sec?.classList.contains('yellow') || sec?.dataset.tone === 'yellow' ? 'on-yellow' : 'on-other';
    if (n.dataset.tone !== tone) n.dataset.tone = tone;
    const dy = y - lastY;
    if (Math.abs(dy) > 6) { const h = dy > 0 && y > 240; if (h !== hidden) { hidden = h; n.classList.toggle('away', h); } lastY = y; }
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', () => { fit(); if (!raf) raf = requestAnimationFrame(update); });
  n.addEventListener('focusin', () => { hidden = false; n.classList.remove('away'); });
  document.fonts?.ready.then(fit); fit(); update();
}
