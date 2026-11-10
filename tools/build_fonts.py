# Builds the site's four Google faces (fonts/README.md): subset to every character the site uses (HTML, JS, CSS, the
# strings in data/*.json, in NFC and NFD, plus ASCII and common punctuation), split into Google's "latin" range (core)
# and the rest (ext), the variable axes narrowed to the weights and widths in use, no hinting (as Google serves them).
#   python3 tools/build_fonts.py <folder with the google/fonts TTFs> fonts     (from the site root; fontTools + brotli)
# Writes fonts/<face>-<core|ext>.<sha8>.woff2 and prints each file; css/fonts.css names them.
import os, sys, json, unicodedata, hashlib, io, subprocess, collections
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
SRC = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
# 1. the characters the site uses: every string in HTML/JS/CSS, every string value in data/*.json (parsed), NFC and NFD
chars = set()
def walk(o):
    if isinstance(o, str): chars.update(o)
    elif isinstance(o, list): [walk(x) for x in o]
    elif isinstance(o, dict): [walk(k) or walk(v) for k, v in o.items()]
for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '/.git', './vendor', './illum', './tools', './audio', './art', './map', './gardens', './fonts', './benchmarks', './functions']): continue
    for f in files:
        p = os.path.join(root, f)
        if f.endswith('.json'):
            try: walk(json.load(open(p, encoding='utf-8')))
            except Exception as e: print('skip', p, e)
        elif f.endswith(('.html', '.js', '.css', '.webmanifest', '.xml', '.txt')):
            chars.update(open(p, encoding='utf-8').read())
base = set(chars)
for ch in base:
    chars.update(unicodedata.normalize('NFD', ch)); chars.update(unicodedata.normalize('NFC', ch))
chars.update(chr(c) for c in range(0x20, 0x7f))                    # ASCII
chars.update(' ­‐‑‒–—‘’‚“”„†‡•…‰‹›⁄€™−·©®°±×÷¿¡«»§¶')   # common punctuation
chars.discard('\n'); chars.discard('\r'); chars.discard('\t')
cps = sorted(ord(c) for c in chars)
print('site characters (NFC+NFD, +ASCII/punct):', len(cps))
# Google's "latin" range: the core file; everything else the font has goes to the ext file
LATIN = [(0x0, 0xff), (0x131, 0x131), (0x152, 0x153), (0x2bb, 0x2bc), (0x2c6, 0x2c6), (0x2da, 0x2da), (0x2dc, 0x2dc), (0x304, 0x304), (0x308, 0x308), (0x329, 0x329), (0x2000, 0x206f), (0x20ac, 0x20ac), (0x2122, 0x2122), (0x2191, 0x2191), (0x2193, 0x2193), (0x2212, 0x2212), (0x2215, 0x2215), (0xfeff, 0xfeff), (0xfffd, 0xfffd)]
# every range Google served for these families (latin, latin-ext, vietnamese; + cyrillic, cyrillic-ext, greek for JetBrains Mono)
GOOGLE = { 'all': LATIN + [(0x100, 0x2ba), (0x2bd, 0x2c5), (0x2c7, 0x2cc), (0x2ce, 0x2d7), (0x2dd, 0x2ff), (0x1d00, 0x1dbf), (0x1e00, 0x1e9f), (0x1ef2, 0x1eff), (0x2020, 0x2020), (0x20a0, 0x20ab), (0x20ad, 0x20c4), (0x2113, 0x2113), (0x2c60, 0x2c7f), (0xa720, 0xa7ff),
    (0x102, 0x103), (0x110, 0x111), (0x128, 0x129), (0x168, 0x169), (0x1a0, 0x1a1), (0x1af, 0x1b0), (0x300, 0x301), (0x303, 0x304), (0x308, 0x309), (0x323, 0x323), (0x329, 0x329), (0x1ea0, 0x1ef9), (0x20ab, 0x20ab)],
  'jbm': [(0x460, 0x52f), (0x1c80, 0x1c8a), (0x20b4, 0x20b4), (0x2de0, 0x2dff), (0xa640, 0xa69f), (0xfe2e, 0xfe2f), (0x301, 0x301), (0x400, 0x45f), (0x490, 0x491), (0x4b0, 0x4b1), (0x2116, 0x2116), (0x370, 0x377), (0x37a, 0x37f), (0x384, 0x38a), (0x38c, 0x38c), (0x38e, 0x3a1), (0x3a3, 0x3ff)] }
