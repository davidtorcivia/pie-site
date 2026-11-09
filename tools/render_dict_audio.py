"""Spoken headwords for the dictionary, in both of the project's Kokoro PIE voices (pie_m, pie_f; see
tools/render_hymn_kokoro.py for the model and why its own model code is used).

Each word is said as a citation form, inside a carrier: "nu. WORD. nu." (each its own sentence, so the word still falls
as a word said alone) and cut out of it in the middle of the pauses either side. Said alone, the model adds a stray
vowel before or after a short word and holds stop closures for half a second; mid-phrase it does neither (2026-11-06
test on the 30 worst words: stray sounds 15 -> 0 of 60 clips, silences over 300 ms 16 -> 0). The corpus v2 voices
(kokoro-final-v3) hold far fewer long closures said alone (tools/dict_alone_test.py, 300 random words: silences over
300 ms 132/64 -> 11/2, male/female) but not none, so the carrier stays. Every clip is set to the
same speech loudness (-18 dBFS RMS over its voiced frames) with its peak held under -3 dBFS, carried as 32-bit float
to the encoder (LAME, highest quality, 96 kbps CBR at the model's own 24 kHz), so nothing clips after decoding. The clips are packed one file per detail shard and voice (audio/dict/NN-<m|f>.mp3), so the whole
dictionary stays 128 files on Cloudflare; data/dict/audio/NN.json gives each entry's start and length in its shard's
file, and data/dict/audio/index.json lists the shards that have audio.

Two halves, so the renderer needs neither the PIE repo nor the site:
  labels  (Mac, the PIE repo's pronunciation):  <PIE python> tools/render_dict_audio.py labels [--demo] -o labels.json
  render  (any machine with the model):         <kokoro python> tools/render_dict_audio.py render labels.json -o OUT
                                                    [--device cuda] [--kokoro DIR] [--kikiri DIR]
OUT gets audio/dict/*.mp3 and data/dict/audio/*.json, laid out as in the site. The full set was rendered on tr-desktop's
GPU (WSL, ~/kokoro-ft); the 46-word demo on the Mac's CPU.
"""
import argparse, time, json, re, subprocess, sys, types, zlib
from collections import defaultdict
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("mode", choices=["labels", "render"]); ap.add_argument("labels", nargs="?")
ap.add_argument("-o", "--out", required=True); ap.add_argument("--demo", action="store_true")
ap.add_argument("--device", default="cpu"); ap.add_argument("--pie", default="/Users/david/AI/PIE")
ap.add_argument("--kokoro", default="/Users/david/AI/pie-runs/tts/kokoro-final-v3"); ap.add_argument("--kikiri", default="/Users/david/AI/pie-runs/tts/kikiri")
ap.add_argument("--kbps", default="96k")
ap.add_argument("--part", default="0/1", help="i/n: render only the shards whose number is i mod n (n processes in parallel on one GPU)")
ap.add_argument("--mem-frac", type=float, default=0.25, help="this process's share of the GPU's memory")
ap.add_argument("--alone", action="store_true", help="say each word alone, as before 2026-11-06 (no carrier)")
ap.add_argument("--rms", type=float, default=-18.0, help="speech loudness, dBFS RMS over the voiced frames")
ap.add_argument("--peak", type=float, default=-3.0, help="sample-peak ceiling, dBFS")
ap.add_argument("--bwe", help="folder of the voices' own bandwidth extension (pie-bwe-v1: bwe_common.py, g_pie_24kto48k): "
                "each clip is taken from 24 to 48 kHz, its 12-16 kHz restored from the voices' 44.1 kHz recordings")
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
if a.bwe:   # before the Kokoro code: AP-BWE's own modules (env, datasets, models) must win those names
    sys.path.insert(0, a.bwe)
    from bwe_common import load_model as bwe_load, apply as bwe_apply, up48  # noqa: E402
_pkg = types.ModuleType("kokoro"); _pkg.__path__ = [a.kikiri]; sys.modules["kokoro"] = _pkg
try:
    import loguru  # noqa: F401  (the model code logs through it; a quiet stand-in where it is not installed)
except ImportError:
    _lg = types.ModuleType("loguru"); _lg.logger = types.SimpleNamespace(**{k: (lambda *x, **y: None) for k in ("debug", "info", "warning", "error")}); sys.modules["loguru"] = _lg
from kokoro.model import KModel  # noqa: E402

K, OUT = Path(a.kokoro), Path(a.out)
SR, GAP = 24000, 0.3
SR_OUT = 48000 if a.bwe else SR
torch.set_num_threads(4)
if a.device.startswith("cuda"):
    torch.cuda.set_per_process_memory_fraction(a.mem_frac, 0)            # all processes together stay under the owner's 0.82
model = KModel(config=str(K / "config.json"), model=str(sorted(K.glob("kokoro_pie_*.pth"))[-1])).eval().to(a.device)
packs = {n: torch.load(K / f"voices/pie_{n}.pt", weights_only=True).to(a.device) for n in ("m", "f")}
if a.bwe:
    BWE = bwe_load(str(Path(a.bwe) / "g_pie_24kto48k"), a.device)
labels = json.loads(Path(a.labels).read_text("utf-8"))


ids = lambda text: [model.vocab[c] for c in text if c in model.vocab]
PRE, POST = ids("nu. "), ids(" nu.")
F10 = SR // 100                                                          # 10 ms frames
FLAGS = defaultdict(int)


def say(tokens, style):
    with torch.no_grad():
        wav, dur = model.forward_with_tokens(torch.LongTensor([[0, *tokens, 0]]).to(a.device), style, 1.0)
    return wav.float().cpu().numpy().ravel().astype(np.float64), dur.cpu().numpy().ravel()


