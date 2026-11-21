"""REST endpoints (OpenAPI docs at /api/docs)."""
from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import __version__
from app.database.session import get_db
from app.models import orm
from app.schemas import api as S
from app.services.content import content_hash, mesh_ids_of
from app.services.search import search as run_search

router = APIRouter(prefix="/api")
MAX_INHERITED_SCOPE = 12
DB = Annotated[Session, Depends(get_db)]
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]


def _not_found(kind: str, id: str):
    raise HTTPException(status_code=404, detail=f"{kind} '{id}' not found")


def _structure_summary(s: orm.Structure) -> S.StructureSummary:
    return S.StructureSummary(id=s.id, name=s.name, parentId=s.parent_id, kind=s.kind, hemisphere=s.hemisphere,
                              anatomicalGroup=s.groups, contentId=s.content_id)


def _relationships_for(db: Session, s: orm.Structure) -> list[orm.StructureDiseaseRelationship]:
    meshes = set(mesh_ids_of(db, s.id))
    rels = db.scalars(select(orm.StructureDiseaseRelationship)).all()
    out = []
    for r in rels:
        rm = set(r.resolved_mesh_ids)
        # same scoping rule as the frontend: specific-or-equal, or regional (<= lobe-sized) overlap
        if r.target_id in (s.id, s.content_id) or rm <= meshes or (rm & meshes and len(rm) <= MAX_INHERITED_SCOPE):
            out.append(r)
    return out


# ---------------------------------------------------------------- system
@router.get("/health", response_model=S.Health, tags=["system"])
def health(db: DB):
    db.execute(select(1))
    counts = {
        "structures": db.scalar(select(func.count()).select_from(orm.Structure)) or 0,
        "diseases": db.scalar(select(func.count()).select_from(orm.Disease)) or 0,
        "relationships": db.scalar(select(func.count()).select_from(orm.StructureDiseaseRelationship)) or 0,
        "modules": db.scalar(select(func.count()).select_from(orm.LearningModule)) or 0,
    }
    return S.Health(status="ok", version=__version__, database=db.bind.dialect.name, contentHash=content_hash(), counts=counts)


# ---------------------------------------------------------------- anatomy
@router.get("/anatomy/structures", response_model=S.Page[S.StructureSummary], tags=["anatomy"])
def list_structures(
    db: DB,
    limit: Limit = 200,
    offset: Offset = 0,
    kind: Literal["mesh", "group"] | None = None,
    group: str | None = Query(None, description="anatomical group tag, e.g. cortex, limbic, brainstem"),
    hemisphere: Literal["left", "right", "bilateral", "midline"] | None = None,
    parent: str | None = None,
    q: str | None = None,
):
    stmt = select(orm.Structure)
    if kind:
        stmt = stmt.where(orm.Structure.kind == kind)
    if hemisphere:
        stmt = stmt.where(orm.Structure.hemisphere == hemisphere)
    if parent:
        stmt = stmt.where(orm.Structure.parent_id == parent)
    if q:
        stmt = stmt.where(or_(orm.Structure.name.ilike(f"%{q}%"), orm.Structure.content_id.ilike(f"%{q}%")))
    items = db.scalars(stmt.order_by(orm.Structure.name)).all()
    if group:
        items = [s for s in items if group in s.groups]
    return S.Page(total=len(items), limit=limit, offset=offset, items=[_structure_summary(s) for s in items[offset:offset + limit]])


@router.get("/anatomy/structures/{structure_id}", response_model=S.StructureDetail, tags=["anatomy"])
def get_structure(structure_id: str, db: DB):
    s = db.get(orm.Structure, structure_id) or _not_found("structure", structure_id)
    content = db.get(orm.AnatomyContent, s.content_id)
    refs = [db.get(orm.Reference, k) for k in (content.data["references"] if content else [])]
    rels = _relationships_for(db, s)
    return S.StructureDetail(
        **_structure_summary(s).model_dump(), synonyms=s.synonyms, fmaId=s.fma_id, layer=s.layer, note=s.note,
        modelMeshIds=mesh_ids_of(db, s.id), originalPosition=s.original_position, labelAnchor=s.label_anchor,
        explodeDirection=s.explode_direction, explodeWeight=s.explode_weight,
        content=S.AnatomyEntry(**content.data) if content else None,
        references=[S.ReferenceOut(key=r.key, title=r.title, organization=r.organization, url=r.url, type=r.type) for r in refs if r],
        relatedDiseaseIds=sorted({r.disease_id for r in rels}),
    )


