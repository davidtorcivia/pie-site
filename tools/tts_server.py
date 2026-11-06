"""The PIE voices, live: a small HTTP server that speaks PIE text in the project's own Kokoro voices (pie_m, pie_f),
on the CPU. The voices page (voices.html) uses it for its live section, through tools/serve.py's /api/tts route.

    /Users/david/AI/PIE/.venv-kokoro/bin/python tools/tts_server.py [--port 8766]
    <same python> tools/tts_server.py --say "h₂ówis h₁éḱwōs-kʷe" out.wav [--voice m|f]     (one render, no server)

POST /tts      {"text": "<PIE, or its ASCII form: h2o/wis>", "voice": "m"|"f"}  ->  {"ipa", "label", "audio": "<base64 mp3>", "words": [{word, start, end}]}
GET  /health   ->  {"ok": true, "voices": ["m", "f"]}

The text goes through the same path as the training labels: pie.tts_data.text_label (pie.ipa.to_ipa per word, the
Kokoro label convention), so the model hears exactly the alphabet it was trained on. The model code is the fine-tune's
own copy (see tools/render_hymn_kokoro.py for why the pip package's is not used). CPU only, by design: it never
touches the GPU, so it can run beside training or evaluation.
"""
import argparse, base64, http.server, io, json, re, socketserver, subprocess, sys, types, unicodedata, wave
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8766); ap.add_argument("--host", default="127.0.0.1")
ap.add_argument("--say", nargs=2, metavar=("TEXT", "OUT")); ap.add_argument("--voice", default="m")
ap.add_argument("--pie", default="/Users/david/AI/PIE"); ap.add_argument("--kokoro", default="/Users/david/AI/pie-runs/tts/kokoro-final")
ap.add_argument("--kikiri", default="/Users/david/AI/pie-runs/tts/kikiri")
a = ap.parse_args()

import numpy as np, torch  # noqa: E402
sys.path.insert(0, a.pie)
from pie.tts_data import text_label  # noqa: E402
from pie.ipa import to_ipa  # noqa: E402
from pie.translit import to_unicode  # noqa: E402
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = [a.kikiri]; sys.modules["kokoro"] = _pkg
from kokoro.model import KModel  # noqa: E402

torch.set_num_threads(4)
K = Path(a.kokoro)
DEV = "cpu"
model = KModel(config=str(K / "config.json"), model=str(K / "kokoro_pie_stage2_e10.pth")).eval().to(DEV)
packs = {n: torch.load(K / f"voices/pie_{n}.pt", weights_only=True, map_location=DEV) for n in ("m", "f")}
SR, FPS, GAP, MAXCH = 24000, 40, 0.38, 360


def synth(text: str, voice: str):
    """PIE text -> (float32 audio, label, ipa, word timings). Sentences are spoken one by one."""
    text = unicodedata.normalize("NFC", text.strip())[:MAXCH]
    if re.search(r"[123/':]", text) and not re.search(r"[₁₂₃ʰʷ́]", text):
        text = to_unicode(text)                  # typed on a keyboard: h2o/wis h1e/k'wo:s -> h₂ówis h₁éḱwōs
    sents = [s.strip() for s in re.findall(r"[^.!?;]+[.!?;]*", text) if s.strip()] or [text]
    audio, words, labels, t = [], [], [], 0.0
    for s in sents:
        label = text_label(s)
        if not label.strip():
            continue
        labels.append(label)
        ids = [model.vocab[c] for c in label if c in model.vocab]
        with torch.no_grad():
            wav, dur = model.forward_with_tokens(torch.LongTensor([[0, *ids, 0]]), packs[voice][min(len(label), 509) - 1], 1.0)
        full = dur.cpu().numpy().ravel(); lead = full[0] / FPS; d = full[1:-1]; pos = 0
        toks = s.split()
        for k, w in enumerate(label.split(" ")):
            n = sum(1 for c in w if c in model.vocab)
            words.append({"word": toks[k] if k < len(toks) else w, "start": round(float(t + lead + d[:pos].sum() / FPS), 3),
                          "end": round(float(t + lead + d[:pos + n].sum() / FPS), 3)})
            pos += n + 1
        y = wav.cpu().numpy().ravel().astype(np.float32)
        audio += [y, np.zeros(int(SR * GAP), np.float32)]; t += len(y) / SR + GAP
    if not audio:
        raise ValueError("nothing to say")
    y = np.concatenate(audio); y = y / max(1e-9, np.abs(y).max()) * 0.89
    ipa = " ".join(to_ipa(w.strip(".,;:!?\"“”")) for w in text.split() if w.strip(".,;:!?\"“”"))
    return y, " ".join(labels), ipa, words


def wav_bytes(y):
    b = io.BytesIO()
    with wave.open(b, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((y * 32767).astype(np.int16).tobytes())
    return b.getvalue()


def mp3_bytes(y):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "wav", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "pipe:1"],
                       input=wav_bytes(y), capture_output=True, check=True)
    return p.stdout


if a.say:
    y, label, ipa, _ = synth(a.say[0], a.voice)
    Path(a.say[1]).write_bytes(wav_bytes(y)); print(label); print(ipa); sys.exit()


class H(http.server.BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        out = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)

    def do_GET(self):
        if self.path.rstrip("/").endswith("/health"):
            return self._json({"ok": True, "voices": ["m", "f"]})
        self._json({"error": "not found"}, 404)

    def do_POST(self):
        try:
            req = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", "0")), 8000)) or b"{}")
            voice = "f" if req.get("voice") == "f" else "m"
            y, label, ipa, words = synth(str(req.get("text", "")), voice)
            self._json({"ipa": ipa, "label": label, "words": words, "audio": base64.b64encode(mp3_bytes(y)).decode()})
        except Exception as e:
            self._json({"error": str(e)[:300]}, 400)

    def log_message(self, *_):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


print(f"PIE voices on http://{a.host}:{a.port} (CPU)", flush=True)
Server((a.host, a.port), H).serve_forever()
