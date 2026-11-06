// The foot of the inner pages (voices, model, dictionary): a PIE phrase from the dictionary, set large, with its
// story; the pages; the signature. The homepage's own footer garden (art/garden-foot*.webp, growth-foot*.webm)
// grows behind it when the footer comes into view, scaled to cover so it never stretches.
import { typeset } from './type.js';
import { brushStroke } from './brush.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function colophon() {
  const f = document.querySelector('footer.colo'); if (!f) return;
  f.querySelectorAll('.colo-pie a').forEach(a => { a.innerHTML = typeset(a.textContent.trim(), { words: false }); });
  const by = f.querySelector('.foot-by');
  if (by) by.style.setProperty('--streak', `url(${brushStroke('#b81d0e', 4242, { w: 900, h: 170 })})`);
  const here = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  f.querySelectorAll('.colo-nav a').forEach(a => { if (a.getAttribute('href').replace(/\.html$/, '') === here) a.setAttribute('aria-current', 'page'); });
  if (location.search.includes('nogarden')) return;
  const g = document.createElement('div'); g.className = 'colo-garden'; g.setAttribute('aria-hidden', 'true'); f.prepend(g);
  const sfx = innerWidth < 700 ? '-m' : '';
  const still = () => { const im = new Image(); im.alt = ''; im.src = `art/garden-foot${sfx}.webp`; im.decode().catch(() => {}).then(() => { g.replaceChildren(im); }); };
  const probe = document.createElement('video');
  const alpha = !!probe.canPlayType && probe.canPlayType('video/webm; codecs="vp9"') !== '' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const grow = () => {
    if (!alpha || reduce || sfx) return still();          // phones: the finished garden, no decoder
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = `art/growth-foot.webm`; g.append(v);
    let done = false; const finish = () => { if (done) return; done = true; still(); };
    v.addEventListener('canplay', () => v.play().catch(finish), { once: true });
    v.addEventListener('ended', finish, { once: true }); v.addEventListener('error', finish, { once: true });
    setTimeout(finish, 20000);
  };
  new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { grow(); o.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' }).observe(f);
}
