"""Unified search across structures, diseases, symptoms and learning modules (same scoring as the frontend)."""

from __future__ import annotations

import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import orm


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if not unicodedata.combining(c)).replace("'", "").replace("’", "")


def score_text(q: str, text: str, weight: float) -> float:
    t = norm(text or "")
    if not t:
        return 0
    if t == q:
        return weight * 2.5
    if t.startswith(q):
        return weight * 1.8
    if q in t:
        return weight * 1.2
    toks = q.split()
    if len(toks) > 1 and all(tok in t for tok in toks):
        return weight
    return 0


def search(db: Session, query: str, limit: int = 10) -> dict:
    q = norm(query.strip())
    out = {"structures": [], "diseases": [], "modules": [], "symptoms": []}
    if not q:
        return out
    anatomy = {a.content_id: a.data for a in db.scalars(select(orm.AnatomyContent))}
    for s in db.scalars(select(orm.Structure)):
        best, match = 0.0, ""
        cands = [(score_text(q, s.name, 50), "Region" if s.kind == "group" else "Structure")]
        cands += [(score_text(q, syn, 38), f"Synonym: {syn}") for syn in s.synonyms]
        cands += [(score_text(q, g.replace("-", " "), 18), f"Group: {g}") for g in s.groups]
        a = anatomy.get(s.content_id)
        if a:
            cands += [(score_text(q, f, 16), f"Function: {f}") for f in a["functions"]]
            cands.append((score_text(q, a["summary"], 8), "Mentioned in description"))
        for sc, why in cands:
            if sc > best:
                best, match = sc, why
        if best:
            bias = (2 if s.kind == "group" else 0) + (-0.5 if s.hemisphere == "right" else 0)
            out["structures"].append(
                {"id": s.id, "name": s.name, "type": "structure", "score": best + bias, "match": match}
            )
    symptoms: dict[str, list[str]] = {}
    for d in db.scalars(select(orm.Disease)):
        data = d.data
        best, match = 0.0, ""
        cands = [(score_text(q, d.name, 50), d.classification)]
        cands += [(score_text(q, s, 40), f"Also called {s}") for s in data["synonyms"]]
        cands += [(score_text(q, s, 18), f"Symptom: {s}") for s in data["symptoms"]]
        cands.append((score_text(q, data["regionsSummary"], 10), "Brain regions involved"))
        cands.append((score_text(q, d.overview, 8), "Mentioned in overview"))
        for sc, why in cands:
            if sc > best:
                best, match = sc, why
        if best:
            out["diseases"].append({"id": d.id, "name": d.name, "type": "disease", "score": best, "match": match})
        if len(q) >= 3:
            for s in data["symptoms"]:
                if q in norm(s):
                    symptoms.setdefault(s, []).append(d.name)
    for m in db.scalars(select(orm.LearningModule)):
        sc = max(
            [score_text(q, m.title, 40), score_text(q, m.data["summary"], 15)]
            + [score_text(q, st["text"], 6) for st in m.data["steps"]]
        )
        if sc:
            out["modules"].append(
                {"id": m.id, "name": m.title, "type": "module", "score": sc, "match": m.data["summary"]}
            )
    out["symptoms"] = [
        {"id": k, "name": k, "type": "symptom", "score": 10.0, "match": "Seen in: " + ", ".join(v)}
        for k, v in list(symptoms.items())[:8]
    ]
    for k in ("structures", "diseases", "modules"):
        out[k] = sorted(out[k], key=lambda h: (-h["score"], h["name"]))[:limit]
    return out
