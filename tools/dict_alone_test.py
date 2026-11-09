"""Does a speech model still need the dictionary's carrier phrase? Says a sample of headwords alone (the label as is,
"WORD.") and counts the two faults the carrier ("nu. WORD. nu.") was added for on 2026-11-06:
  stray     a separate sound before or after the word: an island of sound at the clip's edge, cut off from the word by
            80 ms or more of silence and shorter than 150 ms
  closure   a silence over 300 ms inside the word
Silence: 10 ms frames under 3 % of the clip's peak (render_dict_audio.py's own threshold).

    <kokoro python> tools/dict_alone_test.py LABELS.json MODEL_DIR [MODEL_DIR ...] [--n 300] [--seed 0]
"""
import argparse, json, random, sys, types
from pathlib import Path

import numpy as np
import torch

ap = argparse.ArgumentParser()
ap.add_argument("labels"); ap.add_argument("models", nargs="+")
ap.add_argument("--n", type=int, default=300); ap.add_argument("--seed", type=int, default=0)
ap.add_argument("--kikiri", default="/Users/david/AI/pie-runs/tts/kikiri")
a = ap.parse_args()
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = [a.kikiri]; sys.modules["kokoro"] = _pkg
try:
    import loguru  # noqa: F401
except ImportError:
    _lg = types.ModuleType("loguru"); _lg.logger = types.SimpleNamespace(**{k: (lambda *x, **y: None) for k in ("debug", "info", "warning", "error")}); sys.modules["loguru"] = _lg
from kokoro.model import KModel  # noqa: E402

torch.set_num_threads(8)
labels = json.loads(Path(a.labels).read_text("utf-8"))
keys = sorted(labels); random.Random(a.seed).shuffle(keys); keys = keys[:a.n]
F10 = 240


def islands(y):
    n = len(y) // F10
    e = np.abs(y[:n * F10].reshape(n, F10)).max(1)
    snd = e >= e.max() * 0.03
    runs, i = [], 0
    while i < n:
        j = i
        while j < n and snd[j] == snd[i]:
            j += 1
        runs.append((bool(snd[i]), i, j)); i = j
    return [r for r in runs if r[0]], runs


for md in a.models:
    K = Path(md)
    model = KModel(config=str(K / "config.json"), model=str(sorted(K.glob("kokoro_pie_*.pth"))[-1])).eval()
    for v in ("m", "f"):
        pack = torch.load(K / f"voices/pie_{v}.pt", weights_only=True)
        stray = closure = 0; bad = []
        for k in keys:
            lab = labels[k]
            ids = [model.vocab[c] for c in lab if c in model.vocab]
            with torch.no_grad():
                wav, _ = model.forward_with_tokens(torch.LongTensor([[0, *ids, 0]]), pack[min(len(lab), 509) - 1], 1.0)
            y = wav.float().numpy().ravel()
            isl, runs = islands(y)
            s = c = False
            if len(isl) > 1:
                first, second = isl[0], isl[1]; last, prev = isl[-1], isl[-2]
                if second[1] - first[2] >= 8 and first[2] - first[1] < 15: s = True
                if last[1] - prev[2] >= 8 and last[2] - last[1] < 15: s = True
                inner = [r for r in runs if not r[0] and r[1] > isl[0][1] and r[2] < isl[-1][2]]
                c = any(r[2] - r[1] > 30 for r in inner)
            stray += s; closure += c
            if s or c: bad.append(lab)
        print(f"{K.name:18s} {v}: {len(keys)} words said alone; stray sounds {stray}, closures over 300 ms {closure}; e.g. {bad[:6]}", flush=True)
