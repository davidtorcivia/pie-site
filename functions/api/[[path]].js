// Cloudflare Pages Function: translator and live TTS APIs on the site's own origin. The engines run on erebus
// (/nvme-mirror/apps/wekwos/translator, docker compose) behind a Cloudflare tunnel at api.wekwos.com;
// this forwards only the endpoints the site uses and nothing else.
const UPSTREAM = 'https://api.wekwos.com/api/';
const POST_ROUTES = new Set(['en2pie', 'pie2en', 'tts']);

export async function onRequestPost({ request, params }) {
  const route = (params.path || []).join('/');
  if (!POST_ROUTES.has(route)) return new Response('not found', { status: 404 });
  const body = await request.text();
  if (body.length > 8000) return new Response(JSON.stringify({ error: 'text too long' }), { status: 413, headers: { 'Content-Type': 'application/json' } });
  try {
    const r = await fetch(UPSTREAM + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(60000) });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: route === 'tts' ? 'tts unreachable' : 'translator unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestGet({ params }) {
  const route = (params.path || []).join('/');
  if (route === 'tts/health') {
    try {
      const r = await fetch(UPSTREAM + route, { signal: AbortSignal.timeout(2500) });
      if (r.ok) return new Response(r.body, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
    } catch {}
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  return new Response('POST only', { status: 405 });
}
