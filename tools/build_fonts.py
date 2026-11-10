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
  # 'PIE Serif': Noto Serif (OFL, notofonts/latin-greek-cyrillic) behind Newsreader in every font stack, for what Newsreader
  # still lacks (IPA letters ɣ ɟ ɡ ʱ ˀ ..., Greek and Cyrillic daughter forms), so those draw in a serif on every system
  # instead of the system's sans; one file per style holding exactly those characters
  ('pieserif', 'notoserif-NotoSerif[wdth,wght].ttf', {'wght': (400, 400, 700), 'wdth': 100}, 'fallback'),
  ('pieserif-italic', 'notoserif-NotoSerif-Italic[wdth,wght].ttf', {'wght': (400, 400, 700), 'wdth': 100}, 'fallback'),
]
NR_CMAP = set()                                      # Newsreader's final characters (roman and italic): the fallback skips them
# 2. ḗ ṓ ḕ ṑ (and capitals): the PIE text is full of ḗ and ṓ (U+1E17, U+1E53: 22,000 in data/), which none of these
# faces has. Shaped from e + macron + acute, Newsreader stacks the acute beside the macron (no mark-to-mark anchor for it),
# and under Google's split files Chrome had drawn them in a system font instead. So the serif faces get them as
# composites of the font's own parts: its ē/ō (letter + macron) with the acute or grave of its é/è above the macron, at
# the horizontal place (and with the same variations) as in é/è, GAP above the macron's top. In the core file too, so a
# decomposed e + U+0304 + U+0301 recomposes to it there.
STACK = [(0x1E17, 'emacron', 'eacute'), (0x1E15, 'emacron', 'egrave'), (0x1E53, 'omacron', 'oacute'), (0x1E51, 'omacron', 'ograve'),
         (0x1E16, 'Emacron', 'Eacute'), (0x1E14, 'Emacron', 'Egrave'), (0x1E52, 'Omacron', 'Oacute'), (0x1E50, 'Omacron', 'Ograve')]
STACKED = {'newsreader', 'newsreader-italic', 'instrumentserif', 'instrumentserif-italic'}
def stack_marks(f, gap_em=0.045):
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
    from fontTools.ttLib.tables.TupleVariation import TupleVariation
    glyf, cmap, order = f['glyf'], f.getBestCmap(), list(f.getGlyphOrder())
    gap = round(gap_em * f['head'].unitsPerEm); added = []
    for cp, mac, ref in STACK:
        if cp in cmap or mac not in glyf.keys() or ref not in glyf.keys(): continue
        gm, gr = glyf[mac], glyf[ref]
        if not (gm.isComposite() and gr.isComposite() and len(gm.components) == 2 and len(gr.components) == 2): continue
        (bm, mm), (br, mk) = gm.components, gr.components
        if bm.glyphName != br.glyphName: continue
        top = glyf[mm.glyphName]; top.recalcBounds(glyf); mark = glyf[mk.glyphName]; mark.recalcBounds(glyf)
        name = mac + ref[1:]                                  # emacronacute, Omacrongrave ...
        c = GlyphComponent(); c.glyphName = mk.glyphName; c.x = mk.x; c.y = mm.y + top.yMax + gap - mark.yMin; c.flags = 0
        g = Glyph(); g.numberOfContours = -1; g.components = [bm, mm, c]
        glyf.glyphs[name] = g; order.append(name)
        f['hmtx'].metrics[name] = f['hmtx'].metrics[mac]
        if 'gvar' in f:                                      # deltas: letter + macron from ē, the mark's from é, by region
            V = f['gvar'].variations; vr = {tuple(sorted(t.axes.items())): t for t in V.get(ref, [])}; out = []
            for t in V.get(mac, []):
                r = vr.get(tuple(sorted(t.axes.items())))
                d = r.coordinates[1] if r is not None else (0, 0)
                out.append(TupleVariation(t.axes, [t.coordinates[0], t.coordinates[1], d] + list(t.coordinates[2:])))
            V[name] = out
        if 'HVAR' in f and f['HVAR'].table.AdvWidthMap is not None:
            f['HVAR'].table.AdvWidthMap.mapping[name] = f['HVAR'].table.AdvWidthMap.mapping[mac]
        if 'GDEF' in f and f['GDEF'].table.GlyphClassDef is not None:
            f['GDEF'].table.GlyphClassDef.classDefs[name] = 1
        for t in f['cmap'].tables:
            if t.isUnicode(): t.cmap[cp] = name
        added.append(cp)
    f.setGlyphOrder(order); glyf.glyphOrder = order
    return added
