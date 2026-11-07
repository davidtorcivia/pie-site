"""The voices page's figures and clips, from one corpus line followed through every stage of the pipeline:
t2-fame-002, n̥sméy ń̥dʰgʷʰitom ḱléwos h₂yéwi dʰedʰh₁dʰí, "Place imperishable fame on us for a lifetime!"

Sources (tools/voices-src/, copied read-only from the corpus build on tr-desktop and rendered on the Mac's CPU):
  espeak.wav           the custom eSpeak-NG voice (pie.speak, backend espeak, tone)
  kokoro-stock.wav     stock Kokoro-82M, Hindi voice hm_omega (male, as the page defaults to), pitch-patched (pie.speak, backend kokoro)
  renders-*.wav/.json/.ges   VocalTractLab v10.1 render, its phone timings and gestural score
  eleven-*.wav         the speech-to-speech conversion of that render
  murmured-*.wav       after restore.py, retrill.py and murmur.py: the training audio
  kokoro-pie-*.wav     the fine-tuned Kokoro voices (tools/tts_server.py --say)

Writes audio/voices/*.mp3, art/voices/spec-*.webp (spectrograms on the page's paper) and data/voices-figs.json
(gestural score tiers, phones, F0, clip list, and the h/χ measures of this line before and after the repair).

    /Users/david/AI/PIE/tts/vc/.venv-eval/bin/python tools/build_voices_figures.py
"""
import hashlib
import json, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
SRC = SITE / "tools/voices-src"
OUT_A, OUT_S = SITE / "audio/voices", SITE / "art/voices"
OUT_A.mkdir(parents=True, exist_ok=True)
PAPER, INK = np.array([239, 231, 214]), np.array([14, 13, 11])
SR = 48000     # the clips: the recordings are 44.1 kHz; the PIE Kokoro clips are bandwidth-extended (pie-bwe-v1)
SR_SPEC = 24000   # the spectrograms are drawn from a 24 kHz copy, as before (they show 0-7 kHz)
PIE = "n̥sméy ń̥dʰgʷʰitom ḱléwos h₂yéwi dʰedʰh₁dʰí."
EN = "Place imperishable fame on us for a lifetime!"

CLIPS = [  # id, file, stage label
    ("espeak", "espeak.wav", "eSpeak-NG, custom PIE voice"),
    ("stock", "kokoro-stock.wav", "Kokoro-82M, stock Hindi voice"),
    ("vtl-m", "renders-JD3-PIE.wav", "VocalTractLab, male"),
    ("vtl-f", "renders-W02-PIE.wav", "VocalTractLab, female"),
    ("conv-m", "eleven-JD3-PIE.wav", "converted, male"),
    ("conv-f", "eleven-W02-PIE.wav", "converted, female"),
    ("final-m", "murmured-JD3-PIE.wav", "repaired, male"),
    ("final-f", "murmured-W02-PIE.wav", "repaired, female"),
    ("ours-m", "kokoro-pie-m-48k.wav", "PIE Kokoro, male"),
    ("ours-f", "kokoro-pie-f-48k.wav", "PIE Kokoro, female"),
]


def load(f):
    y, sr = librosa.load(SRC / f, sr=SR, mono=True)
    return y / max(1e-9, np.abs(y).max()) * 0.84      # -1.5 dBFS: headroom for the encoder


def mp3(y, path):
    tmp = path.with_suffix(".wav"); sf.write(tmp, y, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-codec:a", "libmp3lame", "-b:a", "160k", "-compression_level", "0", str(path)], check=True)
    tmp.unlink()


def spectrogram(y, path, pps=360, h=300, fmax=7000):
    """log-magnitude STFT, 0..fmax Hz, 70 dB range: ink whose opacity is the energy, so it sits on any paper"""
    y = librosa.resample(y, orig_sr=SR, target_sr=SR_SPEC)
    hop = int(SR_SPEC / pps); S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop, win_length=768))
    S = S[: int(fmax / (SR_SPEC / 1024))]
    db = librosa.amplitude_to_db(S, ref=np.max); v = np.clip((db + 70) / 70, 0, 1) ** 1.35
    rgba = np.zeros(v.shape + (4,), np.uint8); rgba[..., :3] = INK; rgba[..., 3] = (v * 255).astype(np.uint8)
    im = Image.fromarray(rgba[::-1], "RGBA").resize((S.shape[1], h), Image.LANCZOS)
    im.save(path, "WEBP", quality=88)
    return im.size


def share(y, t0, t1):
    """2-8 kHz share of the energy in [t0, t1] (the measure qc.py and restore.py gate h and χ on)"""
    seg = y[int(t0 * SR_SPEC): int(t1 * SR_SPEC)]          # measured on the 24 kHz copies, as published
    if len(seg) < 256:
        return None
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / SR_SPEC)
    return float(P[(f >= 2000) & (f <= 8000)].sum() / max(1e-12, P[f >= 60].sum()))