def frames(y):
    n = len(y) // F10
    return np.abs(y[:n * F10].reshape(n, F10)).max(1)


def pause(sil, lo, hi):
    """the longest run of silent frames between frames lo and hi: (length, start, end)"""
    lo, hi = max(0, lo), min(len(sil), hi); best, i = (0, lo, lo), lo
    while i < hi:
        if sil[i]:
            j = i
            while j < hi and sil[j]:
                j += 1
            if j - i > best[0]:
                best = (j - i, i, j)
            i = j
        else:
            i += 1
    return best


def clip(label, voice):
    core = ids(label.rstrip("."))
    if not core:
        return None
    if a.alone:
        y, _ = say(ids(label), packs[voice][min(len(label), 509) - 1])
        e = frames(y); on = np.where(e > e.max() * 0.03)[0]
        y = y[max(0, on[0] * F10 - 1440): (on[-1] + 1) * F10 + 1440] if len(on) else y
    else:
        y, dur = say(PRE + core + ids(".") + POST, packs[voice][min(len("nu. " + label + " nu."), 509) - 1])
        cum = np.concatenate([[0], np.cumsum(dur)]) * 600                # a duration frame is 600 samples
        ws, we = cum[1 + len(PRE)] / F10, cum[1 + len(PRE) + len(core) + 1] / F10   # the word, and its full stop
        e = frames(y); sil = e < e.max() * 0.03
        n0, _, s1 = pause(sil, int(ws - 40), int(ws + 12))               # the pause after "nu.", the one before " nu."
        n1, e0, _ = pause(sil, int(we - 15), int(we + 40))
        if n0 < 4 or n1 < 4:                                             # no clear pause: cut on the model's own timings
            FLAGS["no pause"] += 1
            s1, e0 = int(ws) - 2, int(we) + 4
        y = y[max(0, s1 - 4) * F10: (e0 + 6) * F10]
        e = frames(y); on = np.where(e > e.max() * 0.03)[0]              # then down to the word itself: 50 ms before, 80 after
        if len(on):
            y = y[max(0, on[0] * F10 - 1200): (on[-1] + 1) * F10 + 1920]
    if len(y) < 960:
        return None
    # loudness: RMS over the voiced frames (those within 30 dB of the clip's loudest), then the peak ceiling
    e = frames(y); act = e > e.max() * 10 ** (-30 / 20)
    rms = np.sqrt(np.mean(np.concatenate([y[k * F10:(k + 1) * F10] for k in np.where(act)[0]]) ** 2))
    g = min(10 ** (a.rms / 20) / max(rms, 1e-9), 10 ** (a.peak / 20) / max(np.abs(y).max(), 1e-9))
    if g < 10 ** (a.rms / 20) / max(rms, 1e-9) - 1e-9:
        FLAGS["held by the peak ceiling"] += 1
    y = y * g
    n = 240; f = np.linspace(0, 1, n)                                     # 10 ms fades: no clicks at the cuts
    y[:n] *= f; y[-n:] *= f[::-1]
    if a.bwe:   # 24 -> 48 kHz, the band below 12 kHz kept as Kokoro made it; the peak ceiling checked again after
        y = np.asarray(bwe_apply(BWE[0], BWE[1], up48(y.astype(np.float32), SR), a.device, splice_hz=12000), dtype=np.float64)
        pk = np.abs(y).max()
        if pk > 10 ** (a.peak / 20):
            y *= 10 ** (a.peak / 20) / pk; FLAGS["held by the peak ceiling after bandwidth extension"] += 1
        n = 480; f = np.linspace(0, 1, n); y[:n] *= f; y[-n:] *= f[::-1]
    return y.astype(np.float32)


by = defaultdict(list)
for i in labels:
    by[zlib.crc32(i.encode()) % 64].append(i)
(OUT / "audio/dict").mkdir(parents=True, exist_ok=True); (OUT / "data/dict/audio").mkdir(parents=True, exist_ok=True)
total = 0
PART, NPART = map(int, a.part.split("/"))
for s, group in sorted(by.items()):
    if s % NPART != PART:
        continue
    if all((OUT / f).exists() for f in (f"data/dict/audio/{s:02d}.json", f"audio/dict/{s:02d}-m.mp3", f"audio/dict/{s:02d}-f.mp3")):
        print(f"shard {s:02d}: already rendered", flush=True); continue      # a resumed run skips finished shards
    offs = defaultdict(dict)
    for v in ("m", "f"):
        parts, t = [], 0.0
        for i in group:
            y = clip(labels[i], v)
            if y is None:
                continue
            offs[i][v] = [round(t, 3), round(len(y) / SR_OUT, 3)]
            parts += [y, np.zeros(int(SR_OUT * GAP), np.float32)]; t += len(y) / SR_OUT + GAP
        mp3 = OUT / f"audio/dict/{s:02d}-{v}.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR_OUT), "-ac", "1", "-i", "pipe:0",
                        "-codec:a", "libmp3lame", "-b:a", a.kbps, "-compression_level", "0", "-ar", str(SR_OUT), str(mp3)],
                       input=np.concatenate(parts).astype("<f4").tobytes(), check=True)
    (OUT / f"data/dict/audio/{s:02d}.json").write_text(json.dumps(offs, ensure_ascii=False, separators=(",", ":")))
    total += len(offs)
    print(f"shard {s:02d}: {len(offs)} words", flush=True)
(OUT / "data/dict/audio/index.json").write_text(json.dumps({"v": int(time.time()), "shards": sorted(by)}))   # v: js/dict.js cache-busts with it
print(total, "words in", len(by), "shards;", dict(FLAGS))