# 3. the rest of PIE's letters, for Newsreader (the face the PIE text is set in): it has none of ₁₂₃ ʰ ʷ ḱ ǵ or the ring
# below of n̥ r̥ l̥ m̥, so the browser drew ḱ and n̥ in a system font and js/type.js rebuilt ₁₂₃ ʰ ʷ from shrunken digits
# and letters. Each is made of the face's own parts: ₁₂₃ its superior figures ¹²³ lowered (bottom SUB_BOTTOM below the
# baseline); ʰ ʷ its h and w scaled MOD_SCALE onto the superior figures' baseline; ḱ ǵ (Ḱ Ǵ) the letter with the acute
# its own mark-attachment anchors give it (k has one only for the capital-height acute, above its ascender); and the ring
# below, its ring above scaled RING_SCALE and hung where its dot below hangs, attached by the dot below's anchors; the
# inverted breve below of u̯ i̯ (its breve below turned over) and the vertical line below of r̩ l̩ (its bar, shortened).
PIE_FACES = {'newsreader', 'newsreader-italic', 'instrumentserif', 'instrumentserif-italic'}
SUB_BOTTOM, MOD_SCALE, RING_SCALE, LINE_LEN, FIG_SCALE = -0.10, 0.58, 0.85, 0.13, 0.62
def pie_glyphs(f, cps):
    import copy
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
    glyf, hm, cmap, order = f['glyf'], f['hmtx'], f.getBestCmap(), list(f.getGlyphOrder()); upm = f['head'].unitsPerEm
    gpos = f['GPOS'].table; added = []
    if 'HVAR' not in f and 'gvar' not in f: pass      # a static face: plain composites
    def bb(n): x = glyf[n]; x.recalcBounds(glyf); return x.xMin, x.xMax, x.yMin, x.yMax
    def subtables():
        for L in gpos.LookupList.Lookup:
            for st in L.SubTable:
                yield (st.ExtSubTable, st.ExtensionLookupType) if L.LookupType == 9 else (st, L.LookupType)
    def anchor(base, mark):                          # the (dx, dy) that puts mark on base by the font's mark-to-base anchors
        for s, t in subtables():
            if t == 4 and mark in s.MarkCoverage.glyphs and base in s.BaseCoverage.glyphs:
                rec = s.MarkArray.MarkRecord[s.MarkCoverage.glyphs.index(mark)]
                ba = s.BaseArray.BaseRecord[s.BaseCoverage.glyphs.index(base)].BaseAnchor[rec.Class]
                if ba is not None:
                    return ba.XCoordinate - rec.MarkAnchor.XCoordinate, ba.YCoordinate - rec.MarkAnchor.YCoordinate
        return None
    def comp(name, x=0, y=0, scale=None):
        c = GlyphComponent(); c.glyphName = name; c.x = round(x); c.y = round(y); c.flags = 0
        if scale is not None: c.transform = [[scale, 0], [0, scale]]
        return c
    def new(cp, name, comps, adv_from, adv=None, cls=1):
        if cp is not None and cp in cmap: return
        g = Glyph(); g.numberOfContours = -1; g.components = comps; glyf.glyphs[name] = g; order.append(name)
        hm.metrics[name] = (round(adv) if adv is not None else hm.metrics[adv_from][0], 0)
        if 'HVAR' in f and f['HVAR'].table.AdvWidthMap is not None:
            f['HVAR'].table.AdvWidthMap.mapping[name] = f['HVAR'].table.AdvWidthMap.mapping[adv_from]
        if 'GDEF' in f and f['GDEF'].table.GlyphClassDef is not None: f['GDEF'].table.GlyphClassDef.classDefs[name] = cls
        if cp is not None:
            for t in f['cmap'].tables:
                if t.isUnicode(): t.cmap[cp] = name
            added.append(cp)
    # ₁₂₃
    for cp, sup, fig in ((0x2081, 'uni00B9', 'one'), (0x2082, 'uni00B2', 'two'), (0x2083, 'uni00B3', 'three')):
        if sup in glyf.keys():
            new(cp, f'uni{cp:04X}', [comp(sup, 0, SUB_BOTTOM * upm - bb(sup)[2])], sup)
        elif fig in glyf.keys():                     # a face without superior figures (Instrument Serif): its figures, scaled
            new(cp, f'uni{cp:04X}', [comp(fig, 0, SUB_BOTTOM * upm, FIG_SCALE)], fig, adv=hm.metrics[fig][0] * FIG_SCALE)
    # ʰ ʷ on the superior figures' baseline (or, without them, with ʰ's top at h's)
    base_y = bb('uni00B9')[2] if 'uni00B9' in glyf.keys() else bb('h')[3] * (1 - MOD_SCALE) if 'h' in glyf.keys() else None
    if base_y is not None:
        for cp, src in ((0x02B0, 'h'), (0x02B7, 'w')):
            new(cp, f'uni{cp:04X}', [comp(src, 0, base_y, MOD_SCALE)], 'uni00B9' if 'uni00B9' in glyf.keys() else src, adv=hm.metrics[src][0] * MOD_SCALE)
    # ḱ ǵ Ḱ Ǵ ḿ ...: every precomposed letter + one mark the site uses that the face lacks, placed by the face's own
    # anchors (the capital-height form of the mark where the letter has an anchor only for that, as k for the acute)
    rev = {v: k for k, v in f.getBestCmap().items()}
    for cp in [c for c in cps if c not in cmap]:
        d = unicodedata.decomposition(chr(cp)).split()
        if len(d) != 2 or d[0].startswith('<'): continue
        base, mk = (f.getBestCmap().get(int(x, 16)) for x in d)
        if not base or not mk or unicodedata.category(chr(int(d[1], 16))) != 'Mn': continue
        for mark in (mk, mk + '.case'):
            a = anchor(base, mark) if mark in glyf.keys() else None
            if a: new(cp, f'uni{cp:04X}', [comp(base), comp(mark, *a)], base); break
    def attach_like(name, like):                     # a new mark glyph takes the mark class and anchor of an existing one
        for s, t in subtables():
            cov = s.MarkCoverage if t in (4, 5) else s.Mark1Coverage if t == 6 else None
            arr = s.MarkArray if t in (4, 5) else s.Mark1Array if t == 6 else None
            if cov is not None and like in cov.glyphs:
                arr.MarkRecord.append(copy.deepcopy(arr.MarkRecord[cov.glyphs.index(like)])); cov.glyphs.append(name)
                arr.MarkCount = len(arr.MarkRecord)
    # the ring below (n̥ r̥ l̥ m̥): the ring above scaled RING_SCALE, hung and attached like the dot below
    if 'uni030A' in glyf.keys() and 'dotbelowcomb' in glyf.keys() and 0x0325 not in cmap:
        r, d = bb('uni030A'), bb('dotbelowcomb'); s_ = RING_SCALE
        cx_r, cx_d = (r[0] + r[1]) / 2 * s_, (d[0] + d[1]) / 2
        new(0x0325, 'uni0325', [comp('uni030A', cx_d - cx_r, d[3] - r[3] * s_, s_)], 'dotbelowcomb', cls=3)
        attach_like('uni0325', 'dotbelowcomb')
    # the inverted breve below (u̯ i̯): the breve below turned over in place, attached like it
    if 'uni032E' in glyf.keys() and 0x032F not in cmap:
        b_ = bb('uni032E'); c = comp('uni032E', b_[0] + b_[1], b_[2] + b_[3]); c.transform = [[-1, 0], [0, -1]]
        new(0x032F, 'uni032F', [c], 'uni032E', cls=3); attach_like('uni032F', 'uni032E')
    # the vertical line below (r̩ l̩ m̩ n̩): the bar, LINE_LEN em long, hung from the dot below's top, attached like it
    if 'bar' in glyf.keys() and 'dotbelowcomb' in glyf.keys() and 0x0329 not in cmap:
        b_, d = bb('bar'), bb('dotbelowcomb'); sy = LINE_LEN * upm / (b_[3] - b_[2]); sx = 0.8
        c = comp('bar', -(b_[0] + b_[1]) / 2 * sx + (d[0] + d[1]) / 2, d[3] - b_[3] * sy); c.transform = [[sx, 0], [0, sy]]
        new(0x0329, 'uni0329', [c], 'dotbelowcomb', cls=3); attach_like('uni0329', 'dotbelowcomb')
    f.setGlyphOrder(order); glyf.glyphOrder = order
    return added
