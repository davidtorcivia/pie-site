"""QA of the dictionary's spoken headwords: every clip in every shard, both voices, cut out of its shard by the offsets
in data/dict/audio/NN.json. A clip is flagged when
  island    a separate sound sits at its start or end, cut off from the word by 150 ms or more of silence (the carrier's
            "nu" kept by mistake, or a stray sound): silence = 10 ms frames under 3 % of the clip's peak
  ratio     its length differs from the other voice's clip of the same word by more than 1.6 times
    python3 tools/dict_audio_qa.py [--site DIR] [--out flags.json]
Prints counts and writes the flagged entries (id, voice, reason, lengths) to --out.
"""
import argparse, glob, json, subprocess
from pathlib import Path

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--site", default=str(Path(__file__).resolve().parents[1]))
ap.add_argument("--out", default="dict-audio-flags.json")
ap.add_argument("--gap", type=float, default=0.15)
a = ap.parse_args()
S = Path(a.site)
SR, F = 48000, 480


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4")


def islands(y):
    n = len(y) // F
    if n < 3:
        return []
    e = np.abs(y[:n * F].reshape(n, F)).max(1)
    snd = e >= e.max() * 0.03
    runs, i = [], 0
    while i < n:
        j = i
        while j < n and snd[j] == snd[i]:
            j += 1
        if snd[i]:
            runs.append((i, j))
        i = j
    return runs


flags, n, gapf = [], 0, int(a.gap * SR / F)
lens = {}
for js in sorted(glob.glob(str(S / "data/dict/audio/[0-9][0-9].json"))):
    sh = Path(js).stem; offs = json.load(open(js))
    for v in ("m", "f"):
        y = decode(S / f"audio/dict/{sh}-{v}.mp3")
        for i, o in offs.items():
            if v not in o:
                continue
            t0, d = o[v]; c = y[int(t0 * SR): int((t0 + d) * SR)]; n += 1
            lens.setdefault(i, {})[v] = d
            isl = islands(c)
            if len(isl) > 1:
                gaps = [isl[k + 1][0] - isl[k][1] for k in range(len(isl) - 1)]
                if gaps[0] >= gapf or gaps[-1] >= gapf:
                    where = "end" if gaps[-1] >= gapf else "start"
                    flags.append({"id": i, "voice": v, "reason": f"island at the {where}", "len": round(d, 2),
                                  "islands": [[round(s * F / SR, 2), round(e * F / SR, 2)] for s, e in isl]})
for i, l in lens.items():
    if "m" in l and "f" in l and max(l["m"], l["f"]) / min(l["m"], l["f"]) > 1.6:
        flags.append({"id": i, "voice": "m" if l["m"] > l["f"] else "f", "reason": "length ratio", "len": l})
by = {}
for f in flags:
    by[(f["reason"].split(" at")[0], f["voice"])] = by.get((f["reason"].split(" at")[0], f["voice"]), 0) + 1
print(n, "clips;", len(flags), "flags:", {f"{k[0]} {k[1]}": c for k, c in sorted(by.items())})
print("ids flagged:", len({f["id"] for f in flags}))
json.dump(flags, open(a.out, "w"), ensure_ascii=False, indent=0)
