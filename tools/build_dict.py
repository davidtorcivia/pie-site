"""The dictionary's data, built from the PIE repo (read-only) through the project's own loaders, so the site shows
what the engine and the translator use:
- entries: pie.realize.Lexicon (lexicon.jsonl with its overrides, the project reconstructions, reflex-confirmed
  glosses) plus pie.neologism's coinages and the closed-class tables (pronouns, particles, numerals)
- glosses: Lexicon.meaning (a dictionary gloss, or the approximate one composed from root + suffix)
- paradigms: Lexicon.admissible_cells, the engine's own inflection (the cells a text may use)
- pronunciation: pie.ipa.to_ipa
- reflexes: the entry's reflexes, grouped by branch (pie.glosses.branch), with glosses where reflex_glosses has one
- examples: corpus records whose tokens carry the entry's lex_id

Output, static for Cloudflare:
  data/dict/index.json      every entry: [id, form, gloss, class, pos, flags, reflex languages, corpus uses]
  data/dict/e/NN.json       entry details, 64 shards by id hash (loaded when an entry opens)
  data/dict/reflex.json     daughter forms -> entry, for searching by a descendant word (loaded after first paint)

    /Users/david/AI/PIE/.venv/bin/python tools/build_dict.py
"""
import glob
import json
import re
import sys
import unicodedata
import zlib
from collections import defaultdict
from pathlib import Path

PIE = Path("/Users/david/AI/PIE")
sys.path.insert(0, str(PIE))
from pie.realize import Lexicon            # noqa: E402
from pie.neologism import with_neologisms  # noqa: E402
from pie.glosses import branch             # noqa: E402
from pie.ipa import to_ipa                 # noqa: E402
from pie.translator.gloss import CLOSED_EN  # noqa: E402

SITE = Path(__file__).resolve().parents[1]
OUT = SITE / "data/dict"
SHARDS = 64
BRANCH_ORDER = ["Anatolian", "Tocharian", "Indo-Iranian", "Greek", "Armenian", "Albanian", "Italic", "Celtic",
                "Germanic", "Balto-Slavic"]
LIV_LABEL = {"Präsens": "present", "Präs.": "present", "Aorist": "aorist", "s-Aorist": "s-aorist", "Perfekt": "perfect",
             "Kausativ": "causative", "Iterativ": "iterative", "Desider.": "desiderative", "Desid.": "desiderative",
             "Essiv": "essive", "Kaus.-It.": "causative-iterative", "Fientiv": "fientive", "Intensiv": "intensive",
             "Präs./Aor.": "present/aorist", "Aor./Präs.": "aorist/present"}
POS = {"noun": "noun", "verb": "verb", "adj": "adjective", "adv": "adverb", "num": "numeral", "pron": "pronoun",
       "particle": "particle", "det": "determiner", "prefix": "prefix", "suffix": "suffix", "conj": "conjunction",
       "intj": "interjection", "infix": "infix", "phrase": "phrase", "root": "root"}


def jl(p):
    return [json.loads(l) for l in Path(p).read_text("utf-8").splitlines() if l.strip()]


def shard(i):
    return zlib.crc32(i.encode()) % SHARDS


def ipa(form):
    try:
        return to_ipa(form.strip("-*"))
    except Exception:
        return None


lx = with_neologisms(Lexicon.load())
E = lx.entries
print("entries", len(E))

# ---------------------------------------------------------------------------------------------- corpus examples
uses, examples = defaultdict(int), defaultdict(list)
for f in sorted(glob.glob(str(PIE / "corpus/tier*/*.jsonl"))):
    for r in jl(f):
        if not r.get("english") or not r.get("pie"):
            continue
        seen = set()
        for k, t in enumerate(r.get("tokens") or []):
            lid = t.get("lex_id")
            if not lid:
                continue
            lid = re.sub(r"^(closed:numerals)/.*", r"\1", lid)
            lid = re.sub(r"^(closed:(?:relative_yo|demonstrative_so|anaphoric_i|interrogative_kwi|indefinite_kwi))/.*", r"\1", lid)
            uses[lid] += 1
            if lid in seen:
                continue
            seen.add(lid)
            if t.get("match") == "exact" or t.get("verified") or lid.startswith("closed:"):
                examples[lid].append((r["tier"], len(r["pie"]), r["id"], r["pie"], r["english"], k, t["form"], r.get("work_group_id") or r["id"]))


