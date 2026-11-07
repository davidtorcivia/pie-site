"""Encode bandwidth-extended readings (48 kHz float WAVs from pie-bwe-v1's bwe_apply.py, run on tools/render_hymn_kokoro.py's
PIE_WAV_OUT files) into the site's audio/<name>.mp3, and bump their ?v= stamps in data/site.json so browsers refetch.
Checks each against its 24 kHz source: same length, no shift (the band below 12 kHz is the source's own), peak held
under -2 dBFS, LAME q0 at 192 kbps.
    python3 tools/encode_48k.py DIR_48K DIR_24K"""
import json, re, subprocess, sys, time, wave
from pathlib import Path
import numpy as np

SITE = Path(__file__).resolve().parents[1]
d48, d24 = Path(sys.argv[1]), Path(sys.argv[2])
CEIL = 10 ** (-2 / 20)
def read(p, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)
stamp = int(time.time()); done = []
for p in sorted(d48.glob("*.wav")):
    y, src = read(p, 48000), read(d24 / p.name, 48000)
    assert abs(len(y) - len(src)) <= 48, (p.name, len(y), len(src))
    n = min(len(y), len(src)); a, b = y[:n], src[:n]
    # no shift: the cross-correlation of the two peaks at lag 0 (checked over +-5 ms)
    lags = range(-240, 241, 8); c = [np.dot(a[max(0, k):n + min(0, k)], b[max(0, -k):n - max(0, k)]) for k in lags]
    assert list(lags)[int(np.argmax(c))] == 0, (p.name, "shifted")
    pk = np.abs(y).max()
    if pk > CEIL: y = y * CEIL / pk
    out = SITE / "audio" / p.with_suffix(".mp3").name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame",
                    "-b:a", "192k", "-compression_level", "0", "-ar", "48000", str(out)], input=y.astype("<f4").tobytes(), check=True)
    done.append(out.name); print(out.name, "peak %.1f dBFS" % (20 * np.log10(min(pk, CEIL))))
site = SITE / "data/site.json"; s = site.read_text("utf-8")
for name in done:
    s = re.sub(r'("audio/%s)\?v=\d+"' % re.escape(name), r'\1?v=%d"' % stamp, s)
site.write_text(s, "utf-8"); print(len(done), "encoded; stamps ->", stamp)
