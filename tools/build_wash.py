"""A watercolour wash for the map plate (map/wash.webp): soft washes by elevation, pigment pooled at the edges of each
wash (the dark rim a drying wash leaves), granulation in the low ground, blooms where washes meet, and a sea washed
in blue that darkens along the coast. Laid under the engraved relief when the page is opened with ?map=wc.

    <python with numpy, pillow, scipy> tools/build_wash.py
"""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bm", ROOT / "tools/build_map.py"); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
S = 2                                                          # work at half size, then upscale (washes are soft)
H, W = bm.elevation()[::S, ::S].shape
rng = np.random.default_rng(3)

def noise(scale, octaves=4):
    out = np.zeros((H, W), np.float32)
    for o in range(octaves):
        f = scale / 2 ** o
        g = rng.standard_normal((int(H / f) + 3, int(W / f) + 3)).astype(np.float32)
        out += nd.zoom(g, f, order=3)[:H, :W] / 2 ** o
    return (out - out.mean()) / (out.std() + 1e-6)

E = bm.elevation()[::S, ::S]
land = bm.mask_of("ne_50m_land")[::S, ::S] & ~bm.mask_of("ne_50m_lakes", lambda p: (p.get("scalerank") or 9) <= 4)[::S, ::S]
E = np.where(land, np.maximum(E, 0), 0)
paper = np.array([239, 231, 214], np.float32)
img = np.ones((H, W, 3), np.float32) * paper

def wash(mask_soft, color, strength, rim=0.35):
    """lay a transparent wash: multiply, with pigment pooled at its edge"""
    m = np.clip(mask_soft, 0, 1)
    edge = np.clip(m - nd.gaussian_filter(m, 3), 0, 1) * rim * 4      # the inner rim, darker
    a = np.clip(m * strength + edge, 0, 1)[..., None]
    c = np.array(color, np.float32) / 255
    global img
    img = img * (1 - a + a * c)

n1, n2, n3 = noise(60), noise(18), noise(5, 2)
# lowlands: a pale sap-green-ochre, granulating
low = land & (E < 400)
wash(nd.gaussian_filter(low.astype(np.float32), 2.5) * (0.75 + 0.25 * np.tanh(n1)), (196, 190, 128), 0.55)
wash((low * (n3 > 0.9)).astype(np.float32), (150, 140, 90), 0.25, rim=0)          # granulation
# the steppe belt: warm ochre, wider strokes
steppe = land & (E < 600)
lat = np.linspace(bm.LAT1, bm.LAT0, H)[:, None] * np.ones((1, W))
wash(nd.gaussian_filter((steppe & (lat > 44) & (lat < 54)).astype(np.float32), 6) * (0.6 + 0.4 * np.tanh(n1 + 1)), (214, 170, 90), 0.5)
# uplands and mountains: raw umber, then burnt sienna on the heights, bleeding up the slopes
for lo, col, st in [(400, (178, 140, 96), 0.45), (1200, (150, 96, 66), 0.5), (2600, (120, 70, 60), 0.55)]:
    m = nd.gaussian_filter((E > lo + 120 * n2).astype(np.float32), 3.5)
    wash(m * (0.7 + 0.3 * np.tanh(n1 * 1.3)), col, st)
# deserts: a dry pale wash
desert = land & (lat < 34) & (E < 1200)
wash(nd.gaussian_filter(desert.astype(np.float32), 8) * 0.8, (226, 196, 140), 0.45)
# the sea: blue, deeper away from the coast, darkest along it (pooling), with blooms
water = ~land
dist = nd.distance_transform_edt(water)
deep = np.clip(dist / 60, 0, 1)
sea = nd.gaussian_filter(water.astype(np.float32), 1.5)
wash(sea * (0.55 + 0.25 * deep + 0.12 * np.tanh(n1)), (88, 132, 168), 0.6, rim=0.6)
bloom = np.clip(nd.gaussian_filter((np.tanh(n2 * 2) > 0.85).astype(np.float32), 4) * water, 0, 1)
img = img * (1 - 0.12 * bloom[..., None]) + 0.12 * bloom[..., None] * paper
# paper texture, faint
img *= (0.97 + 0.03 * np.tanh(noise(1.5, 1)))[..., None]
out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((bm.W, bm.H), Image.LANCZOS)
(ROOT / "map").mkdir(exist_ok=True)
out.save(ROOT / "map/wash.webp", quality=80, method=6)
print("wash", (ROOT / "map/wash.webp").stat().st_size // 1024, "KB")