def pick_examples(lid):
    xs = sorted(examples.get(lid, []), key=lambda x: (x[0], abs(x[1] - 70)))
    out, texts, works = [], set(), set()
    for tier, _, rid, pie, en, k, form, work in xs:
        if pie in texts or en in texts or work in works or len(pie) > 220:
            continue
        texts.update((pie, en)); works.add(work)
        out.append({"id": rid, "pie": pie, "en": en, "w": form})
        if len(out) == 3:
            break
    return out


# ---------------------------------------------------------------------------------------------- reflexes
rg = {}
for r in jl(PIE / "data/lexicon/reflex_glosses.jsonl"):
    for x in r["reflexes"]:
        for en in x.get("entries", []):
            if en.get("glosses") and not en.get("approx"):
                rg.setdefault((r["id"], x["lang"], x["form"]), en["glosses"][0])
                break


def reflexes(lid, e):
    by = defaultdict(list)
    for lang, vs in (e.get("reflexes") or {}).items():
        b = branch(lang)
        if b not in BRANCH_ORDER:
            b = "Borrowed"
        depth = min((len(v.get("via") or []) for v in vs), default=0)
        forms = []
        for v in vs[:3]:
            f = {"f": v["form"]}
            if v.get("roman") and v["roman"] != v["form"]:
                f["r"] = v["roman"]
            g = v.get("gloss") or rg.get((lid, lang, v["form"].lstrip("*")) ) or rg.get((lid, lang, v["form"]))
            if g:
                f["g"] = g[:80]
            if v.get("uncertain"):
                f["u"] = 1
            forms.append(f)
        by[b].append((depth, lang, forms))
    out = []
    for b in BRANCH_ORDER + ["Borrowed"]:
        if b in by:
            langs = sorted(by[b], key=lambda x: (x[0], x[1]))
            out.append({"b": b, "n": len(langs), "l": [{"lang": l, "forms": fs} for _, l, fs in langs[:8]]})
    return out


# ---------------------------------------------------------------------------------------------- paradigms
def cells_for(lid, e):
    if lx.inadmissible(lid):
        return None
    fam = lx.specs[lid]["family"]
    # not where the entry's own part of speech contradicts the engine's class
    if e.get("pos") and {"noun": "noun", "adj": "adj", "verb": "verb"}.get(e["pos"]) != fam:
        return None
    try:
        if fam == "adj":
            return {"type": "adj", "g": {g: lx.admissible_cells(lid, g) for g in ("m", "f", "n")}}
        if fam == "noun":
            return {"type": "noun", "g": {lx.gender(lid): lx.admissible_cells(lid)}}
        c = lx.admissible_cells(lid)
        return {"type": "verb", "c": c} if c else None
    except Exception as ex:
        print("  paradigm", lid, type(ex).__name__, str(ex)[:80])
        return None


# ---------------------------------------------------------------------------------------------- entries
children = defaultdict(list)
for i, e in E.items():
    for p in {e.get("root_id"), *(e.get("parents") or [])} - {None, i}:
        children[p].append(i)


def gloss_of(i):
    if i not in E:
        return None, None
    g, src = lx.meaning(i)
    if g and src == "derived":
        g = g.split("[")[0].strip()
    return g, src


def cls_of(e):
    if e.get("coined") or e["id"].startswith(("pie-neo-", "pie-proj-")):
        return "C"
    return {"root": "R", "affix": "A", "derivative": "D"}.get(e["kind"], "W")


