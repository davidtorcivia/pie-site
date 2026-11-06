// Cloudflare Pages Function: the translator's API on the site's own origin. The engine runs on erebus
// (/nvme-mirror/apps/wekwos/translator, docker compose) behind its own Cloudflare tunnel at api.wekwos.com;
// this forwards the two endpoints the page uses and nothing else.
const UPSTREAM = 'https://api.wekwos.com/api/';
const ROUTES = new Set(['en2pie', 'pie2en']);

export async function onRequestPost({ request, params }) {
  const route = (params.path || []).join('/');
  if (!ROUTES.has(route)) return new Response('not found', { status: 404 });
  const body = await request.text();
  if (body.length > 8000) return new Response(JSON.stringify({ error: 'text too long' }), { status: 413, headers: { 'Content-Type': 'application/json' } });
  try {
    const r = await fetch(UPSTREAM + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(60000) });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'translator unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}

export const onRequestGet = () => new Response('POST only', { status: 405 });
