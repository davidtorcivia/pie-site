"""The model page's figures (model.html), from the PIE repo's own records, read-only. Every number on the page's
figures comes from here; the sources are named beside each block.

    python3 -I tools/build_model_figures.py [/Users/david/AI/PIE]   -> data/model-figs.json
"""
import glob
import json
import sys
from pathlib import Path

PIE = Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/david/AI/PIE")
RUNS = Path("/Users/david/AI/pie-runs/rl/runs")
SITE = Path(__file__).resolve().parents[1]
jl = lambda p: [json.loads(l) for l in Path(p).read_text("utf-8").splitlines() if l.strip()]
out = {}

# benchmark v2 by segment (benchmarks/results/summary.json): the model of record against the best frontier runs
bench = {r["contestant"]: r for r in json.loads((PIE / "benchmarks/results/summary.json").read_text())}
SEG = [("inflection", "Inflection", 20), ("paradigm", "Paradigm", 15), ("en_pie", "English → PIE", 30),
       ("pie_en", "PIE → English", 20), ("dialogue", "Dialogue", 15)]
WHO = [("ours-nemotron35-e3-bf16", "Ours, Nemotron 3.5 Super, stage e3"), ("claude-opus-xhigh", "Claude Opus 5.5, xhigh"),
       ("codex-gpt-6.1-sol-high", "GPT-6.1 Sol, high")]
out["bench"] = {"segments": [{"id": k, "name": n, "weight": w} for k, n, w in SEG],
                "rows": [{"id": c, "name": name, "score": bench[c]["pie_score"],
                          "seg": {k: bench[c]["segments"][k] for k, _, _ in SEG}} for c, name in WHO]}
# every contestant's overall score, for the strict-vs-lenient gap
out["gap"] = sorted([{"id": c, "lenient": r["pie_score"]["lenient"], "strict": r["pie_score"]["strict"]}
                     for c, r in bench.items() if r.get("pie_score") and r["pie_score"].get("lenient") is not None],
                    key=lambda r: -r["lenient"])

# the corpus by tier (corpus/tier*/*.jsonl)
tiers = []
for t, name in [("tier1", "Tier 1, scholarly and formulaic"), ("tier2", "Tier 2, back-projection"),
                ("tier3", "Tier 3, composed through the engine"), ("tier3b", "Tier 3b, everyday speech")]:
    n = w = 0
    for f in glob.glob(str(PIE / f"corpus/{t}/*.jsonl")):
        for r in jl(f):
            n += 1; w += len((r.get("pie") or "").split())
    tiers.append({"tier": t, "name": name, "records": n, "words": w})
out["corpus"] = tiers

# the training export the model of record was trained from (export/chat/summary.json, commit 5b754f0)
ex = json.loads((PIE / "export/chat/summary.json").read_text())
out["export"] = {"commit": ex["provenance"]["commit"][:7], "train": ex["examples"]["train"], "eval": ex["examples"]["eval"],
                 "by_kind": sorted(ex["examples_by_kind"]["train"].items(), key=lambda kv: -kv[1])}

# the lexicon (data/lexicon/lexicon.jsonl and the side files)
lex = jl(PIE / "data/lexicon/lexicon.jsonl")
src = {}
for e in lex:
    src[e["source"]] = src.get(e["source"], 0) + 1
out["lexicon"] = {"entries": len(lex), "by_source": src,
                  "overrides": len(jl(PIE / "data/lexicon/overrides.jsonl")),
                  "confirmed_glosses": len(jl(PIE / "data/lexicon/confirmed_glosses.jsonl")),
                  "derived_glosses": len(jl(PIE / "data/lexicon/derived_glosses.jsonl")),
                  "project_reconstructions": len(jl(PIE / "data/lexicon/project_reconstructions.jsonl")),
                  "neologisms": len(jl(PIE / "data/lexicon/neologisms.jsonl"))}

