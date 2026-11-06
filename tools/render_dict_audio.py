"""Spoken headwords for the dictionary, in both of the project's Kokoro PIE voices (pie_m, pie_f; see
tools/render_hymn_kokoro.py for the model and why its own model code is used).

Each word is said as a citation form (the headword with a closing full stop, so it falls as a word said alone), its
silence trimmed. The clips are packed one file per detail shard and voice (audio/dict/NN-<m|f>.mp3), so the whole
dictionary stays 128 files on Cloudflare; data/dict/audio/NN.json gives each entry's start and length in its shard's
file, and data/dict/audio/index.json lists the shards that have audio.

Two halves, so the renderer needs neither the PIE repo nor the site:
  labels  (Mac, the PIE repo's pronunciation):  <PIE python> tools/render_dict_audio.py labels [--demo] -o labels.json
  render  (any machine with the model):         <kokoro python> tools/render_dict_audio.py render labels.json -o OUT
                                                    [--device cuda] [--kokoro DIR] [--kikiri DIR]
OUT gets audio/dict/*.mp3 and data/dict/audio/*.json, laid out as in the site. The full set was rendered on tr-desktop's
GPU (WSL, ~/kokoro-ft); the 46-word demo on the Mac's CPU.
"""
import argparse, time, json, re, subprocess, sys, types, wave, zlib
from collections import defaultdict
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("mode", choices=["labels", "render"]); ap.add_argument("labels", nargs="?")
ap.add_argument("-o", "--out", required=True); ap.add_argument("--demo", action="store_true")
ap.add_argument("--device", default="cpu"); ap.add_argument("--pie", default="/Users/david/AI/PIE")
ap.add_argument("--kokoro", default="/Users/david/AI/pie-runs/tts/kokoro-final"); ap.add_argument("--kikiri", default="/Users/david/AI/pie-runs/tts/kikiri")
ap.add_argument("--kbps", default="48k")
a = ap.parse_args()
SITE = Path(__file__).resolve().parents[1]
WHEELS = ["pie-lex-ph2texr", "pie-lex-h1ekjwos", "pie-lex-h2owis", "pie-lex-meh2texr", "pie-lex-dyexws", "pie-lex-wlkwos",
          "pie-lex-kjwox", "pie-lex-h2stexr", "pie-lex-nokwts", "pie-lex-dwoh1"]


def said(f):
    """the form as spoken: the first of alternatives, optional sounds and hyphens dropped"""
    f = re.split(r"\s*[:~,/]\s*|\s+or\s+", f)[0]
    return re.sub(r"\([^)]*\)", "", f).strip("*- ")


if a.mode == "labels":
    sys.path.insert(0, a.pie)
    from pie.tts_data import text_label
    ix = json.loads((SITE / "data/dict/index.json").read_text("utf-8"))
    speakable = [r for r in ix if r[3] != "A"]             # affixes are not words
    if a.demo:
        top = [r[0] for r in sorted(speakable, key=lambda r: -r[7])[:42]]
        keep = set(list(dict.fromkeys([i for i in WHEELS if i in {r[0] for r in speakable}] + top))[:50])
        speakable = [r for r in speakable if r[0] in keep]
    out, bad = {}, 0
    for r in speakable:
        w = said(r[1])
        try:
            lab = text_label(w + ".") if w else ""
        except Exception:
            lab = ""
        if lab.strip(". "):
            out[r[0]] = lab
        else:
            bad += 1
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False))
    print(len(out), "labels,", bad, "without a pronunciation")
    sys.exit()

# ---------------------------------------------------------------------------------------------------- render
import numpy as np, torch  # noqa: E402
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = [a.kikiri]; sys.modules["kokoro"] = _pkg
try:
    import loguru  # noqa: F401  (the model code logs through it; a quiet stand-in where it is not installed)
except ImportError:
    _lg = types.ModuleType("loguru"); _lg.logger = types.SimpleNamespace(**{k: (lambda *x, **y: None) for k in ("debug", "info", "warning", "error")}); sys.modules["loguru"] = _lg
from kokoro.model import KModel  # noqa: E402

K, OUT = Path(a.kokoro), Path(a.out)
SR, GAP = 24000, 0.3
torch.set_num_threads(4)
model = KModel(config=str(K / "config.json"), model=str(sorted(K.glob("kokoro_pie_*.pth"))[-1])).eval().to(a.device)
packs = {n: torch.load(K / f"voices/pie_{n}.pt", weights_only=True).to(a.device) for n in ("m", "f")}
labels = json.loads(Path(a.labels).read_text("utf-8"))


def clip(label, voice):
    ids_ = [model.vocab[c] for c in label if c in model.vocab]
    if not ids_:
        return None
    with torch.no_grad():
        wav, _ = model.forward_with_tokens(torch.LongTensor([[0, *ids_, 0]]).to(a.device), packs[voice][min(len(label), 509) - 1], 1.0)
    y = wav.float().cpu().numpy().ravel()
    env = np.convolve(np.abs(y), np.ones(240) / 240, "same")              # trim the silence either side, keep 60 ms
    on = np.where(env > env.max() * 0.03)[0]
    if len(on):
        y = y[max(0, on[0] - 1440): on[-1] + 1440].copy()
    if len(y) < 960:
        return None
    fade = np.linspace(0, 1, 240, dtype=np.float32)
    y[:240] *= fade; y[-240:] *= fade[::-1]
    return y / max(1e-9, np.abs(y).max()) * 0.89


by = defaultdict(list)
for i in labels:
    by[zlib.crc32(i.encode()) % 64].append(i)
(OUT / "audio/dict").mkdir(parents=True, exist_ok=True); (OUT / "data/dict/audio").mkdir(parents=True, exist_ok=True)
total = 0
for s, group in sorted(by.items()):
    if all((OUT / f).exists() for f in (f"data/dict/audio/{s:02d}.json", f"audio/dict/{s:02d}-m.mp3", f"audio/dict/{s:02d}-f.mp3")):
        print(f"shard {s:02d}: already rendered", flush=True); continue      # a resumed run skips finished shards
    offs = defaultdict(dict)
    for v in ("m", "f"):
        parts, t = [], 0.0
        for i in group:
            y = clip(labels[i], v)
            if y is None:
                continue
            offs[i][v] = [round(t, 3), round(len(y) / SR, 3)]
            parts += [y, np.zeros(int(SR * GAP), np.float32)]; t += len(y) / SR + GAP
        wavp = OUT / f"audio/dict/{s:02d}-{v}.wav"
        with wave.open(str(wavp), "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((np.concatenate(parts) * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wavp), "-codec:a", "libmp3lame", "-b:a", a.kbps, str(wavp.with_suffix(".mp3"))], check=True)
        wavp.unlink()
    (OUT / f"data/dict/audio/{s:02d}.json").write_text(json.dumps(offs, ensure_ascii=False, separators=(",", ":")))
    total += len(offs)
    print(f"shard {s:02d}: {len(offs)} words", flush=True)
(OUT / "data/dict/audio/index.json").write_text(json.dumps({"v": int(time.time()), "shards": sorted(by)}))   # v: js/dict.js cache-busts with it
print(total, "words in", len(by), "shards")
