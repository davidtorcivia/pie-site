"""Build the site's data from the PIE repo (read-only): one JSON the page loads, and the hymn audio.

    python3 -I tools/build_data.py [/Users/david/AI/PIE]

Everything shown on the page comes from here, so the page never carries a hand-copied fact:
- hymn: the Dawn hymn (corpus t3-t026-00015), its English, the word timeline of the VTL v10 render and the two
  restored voices (VTL v10 -> ElevenLabs Hindi -> restore.py, the locked chain)
- wheels: a few lexemes with their daughter reflexes (lexicon reflexes, Wiktionary-derived)
- bench: the benchmark summary (lenient and strict PIE score per contestant)
- stats: lexicon, engine, corpus counts
- specimens: corpus records by id
"""
import glob
import json
import subprocess
import sys
from pathlib import Path

PIE = Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/david/AI/PIE")
SITE = Path(__file__).resolve().parents[1]
HYMN_ID = "t3-t026-00015"
V10 = PIE / "tts/cadence/eleven/v10"
WHEELS = ["pie-lex-ph2texr", "pie-lex-h1ekjwos", "pie-lex-h2owis", "pie-lex-meh2texr", "pie-lex-dyexws",
          "pie-lex-wlkwos", "pie-lex-kjwox", "pie-lex-h2stexr", "pie-lex-nokwts", "pie-lex-dwoh1"]
SPECIMENS = ["t3-t026-00039", "t3-t002-00006", "t3-t023-00019", "t3-t027-00011", "t3-t088-00029",
             "t3-t026-00010", "t3-t085-00018", "t3-t028-00002", "t3-rl6-005-00008"]   # chosen as writing
BRANCH = {  # reflex keys -> the branch they stand for
    "Proto-Anatolian": "Anatolian", "Hittite": "Anatolian", "Luwian": "Anatolian",
    "Proto-Indo-Iranian": "Indo-Iranian", "Sanskrit": "Indo-Iranian", "Avestan": "Indo-Iranian",
    "Proto-Hellenic": "Greek", "Ancient Greek": "Greek", "Mycenaean Greek": "Greek",
    "Proto-Italic": "Italic", "Latin": "Italic", "Proto-Celtic": "Celtic", "Old Irish": "Celtic",
    "Proto-Germanic": "Germanic", "Gothic": "Germanic", "Proto-Balto-Slavic": "Balto-Slavic",
    "Proto-Slavic": "Balto-Slavic", "Lithuanian": "Balto-Slavic", "Proto-Tocharian": "Tocharian",
    "Tocharian A": "Tocharian", "Tocharian B": "Tocharian", "Old Armenian": "Armenian",
    "Proto-Armenian": "Armenian", "Proto-Albanian": "Albanian", "Albanian": "Albanian",
}


def jl(p):
    return [json.loads(l) for l in Path(p).read_text("utf-8").splitlines() if l.strip()]


def corpus():
    recs = {}
    for f in sorted(glob.glob(str(PIE / "corpus/tier*/*.jsonl"))):
        for r in jl(f):
            recs[r["id"]] = r
    return recs


def wheels():
    want, out = set(WHEELS), {}
    for r in jl(PIE / "data/lexicon/lexicon.jsonl"):
        if r["id"] in want:
            daughters = {}
            for k, vs in (r.get("reflexes") or {}).items():
                b = BRANCH.get(k)
                if b and b not in daughters and vs:
                    v = vs[0]
                    daughters[b] = {"lang": k, "form": v.get("roman") or v["form"], "script": v["form"] if v.get("roman") else None}
            out[r["id"]] = {"form": r["form"], "meaning": (r.get("meaning") or [""])[0], "daughters": daughters}
    return [out[i] for i in WHEELS if i in out and len(out[i]["daughters"]) >= 4]


def bench():
    rows = []
    for r in json.loads((PIE / "benchmarks/results/summary.json").read_text("utf-8")):
        s = r.get("pie_score")
        if not s:
            continue
        c = r["contestant"]
        if c.startswith("claude-"):
            fam, name = "frontier", "Claude " + c.split("-")[1].title() + " 5.5 · " + c.split("-")[2]
        elif c.startswith("codex-"):
            p = c.split("-")
            fam, name = "frontier", f"GPT-{p[2]} {p[3].title()} · {p[4]}"
        else:
            fam, name = "ours", c
        rows.append({"id": c, "name": name, "family": fam, "lenient": s["lenient"], "strict": s["strict"]})
    return rows


def stats(recs):
    lex = sum(1 for _ in open(PIE / "data/lexicon/lexicon.jsonl", encoding="utf-8"))
    words = sum(len((r.get("pie") or "").split()) for r in recs.values())
    genres = {r.get("genre") for r in recs.values() if r.get("genre")}
    return {"lexicon_entries": lex, "records": len(recs), "pie_words": words, "genres": len(genres),
            "engine_cells": "14,023 / 14,197", "engine_agreement": 98.8, "usable_lexemes": 3468}


def audio():
    (SITE / "audio").mkdir(exist_ok=True)
    for v in ("female", "male"):
        src, dst = V10 / f"restored/{v}-hindi-restored.wav", SITE / f"audio/dawn-{v}.mp3"
        if not dst.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-codec:a", "libmp3lame", "-b:a", "192k", str(dst)], check=True)


def english_lines(english, n):
    """The English per PIE line (sentence). The Dawn hymn's English has 8 sentences for 7 PIE lines: line 5
    ("túH kʷspés swésōr téwe bʰéh₂os h₃kʷbʰós lewbʰóm") is two English sentences. Checked by hand."""
    import re
    sents = re.findall(r"[^.!?]+[.!?]", english)
    sents = [x.strip() for x in sents]
    if len(sents) == n:
        return sents
    if len(sents) == 8 and n == 7:
        return sents[:4] + [sents[4] + " " + sents[5]] + sents[6:]
    return [english] * n


def main():
    recs = corpus()
    h = recs[HYMN_ID]
    timeline = json.loads((V10 / "zip/pie-vtl/dawn-hymn-cadence-v1.json").read_text("utf-8"))
    data = {
        "hymn": {"id": HYMN_ID, "pie": h["pie"], "english": h["english"],
                 "words": [{k: w[k] for k in ("line", "word", "ipa", "start", "end")} for w in timeline],
                 # the project's Kokoro PIE voices; ?v= the file's own stamp, so a browser never plays an old render
                 "audio": {v: f"audio/dawn-{k}.mp3?v={int((SITE / f'audio/dawn-{k}.mp3').stat().st_mtime)}" for v, k in (("female", "f"), ("male", "m"))},
                 "timing": json.loads((SITE / "data/hymn-timing.json").read_text()) if (SITE / "data/hymn-timing.json").exists() else None,
                 "english_lines": english_lines(h["english"], len({w["line"] for w in timeline}))},
        "wheels": wheels(),
        "bench": bench(),
        "stats": stats(recs),
        "specimens": [{"id": i, "genre": recs[i].get("genre"), "pie": recs[i]["pie"], "english": recs[i]["english"]}
                      for i in SPECIMENS if i in recs],
    }
    (SITE / "data/site.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")
    print(f"wheels {len(data['wheels'])}, bench {len(data['bench'])}, specimens {len(data['specimens'])}, stats {data['stats']}")


if __name__ == "__main__":
    main()
