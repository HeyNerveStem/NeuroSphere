"""Loads the shared, validated JSON content and seeds the relational database."""

from __future__ import annotations

import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import orm

ROOT = Path(__file__).resolve().parents[3]


def content_dir() -> Path:
    env = os.environ.get("NEUROSPHERE_CONTENT_DIR")
    if env:
        return Path(env)
    local = Path(__file__).resolve().parents[1] / "content"
    if (local / "structures.json").exists():
        return local
    return ROOT / "content"


def manifest_path() -> Path:
    env = os.environ.get("NEUROSPHERE_MANIFEST")
    if env:
        return Path(env)
    for p in (content_dir() / "model-manifest.json", ROOT / "assets" / "model-manifest.json"):
        if p.exists():
            return p
    raise FileNotFoundError("model-manifest.json not found")


FILES = ["structures.json", "anatomy.json", "diseases.json", "relationships.json", "references.json", "learning.json"]


@lru_cache(maxsize=1)
def load_all() -> dict:
    d = content_dir()
    data = {f.removesuffix(".json"): json.loads((d / f).read_text()) for f in FILES}
    data["manifest"] = json.loads(manifest_path().read_text())
    return data


def content_hash() -> str:
    h = hashlib.sha1()
    d = content_dir()
    for f in FILES:
        h.update((d / f).read_bytes())
    h.update(manifest_path().read_bytes())
    return h.hexdigest()[:16]


def seed(db: Session, force: bool = False) -> bool:
    """(Re)seed the database when the content hash changed. Returns True if seeded."""
    h = content_hash()
    current = db.get(orm.Meta, "content_hash")
    if current and current.value == h and not force:
        return False
    data = load_all()
    for model in (orm.StructureDiseaseRelationship, orm.Disease, orm.AnatomyContent, orm.Reference, orm.LearningModule):
        db.execute(delete(model))
    db.execute(delete(orm.Structure))
    db.flush()

    meshes = {m["meshName"]: m for m in data["manifest"]["meshes"]}
    # insert parents before children
    structures = data["structures"]["structures"]
    order = {s["id"]: i for i, s in enumerate(structures)}
    depth = {}

    def d(sid):
        if sid in depth:
            return depth[sid]
        p = next(x for x in structures if x["id"] == sid)["parentId"]
        depth[sid] = 0 if p is None else d(p) + 1
        return depth[sid]

    for s in sorted(structures, key=lambda s: (d(s["id"]), order[s["id"]])):
        m = meshes.get(s["id"])
        db.add(
            orm.Structure(
                id=s["id"],
                name=s["name"],
                parent_id=s["parentId"],
                kind=s["kind"],
                hemisphere=s["hemisphere"],
                content_id=s["contentId"],
                fma_id=s.get("fma"),
                layer=s.get("layer"),
                groups=s["groups"],
                synonyms=s["synonyms"],
                note=s.get("note"),
                original_position=m["originalPosition"] if m else None,
                label_anchor=m["labelAnchorLocal"] if m else None,
                explode_direction=m["explodeDirection"] if m else None,
                explode_weight=m["explodeWeight"] if m else None,
            )
        )
        db.flush()
    for cid, entry in data["anatomy"]["entries"].items():
        db.add(orm.AnatomyContent(content_id=cid, data=entry))
    for key, r in data["references"]["references"].items():
        db.add(orm.Reference(key=key, **{k: r[k] for k in ("title", "organization", "url", "type")}))
    for dz in data["diseases"]["diseases"]:
        db.add(
            orm.Disease(
                id=dz["id"],
                name=dz["name"],
                category=dz["category"],
                classification=dz["classification"],
                overview=dz["overview"],
                last_reviewed=dz["lastReviewed"],
                data=dz,
            )
        )
    db.flush()
    for r in data["relationships"]["relationships"]:
        db.add(
            orm.StructureDiseaseRelationship(
                target_id=r["structureId"],
                disease_id=r["diseaseId"],
                association_type=r["associationType"],
                distribution=r["distribution"],
                explanation=r["explanation"],
                evidence_level=r["evidenceLevel"],
                references=r["references"],
                resolved_mesh_ids=r["resolvedMeshIds"],
            )
        )
    for i, m in enumerate(data["learning"]["modules"]):
        db.add(orm.LearningModule(id=m["id"], title=m["title"], level=m["level"], position=i, data=m))
    if current:
        current.value = h
    else:
        db.add(orm.Meta(key="content_hash", value=h))
    db.commit()
    return True


def mesh_ids_of(db: Session, structure_id: str) -> list[str]:
    s = db.get(orm.Structure, structure_id)
    if not s:
        return []
    if s.kind == "mesh":
        return [s.id]
    out: list[str] = []
    for child in db.scalars(select(orm.Structure).where(orm.Structure.parent_id == structure_id)):
        out += mesh_ids_of(db, child.id)
    return out
