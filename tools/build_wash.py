"""A watercolour wash for the map plate (map/wash.webp), painted from the land itself:
- landscapes: deserts and mountain ranges from Natural Earth's geography regions; forest and steppe belts whose edges
  are warped by noise, never a straight line (temperate forest in the west, taiga in the north, the steppe between
  the forest and the deserts)
- elevation: a continuous hypsometric wash on smoothed relief (no thresholds, so the high ground is not blotchy),
  shaded by the slope's light from the north-west, with snow on the heights
- the sea: blue, deeper offshore, pigment pooled along the coast, with soft blooms
Every wash pools pigment at its own edge, as a drying wash does. Laid under the engraving with ?map=wc.

    <python with numpy, pillow, scipy> tools/build_wash.py
"""
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bm", ROOT / "tools/build_map.py")
bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
S = 2
E_full = bm.elevation()
H, W = E_full[::S, ::S].shape


def noise(scale, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    for o in range(octaves):
        f = scale / 2 ** o
        g = r.standard_normal((int(H / f) + 3, int(W / f) + 3)).astype(np.float32)
        out += nd.gaussian_filter(nd.zoom(g, f, order=3)[:H, :W], f * .35) / 2 ** o
    return (out - out.mean()) / (out.std() + 1e-6)


def regions(cla):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for f in json.loads((bm.DATA / "ne_50m_geography_regions_polys.geojson").read_text())["features"]:
        p = f["properties"]
        if (p.get("FEATURECLA") or p.get("featurecla")) != cla:
            continue
        g = f["geometry"]
        for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
            d.polygon([bm.proj(*c, 1 / S) for c in poly[0]], fill=255)
    return np.asarray(im) > 0


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


E = E_full[::S, ::S]
land = bm.mask_of("ne_50m_land")[::S, ::S] & ~bm.mask_of("ne_50m_lakes", lambda p: (p.get("scalerank") or 9) <= 4)[::S, ::S]
E = np.where(land, np.maximum(E, 0), 0)
Es = nd.gaussian_filter(E, 3)
lat = (bm.LAT1 - np.arange(H)[:, None] * S / bm.PX) * np.ones((1, W))
lon = (bm.LON0 + np.arange(W)[None, :] * S / (bm.K * bm.PX)) * np.ones((H, 1))
nA, nB, nC = noise(70, seed=1), noise(24, seed=2), noise(6, 2, seed=3)
lat_w = lat + 2.2 * nA + 0.6 * nB                               # latitude, warped: belts with wandering edges
lon_w = lon + 4.0 * noise(90, seed=4)

def strokes(n, seed, length=(5, 13), field_scale=50):
    """a field of short brush marks laid along a slowly turning direction: 0..1, 1 where the brush laid pigment"""
    r = np.random.default_rng(seed); ang = noise(field_scale, 2, seed=seed + 50) * 1.2 + .5
    im = Image.new("L", (W, H), 0); dr = ImageDraw.Draw(im)
    xs, ys = r.integers(0, W, n), r.integers(0, H, n)
    for x, y in zip(xs, ys):
        a, L = ang[y, x] + r.normal(0, .25), r.uniform(*length)
        dr.line([(x, y), (x + np.cos(a) * L, y + np.sin(a) * L)], fill=int(r.uniform(90, 255)), width=int(r.integers(1, 4)))
    return nd.gaussian_filter(np.asarray(im, np.float32) / 255, .7)


paper = np.array([240, 232, 214], np.float32)
img = np.ones((H, W, 3), np.float32) * paper


def wash(m, color, strength, rim=.3, soft=2.0):
    """a transparent wash (multiply) over m (0..1), its pigment pooled at the inner edge"""
    global img
    m = np.clip(nd.gaussian_filter(np.asarray(m, np.float32), soft), 0, 1)
    edge = np.clip(m - nd.gaussian_filter(m, 4), 0, 1) * rim * 3.5
    a = np.clip(m * strength * (0.93 + 0.07 * np.tanh(nB)) + edge, 0, 1)[..., None]
    img = img * (1 - a + a * np.array(color, np.float32) / 255)


# --- landscapes ---------------------------------------------------------------------------------------------------
desert = regions("Desert") | (land & (lat_w < 31) & (lon_w < 66) & (Es < 1400)) | (land & (lat_w < 41) & (lon_w > 52) & (lon_w < 66) & (Es < 400))
desert = nd.binary_closing(desert, iterations=6) & land
ranges = regions("Range/mtn") & land
taiga = land & (lat_w > 55) & ~desert
forest = land & (lat_w > 46) & (lat_w <= 55) & (lon_w < 40 + 10 * nA) & ~desert
steppe = land & (lat_w > 41) & (lat_w <= 54) & (lon_w >= 26 + 6 * nA) & ~forest & ~taiga & ~desert & (Es < 1500)
mediterranean = land & (lat_w > 31) & (lat_w <= 46) & ~steppe & ~desert & (Es < 1200)
monsoon = land & (lat_w <= 31) & (lon_w >= 66) & ~desert & (Es < 1500)            # the Indus and Ganges plains

wash(land & ~desert, (210, 206, 160), .22, rim=.1, soft=3)
wash(mediterranean, (190, 186, 120), .45, soft=5)
T1, T2 = strokes(int(W * H / 14), 11), strokes(int(W * H / 30), 12, (4, 9), 30)
fz = np.asarray(forest, np.float32)
wash(forest, (122, 152, 92), .42, soft=6)                                               # temperate forest: a sap-green ground,
wash(fz * T1, (82, 124, 78), .5, rim=0, soft=.6)                                        # laid in brush marks,
wash(fz * T2, (60, 108, 98), .35, rim=0, soft=.5)                                       # a cooler viridian through them
wash(monsoon, (150, 168, 96), .5, soft=6)
tz = np.asarray(taiga, np.float32)
wash(taiga, (88, 120, 90), .45, soft=6)
wash(tz * T1, (52, 92, 72), .55, rim=0, soft=.6)
wash(tz * T2, (40, 76, 70), .4, rim=0, soft=.5)
wash(steppe, (214, 178, 98), .62, soft=7)
wash(desert, (232, 196, 140), .62, rim=.45, soft=6)
wash(desert & (nC > 1.2), (196, 150, 98), .25, rim=0, soft=1)

# --- elevation: continuous, shaded ---------------------------------------------------------------------------------
gy, gx = np.gradient(nd.gaussian_filter(E, 5))
mpp = 111_000 / bm.PX * S
nx, ny = -gx / mpp, -gy / mpp
shade = np.clip(.5 + (nx * -.7 + ny * -.7) * 6, 0, 1)
hi = smooth(Es, 400, 2400)
wash(hi, (168, 128, 92), .5, rim=.15, soft=3)
wash(smooth(Es, 1800, 4200), (130, 86, 70), .5, rim=.1, soft=3)
wash(hi * (1 - shade), (88, 64, 60), .55, rim=0, soft=1.5)
wash(ranges * smooth(Es, 300, 1500), (150, 110, 84), .18, rim=.2, soft=4)
snow = smooth(Es, 4300, 5600) * (.6 + .4 * shade)
img = img * (1 - .7 * snow[..., None]) + .7 * snow[..., None] * np.array([246, 244, 238], np.float32)

# --- the sea ---------------------------------------------------------------------------------------------------------
water = ~land
dist = nd.distance_transform_edt(water)
wash(water * (.6 + .3 * smooth(dist, 0, 80) + .1 * np.tanh(nA)), (92, 136, 170), .62, rim=.7, soft=1.2)
bloom = np.clip(nd.gaussian_filter((np.tanh(nB * 2) > .85).astype(np.float32), 5) * water, 0, 1)
img = img * (1 - .14 * bloom[..., None]) + .14 * bloom[..., None] * paper
# cold-press paper: a fine tooth that the washes settle into
tooth = noise(1.2, 2, seed=9); tooth = tooth - nd.gaussian_filter(tooth, 3)
img *= (0.965 + 0.035 * np.tanh(tooth * 1.5))[..., None]

out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((bm.W, bm.H), Image.LANCZOS)
out.save(ROOT / "map/wash.webp", quality=80, method=6)
print("wash", (ROOT / "map/wash.webp").stat().st_size // 1024, "KB")