inr = lambda cp, rs: any(a <= cp <= b for a, b in rs)
FONTS = [  # (output name, source, axis limits, extra google ranges key)
  ('archivo', 'archivo-Archivo[wdth,wght].ttf', {'wght': (800, 800, 900), 'wdth': (100, 100, 125)}, 'all'),
  ('newsreader', 'newsreader-Newsreader[opsz,wght].ttf', {'wght': (400, 400, 700)}, 'all'),
  ('newsreader-italic', 'newsreader-Newsreader-Italic[opsz,wght].ttf', {'wght': (400, 400, 700)}, 'all'),
  ('instrumentserif', 'instrumentserif-InstrumentSerif-Regular.ttf', None, 'all'),
  ('instrumentserif-italic', 'instrumentserif-InstrumentSerif-Italic.ttf', None, 'all'),
  ('jetbrainsmono', 'jetbrainsmono-JetBrainsMono[wght].ttf', {'wght': (400, 400, 700)}, 'jbm'),
]
report = {}
def rngs(cps):
    out = []; 
    for cp in cps:
        if out and cp == out[-1][1] + 1: out[-1][1] = cp
        else: out.append([cp, cp])
    return ', '.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in out)
for name, src, axes, gkey in FONTS:
    f = TTFont(os.path.join(SRC, src))
    cmap = set(f.getBestCmap().keys())
    have = [cp for cp in cps if cp in cmap]
    newly = [cp for cp in have if not inr(cp, GOOGLE['all'] + (GOOGLE['jbm'] if gkey == 'jbm' else []))]
    # Google's "latin" files carry these combining marks beyond their declared range (0300 0301 0303 0304 0308 0309 0323);
    # the core file does too, so a letter with its marks shapes exactly as it did from the Google service (Chrome falls
    # back for a cluster whose base and marks come from different faces, and whether it does depends on this)
    GMARKS = {0x300, 0x301, 0x303, 0x304, 0x308, 0x309, 0x323}
    core = [cp for cp in have if inr(cp, LATIN) or cp in GMARKS]; ext = [cp for cp in have if not inr(cp, LATIN)]
    if axes:
        f = instancer.instantiateVariableFont(f, {k: instancer.AxisRange(v[0], v[2]) if False else (v[0], v[1], v[2]) for k, v in axes.items()}, inplace=False, updateFontNames=False)
    files = {}
    for part, lst in (('core', core), ('ext', ext)):
        if not lst: continue
        opts = subset.Options(); opts.flavor = 'woff2'; opts.hinting = False; opts.notdef_outline = True; opts.glyph_names = False   # default layout features and names, as Google's files; no hinting, as theirs
        s = subset.Subsetter(opts); s.populate(unicodes=lst); g = TTFont(); 
        buf = io.BytesIO(); f.save(buf); buf.seek(0); g = TTFont(buf); s.subset(g)
        g.flavor = 'woff2'; out = io.BytesIO(); g.save(out); data = out.getvalue()
        h = hashlib.sha256(data).hexdigest()[:8]; fn = f'{name}-{part}.{h}.woff2'
        open(os.path.join(OUT, fn), 'wb').write(data); files[part] = (fn, len(data), rngs(lst), len(lst))
    report[name] = {'files': files, 'glyphs_total': len(have), 'newly_covered': ''.join(chr(c) for c in newly), 'axes': axes}
    print(name, {k: (v[0], v[1], v[3]) for k, v in files.items()}, 'newly covered vs Google ranges:', ''.join(chr(c) for c in newly) or '-')
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), ensure_ascii=False, indent=1)