index, details = [], {}
for i, e in E.items():
    if e["kind"] in ("alt", "form"):
        continue
    g, src = gloss_of(i)
    c = cls_of(e)
    pos = e.get("pos") or (lx.specs[i]["family"] if i in lx.specs and not lx.inadmissible(i) else None)
    flags = ""
    if src == "derived":
        flags += "a"
    if e.get("confidence") == "uncertain" or e.get("uncertain"):
        flags += "u"
    refl = reflexes(i, e)
    nlang = sum(x["n"] for x in refl if x["b"] != "Borrowed")
    index.append([i, e["form"], (g or "")[:110], c, pos or "", flags, nlang, uses.get(i, 0)])

    d = {"id": i, "form": e["form"], "kind": e["kind"], "class": c, "pos": POS.get(pos or "", pos)}
    if g:
        d["gloss"] = g
        d["gloss_src"] = src
    if src == "derived":
        d["formation"] = lx.derived[i].split("[", 1)[1].rstrip("]") if "[" in lx.derived.get(i, "") else None
    if e.get("meaning") and len(e["meaning"]) > 1:
        d["senses"] = e["meaning"][:8]
    gen = e.get("gender")
    if gen or (pos == "noun" and i in lx.specs):
        d["gender"] = lx.gender(i)
    for k in ("segmented", "accent_class", "aspect", "root_type"):
        if e.get(k):
            d[k] = e[k]
    if e.get("variants"):
        d["variants"] = e["variants"][:6]
    d["ipa"] = ipa(e["form"]) if c != "R" and e["kind"] != "affix" else None
    root = e.get("root_id")
    if root and root != i and root in E:
        d["root"] = {"id": root, "form": E[root]["form"], "gloss": gloss_of(root)[0]}
    par = [p for p in (e.get("parents") or []) if p in E and p != root and p != i]
    if par:
        d["parents"] = [{"id": p, "form": E[p]["form"], "gloss": gloss_of(p)[0]} for p in par[:6]]
    kids = sorted(set(children.get(i, [])), key=lambda k: (not gloss_of(k)[0], -uses.get(k, 0), E[k]["form"]))
    if kids:
        d["family"] = [{"id": k, "form": E[k]["form"], "gloss": gloss_of(k)[0]} for k in kids[:48]]
        d["family_n"] = len(kids)
    if refl:
        d["reflexes"] = refl
    if e.get("liv"):
        d["liv"] = [{"label": LIV_LABEL.get(s["label"], s["label"]), "form": s["form"]} for l in e["liv"] for s in l["stems"]][:12]
    p = cells_for(i, e)
    if p:
        d["paradigm"] = p
    ex = pick_examples(i)
    if ex:
        d["examples"] = ex
        d["uses"] = uses[i]
    sr = e.get("source_ref") or {}
    src_name = e.get("source")
    if i.startswith("pie-neo-"):
        d["source"] = {"name": "coinage", "note": e.get("rationale") or (e.get("derivation") or {}).get("rationale")}
    elif e.get("coined"):
        d["source"] = {"name": "project", "cite": "; ".join(sorted({v.get("cite") for vs in (e.get("reflexes") or {}).values() for v in vs if v.get("cite")}))[:200]}
    elif src_name == "wiktionary" and sr.get("title"):
        d["source"] = {"name": "Wiktionary", "url": "https://en.wiktionary.org/wiki/" + sr["title"].replace(" ", "_")}
    elif src_name == "liv2":
        d["source"] = {"name": "LIV²", "page": (sr.get("page") or {}).get("printed"), "iew": sr.get("iew")}
    elif src_name == "nil":
        d["source"] = {"name": "NIL", "page": (sr.get("page") or {}).get("printed")}
    elif src_name == "supplement":
        d["source"] = {"name": "supplement", "cite": e.get("cite")}
    else:
        d["source"] = {"name": src_name}
    details[i] = d

# coinage rationales live in the neologism rows
for r in jl(PIE / "data/lexicon/neologisms.jsonl"):
    d = details.get(r["neo_id"])
    if d:
        d["source"] = {"name": "coinage", "note": r.get("rationale")}
        d.setdefault("gloss", r.get("gloss") or r.get("english"))

# ---------------------------------------------------------------------------------------------- closed class
cc = json.loads((PIE / "data/morph/closed_class.json").read_text("utf-8"))
PRON = {
    "personal/1": ("h₁eǵóh₂", "I, me; we, us", "personal pronoun, first person"),
    "personal/2": ("túH", "you", "personal pronoun, second person"),
    "demonstrative_so": ("só", "that, this; he, she", "demonstrative pronoun"),
    "anaphoric_i": ("h₁é", "he, she, it; they", "anaphoric pronoun"),
    "deictic_ki": ("ḱís", "this, these", "near deictic pronoun"),
    "deictic_eno": ("h₁énos", "that yonder", "far deictic pronoun"),
    "relative_yo": ("h₁yós", "who, which (relative)", "relative pronoun"),
    "interrogative_kwi": ("kʷís", "who? what?", "interrogative pronoun"),
    "interrogative_kwo": ("kʷós", "which?", "interrogative pronoun"),
}


def first(table):
    for sub in table.values():
        if isinstance(sub, dict):
            for v in sub.values():
                if isinstance(v, list) and v:
                    return v[0]
        elif isinstance(sub, list) and sub:
            return sub[0]
    return None