def gestures(path):
    tiers = {}
    for seq in ET.parse(path).getroot():
        t, out = 0.0, []
        for g in seq:
            d = float(g.get("duration_s")); v = g.get("value")
            out.append({"v": v, "s": round(t, 4), "e": round(t + d, 4), "n": g.get("neutral") == "1"})
            t += d
        tiers[seq.get("type").replace("-gestures", "")] = out
    return tiers


out = {"pie": PIE, "en": EN, "clips": [], "spec": {}}
def trim(y, lead=0.1, tail=0.15):
    """Kokoro pads its output with silence; cut it to a short lead and tail, so the comparison starts together"""
    env = np.convolve(np.abs(y), np.ones(240) / 240, "same")
    on = np.where(env > env.max() * 0.03)[0]
    return y if not len(on) else y[max(0, on[0] - int(lead * SR)): on[-1] + int(tail * SR)]


def onset(y):
    env = np.convolve(np.abs(y), np.ones(240) / 240, "same")
    on = np.where(env > env.max() * 0.03)[0]
    return on[0] / SR if len(on) else 0.0


# no clip starts with a gap. The male VocalTractLab chain (rendered, converted, repaired) shares one timing with the
# gestural score and the phone labels, so those clips lose one shared lead (LEAD) and every time in the figures moves
# by the same amount; every other clip is trimmed at its own onset.
LEAD = max(0.0, onset(load("renders-JD3-PIE.wav")) - 0.08)
CHAIN = {"vtl-m", "conv-m", "final-m"}
for cid, f, label in CLIPS:
    y = load(f)
    y = y[int(LEAD * SR):] if cid in CHAIN else trim(y, lead=0.08)
    mp3(y, OUT_A / f"fame-{cid}.mp3")
    w, h = spectrogram(y, OUT_S / f"spec-{cid}.webp")
    stamp = lambda p: hashlib.md5(p.read_bytes()).hexdigest()[:8]   # ?v=: audio and art are cached a day (_headers)
    out["clips"].append({"id": cid, "label": label, "audio": f"audio/voices/fame-{cid}.mp3?v={stamp(OUT_A / f'fame-{cid}.mp3')}",
                         "spec": f"art/voices/spec-{cid}.webp?v={stamp(OUT_S / f'spec-{cid}.webp')}",
                         "dur": round(len(y) / SR, 3), "w": w, "h": h})
    print(cid, round(len(y) / SR, 2), "s")
print("shared lead cut from the male chain:", round(LEAD, 3), "s")

ph = json.loads((SRC / "renders-JD3-PIE.json").read_text("utf-8"))
sh = lambda t: round(max(0.0, t - LEAD), 4)
out["words"] = [{"w": w["word"], "ipa": w["ipa"], "s": sh(w["start"]), "e": sh(w["end"]),
                 "phones": [{"p": p["phone"], "s": sh(p["start"]), "e": sh(p["end"]), "k": p["kind"]} for p in w["phones"]]}
                for w in ph["words"]]
out["duration"] = round(ph["duration"] - LEAD, 4)
out["ges"] = {tier: [{**g, "s": sh(g["s"]), "e": sh(g["e"])} for g in segs if g["e"] - LEAD > 0]
              for tier, segs in gestures(SRC / "renders-JD3-PIE.ges").items()}
# F0 of the VocalTractLab render, 10 ms frames, voiced only
load24 = lambda f: librosa.resample(load(f), orig_sr=SR, target_sr=SR_SPEC)   # the figure's measures stay on 24 kHz
y = load24("renders-JD3-PIE.wav")[int(LEAD * SR_SPEC):]
f0, vflag, _ = librosa.pyin(y, fmin=60, fmax=300, sr=SR_SPEC, frame_length=1024, hop_length=240)
out["f0"] = [[round(i * 0.01, 2), round(float(x), 1)] for i, (x, v) in enumerate(zip(f0, vflag)) if v and np.isfinite(x)]
# the laryngeals of this line through the conversion and the repair (male voice)
conv, fin = (load24(f)[int(LEAD * SR_SPEC):] for f in ("eleven-JD3-PIE.wav", "murmured-JD3-PIE.wav"))
lar = []
for w in ph["words"]:
    for p in w["phones"]:
        if p["phone"] in ("χ", "h"):
            lar.append({"word": w["word"], "phone": p["phone"], "vtl": share(y, sh(p["start"]), sh(p["end"])),
                        "converted": share(conv, sh(p["start"]), sh(p["end"])), "repaired": share(fin, sh(p["start"]), sh(p["end"]))})
out["laryngeals"] = lar
print(json.dumps(lar, ensure_ascii=False))
(SITE / "data/voices-figs.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), "utf-8")
print("figures written")
