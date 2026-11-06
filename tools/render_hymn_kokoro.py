"""Render the Dawn hymn with the project's own Kokoro PIE voices (kokoro_pie_stage2_e10, voices pie_m / pie_f: trained
on VocalTractLab speech carried into natural voices by speech-to-speech conversion), on the CPU, with word timings
from the model's predicted durations. Output: audio/dawn-<m|f>.mp3 + data/hymn-timing.json, and a reading of each corpus leaf: audio/text-<i>-<m|f>.mp3 +
data/texts-timing.json.

    /Users/david/AI/PIE/.venv-kokoro/bin/python tools/render_hymn_kokoro.py
"""
import json, os, subprocess, sys
from pathlib import Path
import wave
import numpy as np, torch
sys.path.insert(0, "/Users/david/AI/PIE")
from pie.tts_data import text_label
# the fine-tune's own copy of Kokoro's model code (kikiri-tts/kokoro/kokoro, fetched to pie-runs/tts/kikiri): it builds
# the network with torch's parametrizations.weight_norm, whose keys the checkpoint has. The pip package uses the old
# weight_norm and loads non-strictly, silently dropping the decoder's weights (the result is static).
import types
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = ["/Users/david/AI/pie-runs/tts/kikiri"]
sys.modules["kokoro"] = _pkg
from kokoro.model import KModel

SITE = Path(__file__).resolve().parents[1]
K = Path(os.environ.get("PIE_KOKORO", "/Users/david/AI/pie-runs/tts/kokoro-final"))   # model folder: config.json, kokoro_pie_*.pth, voices/
torch.set_num_threads(4)
model = KModel(config=str(K / "config.json"), model=str(sorted(K.glob("kokoro_pie_*.pth"))[-1])).eval()
data = json.loads((SITE / "data/site.json").read_text())
SR, FPS, GAP = 24000, 40, 0.42                       # Kokoro: a duration frame is 600 samples (40 a second)
packs = {n: torch.load(K / f"voices/pie_{n}.pt", weights_only=True) for n in ("m", "f")}


def render(lines, name, out_mp3):
    """lines: list of word lists; returns per-word timings, writes the mp3"""
    pack, audio, words, t = packs[name], [], [], 0.0
    for ln, ws in enumerate(lines, 1):
        label = text_label(" ".join(ws))
        ids = [model.vocab[c] for c in label if c in model.vocab]
        ref = pack[min(len(label), 509) - 1]
        with torch.no_grad():
            wav, dur = model.forward_with_tokens(torch.LongTensor([[0, *ids, 0]]), ref, 1.0)
        full = dur.cpu().numpy().ravel()
        lead = full[0] / FPS                      # the model's silence before the first sound (the start pad): part of the audio
        dur = full[1:-1]
        pos = 0
        for k, wd in enumerate(label.split(" ")):
            n = sum(1 for c in wd if c in model.vocab)
            words.append({"line": ln, "word": ws[k] if k < len(ws) else wd, "start": round(float(t + lead + dur[:pos].sum() / FPS), 3), "end": round(float(t + lead + dur[:pos + n].sum() / FPS), 3)})
            pos += n + 1
        a = wav.cpu().numpy().ravel()
        audio.append(a); audio.append(np.zeros(int(SR * GAP), np.float32))
        t += len(a) / SR + GAP
    y = np.concatenate(audio); y = y / max(1e-9, np.abs(y).max()) * 0.89
    wavp = out_mp3.with_suffix(".wav")
    with wave.open(str(wavp), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((y * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wavp), "-codec:a", "libmp3lame", "-b:a", "160k", str(out_mp3)], check=True)
    wavp.unlink()
    return words


import re
hymn = data["hymn"]; lines = {}
for w in hymn["words"]:
    lines.setdefault(w["line"], []).append(w["word"])
hymn_lines = [lines[k] for k in sorted(lines)]
if "--texts-only" not in sys.argv:
    out = {n: render(hymn_lines, n, SITE / f"audio/dawn-{n}.mp3") for n in ("m", "f")}
    (SITE / "data/hymn-timing.json").write_text(json.dumps(out, ensure_ascii=False))
    print("hymn done")
texts = {}
for i, sp in enumerate(data["specimens"]):
    sents = [x.strip() for x in re.findall(r"[^.!?]+[.!?]+", sp["pie"])] or [sp["pie"]]
    tl = [s.split() for s in sents]
    texts[sp["id"]] = {n: render(tl, n, SITE / f"audio/text-{i}-{n}.mp3") for n in ("m", "f")}
    print(sp["id"], "done")
(SITE / "data/texts-timing.json").write_text(json.dumps(texts, ensure_ascii=False))