report = {}
def rngs(cps):
    out = []; 
    for cp in cps:
        if out and cp == out[-1][1] + 1: out[-1][1] = cp
        else: out.append([cp, cp])
    return ', '.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in out)
for name, src, axes, gkey in FONTS:
    f = TTFont(os.path.join(SRC, src))
    stacked = stack_marks(f) if name in STACKED else []
    if name in PIE_FACES:
        pg = pie_glyphs(f, cps); stacked += pg; print(name, 'PIE glyphs added:', ' '.join(chr(c) for c in pg))
    if stacked: print(name, 'stacked composites added:', ''.join(chr(c) for c in stacked))
    cmap = set(f.getBestCmap().keys())
    if name.startswith('newsreader'): NR_CMAP |= cmap
    have = [cp for cp in cps if cp in cmap and (gkey != 'fallback' or (cp not in NR_CMAP and cp > 0x7f and unicodedata.category(chr(cp))[0] in 'LM'))]
    newly = [cp for cp in have if not inr(cp, GOOGLE['all'] + (GOOGLE['jbm'] if gkey == 'jbm' else []))]
    # Google's "latin" files carry these combining marks beyond their declared range (0300 0301 0303 0304 0308 0309 0323);
    # the core file does too, so a letter with its marks shapes exactly as it did from the Google service (Chrome falls
    # back for a cluster whose base and marks come from different faces, and whether it does depends on this)
    GMARKS = {0x300, 0x301, 0x303, 0x304, 0x308, 0x309, 0x323}
    core = [cp for cp in have if inr(cp, LATIN) or cp in GMARKS or cp in stacked]; ext = [cp for cp in have if not inr(cp, LATIN)]
    if gkey == 'fallback': core, ext = have, []
    if axes:
        f = instancer.instantiateVariableFont(f, {k: v if isinstance(v, (int, float)) else (v[0], v[1], v[2]) for k, v in axes.items()}, inplace=False, updateFontNames=False)
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
