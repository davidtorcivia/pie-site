"""Spoken headwords for the dictionary, in both of the project's Kokoro PIE voices (pie_m, pie_f; see
tools/render_hymn_kokoro.py for the model and why its own model code is used).

Each word is said as a citation form (the headword with a closing full stop, so it falls as a word said alone), its
silence trimmed. The clips are packed one file per detail shard and voice (audio/dict/NN-<m|f>.mp3), so the whole
dictionary stays a few hundred files on Cloudflare; data/dict/audio/NN.json gives each entry's start and length in its
shard's file, and data/dict/audio/index.json lists the shards that have audio.

    /Users/david/AI/PIE/.venv-kokoro/bin/python tools/render_dict_audio.py --demo        # 50 common words
    <python> tools/render_dict_audio.py --all [--device cuda]                              # every entry (tr-desktop)
"""
import argparse, json, re, subprocess, sys, types, wave, zlib
from collections import defaultdict
from pathlib import Path
import numpy as np, torch

ap = argparse.ArgumentParser()
ap.add_argument("--demo", action="store_true"); ap.add_argument("--all", action="store_true")
ap.add_argument("--device", default="cpu"); ap.add_argument("--pie", default="/Users/david/AI/PIE")
ap.add_argument("--kokoro", default="/Users/david/AI/pie-runs/tts/kokoro-final"); ap.add_argument("--kikiri", default="/Users/david/AI/pie-runs/tts/kikiri")
a = ap.parse_args()
sys.path.insert(0, a.pie)
from pie.tts_data import text_label  # noqa: E402
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = [a.kikiri]; sys.modules["kokoro"] = _pkg
from kokoro.model import KModel  # noqa: E402

SITE = Path(__file__).resolve().parents[1]
K = Path(a.kokoro)
SR, GAP = 24000, 0.3
torch.set_num_threads(4)
model = KModel(config=str(K / "config.json"), model=str(K / "kokoro_pie_stage2_e10.pth")).eval().to(a.device)
packs = {n: torch.load(K / f"voices/pie_{n}.pt", weights_only=True).to(a.device) for n in ("m", "f")}

ix = json.loads((SITE / "data/dict/index.json").read_text("utf-8"))
WHEELS = ["pie-lex-ph2texr", "pie-lex-h1ekjwos", "pie-lex-h2owis", "pie-lex-meh2texr", "pie-lex-dyexws", "pie-lex-wlkwos",
          "pie-lex-kjwox", "pie-lex-h2stexr", "pie-lex-nokwts", "pie-lex-dwoh1", "pie-lex-h2ewsxos", "pie-lex-dhugh2texr"]
speakable = [r for r in ix if r[3] != "A"]
if a.all:
    ids = [r[0] for r in speakable]
else:
    have = {r[0] for r in speakable}
    top = [r[0] for r in sorted(speakable, key=lambda r: -r[7])[:42]]
    ids = list(dict.fromkeys([i for i in WHEELS if i in have] + top))[:50]
form = {r[0]: r[1] for r in ix}


def said(f):
    """the form as spoken: the first of alternatives, optional sounds and hyphens dropped"""
    f = re.split(r"\s*[:~,/]\s*|\s+or\s+", f)[0]
    f = re.sub(r"\([^)]*\)", "", f).strip("*- ")
    return f


def clip(word, voice):
    label = text_label(word + ".")
    ids_ = [model.vocab[c] for c in label if c in model.vocab]
    if not ids_:
        return None
    with torch.no_grad():
        wav, _ = model.forward_with_tokens(torch.LongTensor([[0, *ids_, 0]]).to(a.device), packs[voice][min(len(label), 509) - 1], 1.0)
    y = wav.cpu().numpy().ravel().astype(np.float32)
    env = np.convolve(np.abs(y), np.ones(240) / 240, "same")              # trim the silence either side, keep 60 ms
    on = np.where(env > env.max() * 0.03)[0]
    if len(on):
        y = y[max(0, on[0] - 1440): on[-1] + 1440]
    fade = np.linspace(0, 1, 240, dtype=np.float32)
    y[:240] *= fade; y[-240:] *= fade[::-1]
    return y / max(1e-9, np.abs(y).max()) * 0.89


by = defaultdict(list)
for i in ids:
    by[zlib.crc32(i.encode()) % 64].append(i)
(SITE / "audio/dict").mkdir(parents=True, exist_ok=True); (SITE / "data/dict/audio").mkdir(parents=True, exist_ok=True)
done = set(json.loads((SITE / "data/dict/audio/index.json").read_text()) if (SITE / "data/dict/audio/index.json").exists() and not a.all else [])
for s, group in sorted(by.items()):
    offs = defaultdict(dict)
    for v in ("m", "f"):
        parts, t = [], 0.0
        for i in group:
            y = clip(said(form[i]), v)
            if y is None:
                continue
            offs[i][v] = [round(t, 3), round(len(y) / SR, 3)]
            parts += [y, np.zeros(int(SR * GAP), np.float32)]; t += len(y) / SR + GAP
        wavp = SITE / f"audio/dict/{s:02d}-{v}.wav"
        with wave.open(str(wavp), "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((np.concatenate(parts) * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wavp), "-codec:a", "libmp3lame", "-b:a", "64k", str(wavp.with_suffix(".mp3"))], check=True)
        wavp.unlink()
    (SITE / f"data/dict/audio/{s:02d}.json").write_text(json.dumps(offs, ensure_ascii=False, separators=(",", ":")))
    done.add(s)
    print(f"shard {s:02d}: {len(group)} words")
(SITE / "data/dict/audio/index.json").write_text(json.dumps(sorted(done)))
print(len(ids), "words in", len(by), "shards")
