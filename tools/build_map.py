"""Engrave the map of the dispersal: hachured relief, water-lined seas, rivers, in the manner of a nineteenth-century
atlas plate. Output: map/relief.webp (black ink on transparent, tinted on the page) and map/projection.json (how
the page places routes and lettering).

    <python with numpy, pillow, scipy> tools/build_map.py

Data: elevation from the Terrarium tiles of the AWS open-data terrain set (tools/mapdata/tiles, zoom 5); land,
lakes and rivers from Natural Earth 1:50m (public domain).
Projection: equirectangular, longitude compressed by cos 42° (the mid-latitude of the plate), so the north is not
stretched as Web Mercator stretches it.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "tools/mapdata"
OUT = ROOT / "map"
LON0, LON1, LAT0, LAT1 = -12.0, 96.0, 17.0, 62.0
K = math.cos(math.radians(42))
W = 4400
PX = W / ((LON1 - LON0) * K)                 # px per degree of latitude
H = int(round((LAT1 - LAT0) * PX))
SS = 2                                       # supersampling for the ink


def proj(lon, lat, s=1):
    return ((lon - LON0) * K * PX * s, (LAT1 - lat) * PX * s)


def elevation():
    z, T = 5, 256
    tiles = sorted(DATA.glob("tiles/5-*.png"))
    xs = sorted({int(t.stem.split("-")[1]) for t in tiles}); ys = sorted({int(t.stem.split("-")[2]) for t in tiles})
    mos = np.zeros(((ys[-1] - ys[0] + 1) * T, (xs[-1] - xs[0] + 1) * T), np.float32)
    for t in tiles:
        _, x, y = map(int, t.stem.split("-"))
        a = np.asarray(Image.open(t).convert("RGB")).astype(np.float32)
        mos[(y - ys[0]) * T:(y - ys[0] + 1) * T, (x - xs[0]) * T:(x - xs[0] + 1) * T] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    # sample the mosaic (Web Mercator) at each output pixel
    jj, ii = np.meshgrid(np.arange(W), np.arange(H))
    lon = LON0 + jj / (K * PX); lat = LAT1 - ii / PX
    world = T * 2 ** z
    mx = (lon + 180) / 360 * world - xs[0] * T
    lr = np.radians(lat)
    my = (1 - np.log(np.tan(lr) + 1 / np.cos(lr)) / math.pi) / 2 * world - ys[0] * T
    return nd.map_coordinates(mos, [my, mx], order=1, mode="nearest")


def polygons(name):
    for f in json.loads((DATA / f"{name}.geojson").read_text())["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for p in polys:
            yield f["properties"], p


def mask_of(name, keep=lambda p: True):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for props, poly in polygons(name):
        if not keep(props):
            continue
        d.polygon([proj(*c) for c in poly[0]], fill=255)
        for hole in poly[1:]:
            d.polygon([proj(*c) for c in hole], fill=0)
    return np.asarray(im) > 0


def main():
    OUT.mkdir(exist_ok=True)
    print("elevation", W, H)
    E = elevation()
    land = mask_of("ne_50m_land")
    lakes = mask_of("ne_50m_lakes", lambda p: (p.get("scalerank") or 9) <= 4)
    land &= ~lakes
    water = ~land
    E = np.where(land, np.maximum(E, 0), 0)

    ink = Image.new("L", (W * SS, H * SS), 0); d = ImageDraw.Draw(ink)

    # --- hachures: short strokes down the slope, heavier where steep and on the shadow side (light from the north-west)
    Es = nd.gaussian_filter(E, 4.6)          # generalized: an engraver draws landforms, not every bump
    gy, gx = np.gradient(Es)                                 # metres per px
    mpp = 111_000 / PX                                       # metres per px
    slope = np.hypot(gx, gy) / mpp
    s_norm = np.clip(np.sqrt(slope / 0.035), 0, 1)           # 3.5% grade (generalized) and steeper: full weight
    nx, ny = -gx / (np.hypot(gx, gy) + 1e-9), -gy / (np.hypot(gx, gy) + 1e-9)   # downhill
    light = np.array([-0.7, -0.7]) / math.sqrt(0.98)         # from the north-west (screen y is down)
    shade = np.clip(0.5 - 0.5 * (-nx * light[0] - ny * light[1]), 0, 1)        # 1 = facing away from the light
    # seeds along contours (every 200 m of the smoothed relief), spaced by an occupancy grid; each stroke runs
    # downhill to the next contour, thick at the top and tapering, as an engraver lays a row of hachures
    rng = np.random.default_rng(7)
    # contours in log-elevation: rows stay evenly spaced (about 3–5 px) on steep and gentle ground alike
    F = np.log(Es + 250.0)
    step_m, cell = 0.13, 2.3
    seeds = []
    for lv in np.arange(np.log(250.0) + .12, F.max(), step_m):
        up = F >= lv
        cross = up & ~nd.binary_erosion(up) & land & (s_norm > 0.22)
        ys_, xs_ = np.nonzero(cross)
        for yy, xx in zip(ys_, xs_):
            seeds.append((lv, yy + rng.uniform(-.4, .4), xx + rng.uniform(-.4, .4)))
    order = rng.permutation(len(seeds))
    occ = {}
    n = 0
    for k in order:
        lv, py, px = seeds[k]
        gi, gj = int(py / cell), int(px / cell)
        if any((gi + a, gj + b) in occ for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) == (0, 0) or occ.get((gi + a, gj + b)) and math.hypot(occ[(gi + a, gj + b)][0] - py, occ[(gi + a, gj + b)][1] - px) < cell):
            continue
        occ[(gi, gj)] = (py, px)
        i0, j0 = int(py), int(px)
        s0, sh = s_norm[i0, j0], shade[i0, j0]
        pts = [(px, py)]
        for _ in range(16):
            i, j = int(py), int(px)
            if i < 1 or j < 1 or i >= H - 1 or j >= W - 1 or not land[i, j] or F[i, j] < lv - step_m:
                break
            px += nx[i, j]; py += ny[i, j]
            pts.append((px, py))
        if len(pts) < 3:
            continue
        w0 = (0.35 + 1.55 * s0 * (0.35 + 0.9 * sh)) * SS * rng.uniform(.75, 1.25)
        wob = rng.uniform(0, 6.28)
        q = [(x + .35 * math.sin(wob + t * .9), y + .35 * math.cos(wob * 1.3 + t * .7)) for t, (x, y) in enumerate(pts)]
        for t in range(1, len(q)):
            w = w0 * (1 - 0.8 * (t / len(q)) ** 0.8)
            d.line([(q[t - 1][0] * SS, q[t - 1][1] * SS), (q[t][0] * SS, q[t][1] * SS)], fill=255, width=max(1, int(round(w))))
        r0 = w0 * .55
        d.ellipse([q[0][0] * SS - r0, q[0][1] * SS - r0, q[0][0] * SS + r0, q[0][1] * SS + r0], fill=255)
        n += 1
    print("hachures", n)

    # --- the sea: fine horizontal ruling, kept off the coast, and waterlines echoing it
    dist = nd.distance_transform_edt(water)
    for y in np.arange(0, H, 2.8):
        row = int(y)
        on = (dist[row] > 2.2)
        xs_ = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(np.int8), [0]])))
        for a, b in zip(xs_[::2], xs_[1::2]):
            x = a
            while x < b:                                   # the burin lifts now and then
                seg = min(b, x + rng.integers(60, 420))
                pts = [(xx * SS, (y + .35 * math.sin(xx * .021 + y * .37)) * SS) for xx in np.linspace(x, seg, max(2, int((seg - x) / 12)))]
                d.line(pts, fill=int(rng.integers(120, 175)), width=1)
                x = seg + rng.integers(0, 4)
    for k, (r, val) in enumerate([(4, 230), (9, 200), (16, 160), (26, 120)]):
        ring = (dist > r - .6) & (dist <= r + .6)
        ys_, xs_ = np.nonzero(ring)
        for yy, xx in zip(ys_[::1], xs_[::1]):
            d.point((xx * SS, yy * SS), fill=val)
    # the coast: a hand-inked line, a little heavier where the land falls away from the light (south and east)
    edge = land & ~nd.binary_erosion(land)
    gyl, gxl = np.gradient(nd.gaussian_filter(land.astype(np.float32), 1.5))
    ys_, xs_ = np.nonzero(edge)
    for yy, xx in zip(ys_, xs_):
        heavy = 1.0 + 0.9 * max(0.0, (gxl[yy, xx] * -0.7 + gyl[yy, xx] * -0.7) / (math.hypot(gxl[yy, xx], gyl[yy, xx]) + 1e-6))
        r0 = heavy * SS * .62
        d.ellipse([xx * SS - r0, yy * SS - r0, xx * SS + r0, yy * SS + r0], fill=255)

    # --- rivers: hairlines, heavier for the great ones
    for f in json.loads((DATA / "ne_50m_rivers_lake_centerlines.geojson").read_text())["features"]:
        g, rank = f["geometry"], f["properties"].get("scalerank") or 9
        if g is None or rank > 7:
            continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        wmax = (2.1 - 0.22 * rank) * SS
        for ln in lines:
            pp = [proj(*c, SS) for c in ln]
            for t in range(1, len(pp)):
                w = max(1, int(round(wmax * (0.35 + 0.65 * t / len(pp)))))
                d.line([pp[t - 1], pp[t]], fill=215, width=w)

    ink = ink.filter(ImageFilter.GaussianBlur(0.6)).resize((W, H), Image.LANCZOS)
    rgba = Image.merge("RGBA", [Image.new("L", (W, H), 0)] * 3 + [ink])
    rgba.save(OUT / "relief.webp", quality=88, method=6)
    (OUT / "projection.json").write_text(json.dumps({"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1, "k": K, "px": PX, "w": W, "h": H}))
    print("wrote", OUT / "relief.webp", (OUT / "relief.webp").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