# the engine against Wiktionary's tables, by class (docs/morphology.md, 2026-10-23 table)
out["engine_classes"] = [["thematic nouns", 1562, 1562], ["hysterokinetic nouns", 399, 399], ["proterokinetic nouns", 665, 666],
                         ["acrostatic nouns", 321, 323], ["amphikinetic nouns", 862, 882], ["thematic adjectives", 1990, 2004],
                         ["athematic adjectives", 482, 521]]

# the Nemotron 3.5 Super LR and optimizer sweep, held-out NLL at step 100 (docs/research/training-runs.md)
out["sweep"] = [["Dimuon 8e-3, r16", 0.280], ["AdamW 2e-4, r16", 0.285], ["Dimuon 4e-3, r16", 0.320],
                ["Dimuon 2e-3, r16", 0.429], ["Dimuon 2e-3, r32", 0.434], ["Dimuon 1e-3, r16", 0.607]]
# the three epochs of the full run: benchmark (summary.json) beside held-out NLL (training-runs.md)
out["epochs"] = [{"epoch": 1, "nll": 0.235, "train_nll": 0.20, **{k: bench["ours-nemotron35-e1-bf16"]["pie_score"][k] for k in ("lenient", "strict")}},
                 {"epoch": 2, "nll": 0.25, "train_nll": 0.04, **{k: bench["ours-nemotron35-e2"]["pie_score"][k] for k in ("lenient", "strict")}},
                 {"epoch": 3, "nll": 0.31, "train_nll": 0.006, **{k: bench["ours-nemotron35-e3-bf16"]["pie_score"][k] for k in ("lenient", "strict")}}]
# the line of models (summary.json): 35B epoch 3, the 35B merge, Nemotron epochs
out["models"] = [{"name": n, **bench[c]["pie_score"]} for c, n in [("ours-e3", "Qwen3.6-35B, e3"), ("ours-merge-half", "35B, merged RL"),
                 ("ours-nemotron35-e1-bf16", "Nemotron, e1"), ("ours-nemotron35-e2", "Nemotron, e2"), ("ours-nemotron35-e3-bf16", "Nemotron, e3")]]

# stage 8's training curve (runs/rl8-nemotron-vocab/metrics.jsonl)
m = [r for r in jl(RUNS / "rl8-nemotron-vocab/metrics.jsonl") if r.get("train_kl") is not None]
out["rl8_curve"] = [[int(r["iteration"]), round(r["train_kl"], 4), round(r["train_pie_rl_mean"], 3)] for r in m]


# the RL stages on the frozen sets (runs/*/eval/scores-*.json) and the vocabulary measures (rl-lessons.md tables)
def v1(run, c):
    p = RUNS / run / f"eval/scores-v1-{c}.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text())
    return {"chrF": round(d["summary"]["chrF"], 2), "en_pie": round(d["by_kind"]["translate_en_pie"]["chrf"], 1)}


def drills(run, c):
    p = RUNS / run / f"eval/scores-drills_v2-{c}.json"
    return round(json.loads(p.read_text())["summary"]["paradigm_cells"], 3) if p.exists() else None


out["stages"] = [
    {"name": "e3 (SFT)", **v1("rl8-nemotron-vocab", "base"), "cells": drills("rl6b-resume50", "base"), "never": None},
    {"name": "Stage 6 (rl6b)", **v1("rl6b-resume50", "final"), "cells": drills("rl6b-resume50", "final"), "never": 78},
    {"name": "Vocabulary pilot", **v1("vocab1-nemotron", "final"), "cells": drills("vocab1-nemotron", "final"), "never": 2},
    {"name": "Stage 8, step 100", **v1("rl8-nemotron-vocab", "0000100"), "cells": drills("rl8-nemotron-vocab", "0000100"), "never": 3},
    {"name": "Stage 8, final", **v1("rl8-nemotron-vocab", "final"), "cells": drills("rl8-nemotron-vocab", "final"), "never": 3},
]
(SITE / "data/model-figs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), "utf-8")
print("written", {k: (len(v) if isinstance(v, list) else "") for k, v in out.items()})
