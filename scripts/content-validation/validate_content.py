"""
Build and validate the shared medical content.

  * merges content/diseases_part*.json -> content/diseases.json
  * derives the relational structure–disease table -> content/relationships.json
  * validates that:
      - every structure's contentId has an anatomy entry
      - every reference key used anywhere exists in content/references.json
      - every association / connection / tour / animation target resolves to
        at least one real mesh (no label on an unrelated mesh)
      - disease ids are unique, required sections are present and non-empty
      - no disease claims a numeric prevalence/survival statistic (guard
        against invented figures: flags '%' and 'per 100' patterns)
Exit code 1 on failure.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / "content"

REQUIRED = [
    "id",
    "name",
    "category",
    "classification",
    "overview",
    "pathophysiology",
    "causes",
    "riskFactors",
    "regionsSummary",
    "symptoms",
    "progression",
    "diagnosis",
    "imaging",
    "treatments",
    "rehabilitation",
    "complications",
    "prognosis",
    "prevention",
    "faq",
    "associations",
    "references",
]
CATEGORIES = {
    "neurodegenerative",
    "cerebrovascular",
    "seizure",
    "demyelinating",
    "infectious",
    "neoplastic",
    "traumatic",
    "other",
}
ASSOC_TYPES = {"primary", "secondary", "subtype"}
EVIDENCE = {"established", "variable", "emerging"}
DISTRIB = {"diffuse", "regional", "focal", "scattered", "network"}


def main() -> int:
    errs: list[str] = []
    structures = json.loads((C / "structures.json").read_text())["structures"]
    anatomy = json.loads((C / "anatomy.json").read_text())["entries"]
    refs = json.loads((C / "references.json").read_text())["references"]
    diseases = []
    for p in sorted(C.glob("diseases_part*.json")):
        diseases += json.loads(p.read_text())

    by_id = {s["id"]: s for s in structures}
    children: dict[str, list[str]] = {}
    for s in structures:
        if s["parentId"]:
            children.setdefault(s["parentId"], []).append(s["id"])

    def meshes_of(sid: str) -> set[str]:
        s = by_id[sid]
        if s["kind"] == "mesh":
            return {sid}
        out: set[str] = set()
        for c in children.get(sid, []):
            out |= meshes_of(c)
        return out

    def resolve(target: str) -> set[str]:
        out: set[str] = set()
        for s in structures:
            if s["id"] == target or s["contentId"] == target:
                out |= meshes_of(s["id"])
        return out

    # anatomy coverage
    for s in structures:
        if s["contentId"] not in anatomy:
            errs.append(f"structure {s['id']}: no anatomy entry for contentId '{s['contentId']}'")
    for key, e in anatomy.items():
        for r in e.get("references", []):
            if r not in refs:
                errs.append(f"anatomy {key}: unknown reference '{r}'")
        for c in e.get("connections", []):
            if not resolve(c["to"]):
                errs.append(f"anatomy {key}: connection target '{c['to']}' resolves to no mesh")
        for f in ("summary", "beginner", "location", "description", "functions", "clinical"):
            if not e.get(f):
                errs.append(f"anatomy {key}: missing '{f}'")

    # diseases
    ids = [d["id"] for d in diseases]
    if len(ids) != len(set(ids)):
        errs.append("duplicate disease ids")
    stat = re.compile(r"\d+\s*%|\bper\s+100[,.]?000\b|\d+\s*out of\s*\d+", re.I)
    relationships = []
    for d in diseases:
        for f in REQUIRED:
            if f not in d or d[f] in ("", [], None):
                errs.append(f"disease {d.get('id')}: missing '{f}'")
        if d.get("category") not in CATEGORIES:
            errs.append(f"disease {d['id']}: bad category {d.get('category')}")
        for r in d.get("references", []):
            if r not in refs:
                errs.append(f"disease {d['id']}: unknown reference '{r}'")
        blob = json.dumps({k: v for k, v in d.items() if k not in ("references",)})
        for m in stat.finditer(blob):
            # allowed: genetic inheritance probability statement
            if "50% chance" in blob[max(0, m.start() - 5) : m.end() + 10]:
                continue
            errs.append(
                f"disease {d['id']}: numeric statistic '{m.group(0)}' — verify against a cited source or remove"
            )
        for a in d.get("associations", []):
            hits = resolve(a["target"])
            if not hits:
                errs.append(f"disease {d['id']}: association target '{a['target']}' resolves to no mesh")
            if a["type"] not in ASSOC_TYPES or a["evidence"] not in EVIDENCE or a["distribution"] not in DISTRIB:
                errs.append(f"disease {d['id']}: bad association enum in {a}")
            relationships.append(
                dict(
                    structureId=a["target"],
                    diseaseId=d["id"],
                    associationType=a["type"],
                    distribution=a["distribution"],
                    explanation=a["explanation"],
                    evidenceLevel=a["evidence"],
                    references=d["references"][:2],
                    resolvedMeshIds=sorted(hits),
                )
            )
        d.setdefault("lastReviewed", "2026-11-20")
        d.setdefault(
            "reviewStatus", "Draft — educational summary from cited sources; pending clinical reviewer sign-off."
        )

    # learning & animations
    learning = json.loads((C / "learning.json").read_text())["modules"]
    for m in learning:
        for i, st in enumerate(m["steps"]):
            for t in st.get("highlight", []) + st.get("hide", []):
                if not resolve(t):
                    errs.append(f"tour {m['id']} step {i}: target '{t}' resolves to no mesh")
            if st.get("disease") and st["disease"] not in ids:
                errs.append(f"tour {m['id']} step {i}: unknown disease {st['disease']}")
        for q in m.get("quiz", []):
            if not (0 <= q["answer"] < len(q["options"])):
                errs.append(f"tour {m['id']}: quiz answer index out of range")
    anims = json.loads((C / "animations.json").read_text())["animations"]
    for a in anims:
        if a["diseaseId"] not in ids:
            errs.append(f"animation for unknown disease {a['diseaseId']}")
        for i, st in enumerate(a["steps"]):
            for h in st.get("highlight", []):
                if not resolve(h["target"]):
                    errs.append(f"animation {a['diseaseId']} step {i}: '{h['target']}' resolves to no mesh")
            if st.get("lesion") and st["lesion"]["near"] not in by_id:
                errs.append(f"animation {a['diseaseId']} step {i}: lesion anchor unknown")

    if errs:
        print("CONTENT VALIDATION FAILED")
        for e in errs:
            print("  -", e)
        return 1
    (C / "diseases.json").write_text(
        json.dumps(dict(_meta=dict(lastReviewed="2026-11-20"), diseases=diseases), indent=2) + "\n"
    )
    (C / "relationships.json").write_text(json.dumps(dict(relationships=relationships), indent=2) + "\n")
    used = set()
    for d in diseases:
        used |= set(d["references"])
    for e in anatomy.values():
        used |= set(e.get("references", []))
    print(
        f"content OK: {len(anatomy)} anatomy entries, {len(diseases)} diseases, {len(relationships)} relationships, "
        f"{len(learning)} tours, {len(anims)} animations, {len(used)}/{len(refs)} references used"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
