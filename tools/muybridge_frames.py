# Muybridge 1878 plate -> 12 horse silhouettes (rider removed) as PBM for potrace, plus previews.
import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
im = np.asarray(Image.open('horse-in-motion.jpg').convert('L')).astype(np.float32)
H, W = im.shape
dark = im < 60
# grid separators: long dark runs across the plate
colfrac = dark[int(H*.05):int(H*.78)].mean(0); rowfrac = dark[:, int(W*.05):int(W*.95)].mean(1)
def runs(f, thr):
    idx = np.where(f > thr)[0]; out = []; s = idx[0]; p = idx[0]
    for i in idx[1:]:
        if i != p + 1: out.append((s, p)); s = i
        p = i
    out.append((s, p)); return out
cols = [r for r in runs(colfrac, .75) if r[1] - r[0] > 8]; rows = [r for r in runs(rowfrac, .75) if r[1] - r[0] > 8]
print('cols', cols); print('rows', rows)
cells = []
for (r0, r1), (r2, r3) in zip(rows[:-1], rows[1:]):
    for (c0, c1), (c2, c3) in zip(cols[:-1], cols[1:]):
        cells.append((r1 + 1, r2, c1 + 1, c2))
print(len(cells), 'cells')
masks = []
for k, (y0, y1, x0, x1) in enumerate(cells[:11]):
    cell = im[y0:y1, x0:x1]; h, w = cell.shape
    m = cell < 95
    m[: int(h * .14)] = False                       # the scale numbers along the top
    # thin rules (the track lines, the vertical grid) go; legs and hooves, which are thick, stay
    hl = nd.binary_opening(m, structure=np.ones((1, 61)))
    vthick = nd.binary_opening(m, structure=np.ones((7, 1)))
    m &= ~(hl & ~vthick)
    vl = nd.binary_opening(m, structure=np.ones((61, 1)))
    hthick = nd.binary_opening(m, structure=np.ones((1, 7)))
    m &= ~(vl & ~hthick)
    clean = m.copy()
    m = nd.binary_opening(m, iterations=3)
    lab, n = nd.label(m); sizes = nd.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(sizes)))
    m = nd.binary_propagation(m, mask=clean)         # grow back the thin legs from the body
    ys, xs = np.where(m)
    # rider: the narrow tall bump on the top profile over the middle of the horse
    top = np.full(w, h); 
    for x in range(w):
        c = np.where(m[:, x])[0]
        if len(c): top[x] = c[0]
    xa, xb = xs.min(), xs.max(); L = xb - xa
    # the rider: rebuild the back as a straight run from croup to withers and clear everything above it
    hh = ys.max() - ys.min()
    croup = np.median(top[xa + int(L * .2): xa + int(L * .3)])
    c0, c1 = xa + int(L * .26), xa + int(L * .70)
    for x in range(c0, c1 + 1):
        u = (x - c0) / (c1 - c0)
        yc = croup - hh * (.02 * u + .10 * max(0, (u - .78) / .22) ** 1.6) + 2     # the back, then up into the neck
        m[: int(yc), x] = False
    keep = m.copy()
    m = nd.binary_opening(m, iterations=4)
    lab, n = nd.label(m); sizes = nd.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
    m = nd.binary_propagation(m, mask=keep)          # the legs again, without the rider
    m = nd.binary_opening(m, iterations=1)
    m = nd.binary_closing(m, iterations=2)
    # the ground shadow: long runs in the lowest rows, except right under a leg
    ys_, xs_ = np.where(m); yb = ys_.max(); hh2 = yb - ys_.min()
    for y in range(int(yb - hh2 * .08), yb + 1):
        row = m[y]; edges = np.flatnonzero(np.diff(np.concatenate([[0], row.astype(np.int8), [0]])))
        for a, b in zip(edges[::2], edges[1::2]):
            if b - a > hh2 * .35:
                above = m[max(0, y - 12), a:b]
                m[y, a:b] &= above
    ys_, xs_ = np.where(m); yb = ys_.max(); hh2 = yb - ys_.min()
    for y in range(yb, int(yb - hh2 * .035), -1):     # slivers of shadow under the hooves
        m[y] &= m[y - 3]
    lab, n = nd.label(m); sizes = nd.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
    masks.append(m)
# one crop window for all frames (cell-relative), so the gallop does not jitter
hmin = min(m.shape[0] for m in masks); wmin = min(m.shape[1] for m in masks)
masks = [m[:hmin, :wmin] for m in masks]
U = np.zeros((hmin, wmin), bool)
for m in masks: U |= m
ys, xs = np.where(U); Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
for k, m in enumerate(masks):
    m = np.pad(m[Y0:Y1, X0:X1], 6)
    Image.fromarray(((~m) * 255).astype(np.uint8)).save(f'frame-{k+1:02d}.png')
    Image.fromarray(((~m) * 255).astype(np.uint8)).save(f'frame-{k+1:02d}.pbm')
print('window', Y1 - Y0, X1 - X0)
print('done')
