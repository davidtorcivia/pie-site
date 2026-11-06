// The translator's API (functions/api/[[path]].js, which forwards to the engine on erebus through its tunnel).
// One retry after a short wait when the connection drops or the tunnel answers 502-504, so a blip doesn't read as an
// outage; and the three ways it can fail are told apart, so a page bug is never reported as the server being down.
export async function api(path, text) {
  for (let k = 0; k < 2; k++) {
    let r = null;
    try { r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); } catch {}
    if (r && !(r.status >= 502 && r.status <= 504)) {
      let js = null; try { js = await r.json(); } catch {}
      if (r.ok && js && !js.error) return js;
      if (js?.error) throw { kind: 'engine' };
    }
    if (k === 0) await new Promise(res => setTimeout(res, 1500));
  }
  throw { kind: 'net' };
}

export function failText(e) {
  if (e?.kind === 'net') return 'The translator runs on the project’s machine and is not reachable right now. Try again in a minute.';
  if (e?.kind === 'engine') return 'The translator couldn’t make sense of that text.';
  console.error(e);
  return 'The translator answered, but this page couldn’t lay out the answer.';
}
