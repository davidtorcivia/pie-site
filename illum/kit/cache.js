// The ornament remembered. A still is a pure function of the library's code, its fonts, the text and where the browser laid
// it out, the options, the theme and the screen's density; so the drawn layer is kept (IndexedDB, which plain http allows),
// under a key of all of those, and the next visit draws it from the store in a few milliseconds without the ink engine.
//
//   libraryHash(entry)          every module reachable from entry (every module path its source names) and any style module
//                               the page loaded itself (kit/styles/*.js), and
//                               every face it names, as one hash: any edit to the library, a style or a font makes a new key.
//                               A built site may ship hash.json beside the entry ({ hash }), written by its build, instead
//                               of the crawl
//   fingerprint(root, host)     where every line of text fell, relative to the host (quarter px), and the host's size
//   lookup(key, lib, baked?)    the record for key: from the store, else from a shipped bake (a manifest URL, tools/bake.mjs:
//                               kit/bake.json beside kit/illum.js unless the page names another);
//                               only if it was drawn by this library (lib() -> libraryHash). The key itself is cheap (no
//                               library hash), so a page never drawn before learns so from one read of the store
//   paint(rec, canvas, host)    the record drawn into the ornament layer, the bands in view first
//   remember(key, rec, canvas)  the layer stored in bands, once the page is idle
// A record: { lib, fp, ini (the initials' inline styles), orn, seed, w, h (css px), W, H (device px), bands: [{ y, blob }] }.
// It is used only if the text falls exactly where it fell when it was drawn; else the page draws it live, as without it.
const BAND = 1024, KEEP = 40;
const fnv = (s, h = 2166136261) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fnvBytes = (b, h = 2166136261) => { for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
export const hashText = s => fnv(s).toString(36) + s.length.toString(36);

const hashes = new Map();
export function libraryHash(entry) {
  if (hashes.has(entry)) return hashes.get(entry);
  const p = (async () => {
    try { const r = await fetch(new URL('hash.json', entry)); if (r.ok) { const j = await r.json(); if (j.hash) return String(j.hash); } } catch {}
    const seen = new Map(), fonts = new Set();
    const visit = async url => { if (seen.has(url)) return; seen.set(url, null);
      const src = await (await fetch(url)).text(); seen.set(url, hashText(src));
      // a module's fonts: the faces it names, found in the folder it points at (new URL('../fonts/', import.meta.url))
      const dir = src.match(/new URL\(\s*['"]([^'"]*\/)['"]\s*,\s*import\.meta\.url\s*\)/)?.[1];
      if (dir) for (const [, f] of src.matchAll(/['"]([\w./-]+\.woff2)['"]/g)) fonts.add(new URL(f, new URL(dir, url)).href);
      // (every module it names: imported, or a path it imports later, as kit/illum.js names its styles)
      await Promise.all([...src.matchAll(/['"](\.{1,2}\/[^'"\s]+\.m?js)['"]/g)].map(([, m]) => visit(new URL(m, url).href))); };
    // and a style the page itself put in the registry (STYLES.kelmscott = ...): its module, already loaded
    const own = performance.getEntriesByType('resource').map(e => e.name.split('#')[0]).filter(u => /\/kit\/styles\/[^/]+\.m?js$/.test(u));
    await Promise.all([new URL(entry).href, ...own].map(visit));
    // a face by its validators (no need to download it again); its bytes where the server gives none
    const fh = await Promise.all([...fonts].sort().map(async f => { try { const r = await fetch(f, { method: 'HEAD' }), v = r.headers.get('etag') || (r.headers.get('last-modified') ?? '') + (r.headers.get('content-length') ?? '');
      if (r.ok && v) return f + v; const b = await fetch(f); return f + (b.ok ? fnvBytes(new Uint8Array(await b.arrayBuffer())) : 'missing'); } catch { return f + 'error'; } }));
    return hashText([...seen].sort().map(([u, h]) => u.replace(/^.*\/kit\//, '') + h).join('|') + fh.join('|'));
  })();
  hashes.set(entry, p); return p;
}

export function fingerprint(root, host) {
  const o = host.getBoundingClientRect(), tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rg = document.createRange(), q = v => Math.round(v * 4);
  let s = `${q(o.width)},${q(o.height)}|`;
  for (let n; (n = tw.nextNode());) { if (!n.data.trim()) continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) s += `${q(r.left - o.left)},${q(r.top - o.top)},${q(r.width)},${q(r.height)};`; }
  return hashText(s);
}

const open = () => new Promise((ok, no) => { const r = indexedDB.open('illum', 1); r.onupgradeneeded = () => r.result.createObjectStore('bake'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
let dbp = null; const db = () => dbp ??= open();
const tx = async (mode, f) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('bake', mode), q = f(t.objectStore('bake')); t.oncomplete = () => ok(q?.result); t.onerror = t.onabort = () => no(t.error); }); };

export async function lookup(key, lib, baked) {
  try { const r = await tx('readonly', s => s.get(key)); if (r && r.lib === await lib()) return r; } catch {}
  const b = await manifest(baked); if (!b) return null;
  try { const { url, m } = b, r = m[key]; if (!r || r.lib !== await lib()) return null;
    return { ...r, bands: await Promise.all(r.bands.map(async b => ({ y: b.y, blob: await (await fetch(new URL(b.src, url))).blob() }))) }; } catch { return null; }
}

// a bake's manifest, read once a page (and asked for early: rubricate asks as it starts, so a first visit does not wait for it)
const manifests = new Map();
export function manifest(baked) {
  if (!baked) return Promise.resolve(null); const url = new URL(baked, location.href).href;
  if (!manifests.has(url)) manifests.set(url, fetch(url).then(r => r.ok ? r.json() : null).then(m => m && { url: new URL(url), m }, () => null));
  return manifests.get(url);
}

export async function paint(rec, c, host) {
  c.width = rec.W; c.height = rec.H; Object.assign(c.style, { width: rec.w + 'px', height: rec.h + 'px' });
  const g = c.getContext('2d'), fold = (innerHeight - host.getBoundingClientRect().top) * rec.W / rec.w;
  const order = [...rec.bands].sort((a, b) => (a.y > fold) - (b.y > fold));
  const bms = order.map(b => createImageBitmap(b.blob));
  for (let i = 0; i < order.length; i++) { const bm = await bms[i]; g.drawImage(bm, 0, order[i].y); bm.close(); }
}

export async function remember(key, rec, c) {
  const bands = [];
  for (let y = 0; y < c.height; y += BAND) { const h = Math.min(BAND, c.height - y), b = new OffscreenCanvas(c.width, h), g = b.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, y, c.width, h, 0, 0, c.width, h);
    const a = g.getImageData(0, 0, c.width, h).data; let ink = false; for (let i = 3; i < a.length; i += 4) if (a[i]) { ink = true; break; }
    if (ink) bands.push({ y, blob: await b.convertToBlob({ type: 'image/png' }) }); }   // (a band with no ink is not kept)
  const full = { ...rec, W: c.width, H: c.height, bands, t: Date.now() };
  await tx('readwrite', s => s.put(full, key));
  // the store kept to the newest few
  await tx('readwrite', s => { const all = []; const q = s.openCursor(); q.onsuccess = () => { const cu = q.result; if (cu) { all.push([cu.value.t ?? 0, cu.key]); cu.continue(); }
    else all.sort((a, b) => b[0] - a[0]).slice(KEEP).forEach(([, k]) => s.delete(k)); }; return null; });
  return full;
}