@router.get("/anatomy/structures/{structure_id}/diseases", response_model=list[S.RelationshipOut], tags=["anatomy"])
def structure_diseases(structure_id: str, db: DB):
    s = db.get(orm.Structure, structure_id) or _not_found("structure", structure_id)
    return [_rel_out(r) for r in _relationships_for(db, s)]


@router.get("/anatomy/groups", response_model=list[S.GroupOut], tags=["anatomy"])
def anatomy_groups(db: DB):
    counts: dict[str, int] = {}
    for s in db.scalars(select(orm.Structure).where(orm.Structure.kind == "mesh")):
        for g in s.groups:
            counts[g] = counts.get(g, 0) + 1
    return [S.GroupOut(id=g, name=g.replace("-", " ").title(), count=n) for g, n in sorted(counts.items())]


# ---------------------------------------------------------------- diseases
def _rel_out(r: orm.StructureDiseaseRelationship) -> S.RelationshipOut:
    return S.RelationshipOut(structureId=r.target_id, diseaseId=r.disease_id, associationType=r.association_type,
                             distribution=r.distribution, explanation=r.explanation, evidenceLevel=r.evidence_level,
                             references=r.references, resolvedMeshIds=r.resolved_mesh_ids)


@router.get("/diseases", response_model=S.Page[S.DiseaseSummary], tags=["diseases"])
def list_diseases(db: DB, limit: Limit = 50, offset: Offset = 0, category: S.Category | None = None, q: str | None = None):
    stmt = select(orm.Disease)
    if category:
        stmt = stmt.where(orm.Disease.category == category)
    if q:
        stmt = stmt.where(or_(orm.Disease.name.ilike(f"%{q}%"), orm.Disease.overview.ilike(f"%{q}%")))
    items = db.scalars(stmt.order_by(orm.Disease.category, orm.Disease.name)).all()
    return S.Page(total=len(items), limit=limit, offset=offset, items=[
        S.DiseaseSummary(id=d.id, name=d.name, category=d.category, classification=d.classification, overview=d.overview)
        for d in items[offset:offset + limit]
    ])


@router.get("/diseases/{disease_id}", response_model=S.DiseaseDetail, tags=["diseases"])
def get_disease(disease_id: str, db: DB):
    d = db.get(orm.Disease, disease_id) or _not_found("disease", disease_id)
    return S.DiseaseDetail(**d.data)


@router.get("/diseases/{disease_id}/structures", response_model=list[S.RelationshipOut], tags=["diseases"])
def disease_structures(disease_id: str, db: DB):
    d = db.get(orm.Disease, disease_id) or _not_found("disease", disease_id)
    return [_rel_out(r) for r in d.relationships]


# ---------------------------------------------------------------- search
@router.get("/search", response_model=S.SearchResults, tags=["search"])
def search(db: DB, q: Annotated[str, Query(min_length=1, max_length=120)], limit: Annotated[int, Query(ge=1, le=50)] = 10):
    return S.SearchResults(query=q, **run_search(db, q, limit))


# ---------------------------------------------------------------- learning
@router.get("/learning/modules", response_model=list[S.ModuleSummary], tags=["learning"])
def list_modules(db: DB, level: Literal["beginner", "intermediate", "advanced"] | None = None):
    stmt = select(orm.LearningModule).order_by(orm.LearningModule.position)
    if level:
        stmt = stmt.where(orm.LearningModule.level == level)
    return [S.ModuleSummary(id=m.id, title=m.title, level=m.level, minutes=m.data["minutes"], summary=m.data["summary"],
                            steps=len(m.data["steps"])) for m in db.scalars(stmt)]


@router.get("/learning/modules/{module_id}", tags=["learning"])
def get_module(module_id: str, db: DB) -> dict:
    m = db.get(orm.LearningModule, module_id) or _not_found("module", module_id)
    return m.data
