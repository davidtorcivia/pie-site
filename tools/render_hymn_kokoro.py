"""Render the Dawn hymn with the project's own Kokoro PIE voices (kokoro_pie_stage2_e10, voices pie_m / pie_f: trained
on VocalTractLab speech carried into natural voices by speech-to-speech conversion), on the CPU, with word timings
from the model's predicted durations. Output: audio/dawn-<m|f>.mp3 and data/hymn-timing.json.

    /Users/david/AI/PIE/.venv-kokoro/bin/python tools/render_hymn_kokoro.py
"""
import json, subprocess, sys
from pathlib import Path
import wave
import numpy as np, torch
sys.path.insert(0, "/Users/david/AI/PIE")
from pie.tts_data import text_label
from kokoro.model import KModel

SITE = Path(__file__).resolve().parents[1]
K = Path("/Users/david/AI/pie-runs/tts/kokoro-final")
torch.set_num_threads(4)
model = KModel(config=str(K / "config.json"), model=str(K / "kokoro_pie_stage2_e10.pth")).eval()
hymn = json.loads((SITE / "data/site.json").read_text())["hymn"]
lines = {}
for w in hymn["words"]:
    lines.setdefault(w["line"], []).append(w["word"])
SR, FPS, GAP = 24000, 40, 0.42                       # Kokoro: a duration frame is 600 samples (40 a second)
out = {}
for name in ("m", "f"):
    pack = torch.load(K / f"voices/pie_{name}.pt", weights_only=True)
    audio, words, t = [], [], 0.0
    for ln in sorted(lines):
        text = " ".join(lines[ln])
        label = text_label(text)
        ids = [model.vocab[c] for c in label if c in model.vocab]
        ref = pack[len(ids) - 1]
        with torch.no_grad():
            wav, dur = model.forward_with_tokens(torch.LongTensor([[0, *ids, 0]]), ref, 1.0)
        dur = dur.cpu().numpy().ravel()[1:-1]           # per symbol, without the pads
        # word boundaries: count each word's symbols in the label (words are separated by one space symbol)
        pos, k = 0, 0
        for wd in label.split(" "):
            n = sum(1 for c in wd if c in model.vocab)
            s0 = t + dur[:pos].sum() / FPS
            s1 = t + dur[:pos + n].sum() / FPS
            words.append({"line": ln, "word": lines[ln][k], "start": round(float(s0), 3), "end": round(float(s1), 3)})
            pos += n + (1 if " " in model.vocab else 0); k += 1
        a = wav.cpu().numpy().ravel()
        audio.append(a); audio.append(np.zeros(int(SR * GAP), np.float32))
        t += len(a) / SR + GAP
    y = np.concatenate(audio); y = y / max(1e-9, np.abs(y).max()) * 0.89
    wavp = SITE / f"audio/dawn-{name}.wav"
    with wave.open(str(wavp), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((y * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wavp), "-codec:a", "libmp3lame", "-b:a", "160k", str(SITE / f"audio/dawn-{name}.mp3")], check=True)
    wavp.unlink()
    out[name] = words
    print(name, f"{t:.1f} s", len(words), "words")
(SITE / "data/hymn-timing.json").write_text(json.dumps(out, ensure_ascii=False))