def add_closed(cid, form, gloss, pos, paradigm=None, note=None):
    i = "closed:" + cid
    d = {"id": i, "form": form, "kind": "word", "class": "G", "pos": pos, "gloss": gloss, "gloss_src": "closed",
         "ipa": ipa(form), "source": {"name": "closed", "note": note}}
    if paradigm:
        d["paradigm"] = paradigm
    ex = pick_examples(i)
    if ex:
        d["examples"] = ex
        d["uses"] = uses[i]
    details[i] = d
    index.append([i, form, gloss, "G", pos, "", 0, uses.get(i, 0)])


def clean_table(t):
    return {k: v for k, v in t.items() if isinstance(v, list)}


for cid, (form, gloss, pos) in PRON.items():
    t = cc.get(cid.split("/")[0])
    if t is None:
        continue
    if cid.startswith("personal/"):
        t = t[cid.split("/")[1]]
        para = {"type": "pron", "g": {"": clean_table(t)}}
    else:
        para = {"type": "pron", "g": {g: clean_table(v) for g, v in t.items() if isinstance(v, dict)}}
    add_closed(cid, form or first(t), gloss, pos, para, (t.get("_note") if isinstance(t, dict) else None))
NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight",
       "9": "nine", "10": "ten", "100": "hundred", "1000": "thousand"}
nums = cc["numerals"]
num_para = {}
for n, t in nums.items():
    if n.startswith("_") or not isinstance(t, (dict, list)):
        continue
    if isinstance(t, dict) and any(isinstance(v, dict) for v in t.values()):
        num_para[n] = {g: clean_table(v) for g, v in t.items() if isinstance(v, dict)}
ind = nums.get("indeclinable") or {}
for n, en in NUM.items():
    form = None
    if n in num_para:
        form = first(num_para[n])
    elif isinstance(ind.get(n), list) and ind[n]:
        form = ind[n][0]
    if not form:
        continue
    i = f"closed:numerals/{n}"
    d = {"id": i, "form": form, "kind": "word", "class": "G", "pos": "numeral", "gloss": en, "gloss_src": "closed",
         "ipa": ipa(form), "source": {"name": "closed"}}
    if n in num_para:
        d["paradigm"] = {"type": "pron", "g": num_para[n]}
    details[i] = d
    index.append([i, form, en, "G", "numeral", "", 0, 0])
for form, gloss in cc["particles"].items():
    if form.startswith("_") or "(Fortson" in gloss or "without laryngeal" in gloss:
        continue
    add_closed("particle:" + form, form, gloss, "particle")
for grp in ("interrogative_adv", "correlative_adv", "deictic_adv"):
    for en, forms in cc.get(grp, {}).items():
        if en.startswith("_") or not forms:
            continue
        add_closed(f"{grp}/{en}", forms[0], en.replace("_", " ") + ("?" if grp.startswith("interrogative") else ""), "adverb")

# ---------------------------------------------------------------------------------------------- reflex search
seen, rx = set(), []


def fold(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn" and ch.isalnum())


for i, d in details.items():
    for b in d.get("reflexes", []):
        if b["b"] == "Borrowed":
            continue
        for l in b["l"]:
            for f in l["forms"]:
                shown = f.get("r") or f["f"]
                key = fold(shown)
                if len(key) < 2 or (key, i) in seen:
                    continue
                seen.add((key, i))
                rx.append([key, shown.lstrip("*"), l["lang"], i])

# ---------------------------------------------------------------------------------------------- write
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "e").mkdir(exist_ok=True)
index.sort(key=lambda r: (fold(r[1]) or r[1]))
pos_of = {row[0]: k for k, row in enumerate(index)}
rx = sorted([k, s, lang, pos_of[i]] for k, s, lang, i in rx)          # reflex rows point at index positions
(OUT / "reflex.json").write_text(json.dumps(rx, ensure_ascii=False, separators=(",", ":")), "utf-8")
(OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), "utf-8")
by = defaultdict(dict)
for i, d in details.items():
    by[shard(i)][i] = {k: v for k, v in d.items() if v not in (None, "", [], {})}
for s in range(SHARDS):
    (OUT / f"e/{s:02d}.json").write_text(json.dumps(by.get(s, {}), ensure_ascii=False, separators=(",", ":")), "utf-8")
print("index", len(index), (OUT / "index.json").stat().st_size // 1024, "KB;",
      "shards", sum((OUT / f"e/{s:02d}.json").stat().st_size for s in range(SHARDS)) // 1024, "KB;",
      "with paradigm", sum(1 for d in details.values() if d.get("paradigm")),
      "examples", sum(1 for d in details.values() if d.get("examples")))
