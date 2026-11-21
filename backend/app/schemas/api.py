"""Pydantic schemas mirroring frontend/src/types/index.ts."""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

Hemisphere = Literal["left", "right", "bilateral", "midline"]
AssociationType = Literal["primary", "secondary", "subtype"]
Distribution = Literal["diffuse", "regional", "focal", "scattered", "network"]
Evidence = Literal["established", "variable", "emerging"]
Category = Literal[
    "neurodegenerative", "cerebrovascular", "seizure", "demyelinating", "infectious", "neoplastic", "traumatic", "other"
]


class Page(BaseModel, Generic[T]):
    total: int
    limit: int
    offset: int
    items: list[T]


class ReferenceOut(BaseModel):
    key: str
    title: str
    organization: str
    url: str
    type: str


class Connection(BaseModel):
    to: str
    text: str


class AnatomyEntry(BaseModel):
    summary: str
    beginner: str
    location: str
    description: str
    functions: list[str]
    connections: list[Connection]
    clinical: str
    lateralization: str | None = None
    references: list[str]


class StructureSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str
    parentId: str | None
    kind: Literal["mesh", "group"]
    hemisphere: Hemisphere
    anatomicalGroup: list[str] = Field(description="Functional/anatomical group tags")
    contentId: str


class StructureDetail(StructureSummary):
    synonyms: list[str]
    fmaId: str | None
    layer: int | None
    note: str | None
    modelMeshIds: list[str]
    originalPosition: list[float] | None
    labelAnchor: list[float] | None
    explodeDirection: list[float] | None
    explodeWeight: float | None
    content: AnatomyEntry | None
    references: list[ReferenceOut]
    relatedDiseaseIds: list[str]


class GroupOut(BaseModel):
    id: str
    name: str
    count: int


class Association(BaseModel):
    target: str
    type: AssociationType
    distribution: Distribution
    evidence: Evidence
    explanation: str


class RelationshipOut(BaseModel):
    structureId: str
    diseaseId: str
    associationType: AssociationType
    distribution: Distribution
    explanation: str
    evidenceLevel: Evidence
    references: list[str]
    resolvedMeshIds: list[str]


class DiseaseSummary(BaseModel):
    id: str
    name: str
    category: Category
    classification: str
    overview: str


class FAQ(BaseModel):
    q: str
    a: str


class DiseaseDetail(DiseaseSummary):
    synonyms: list[str]
    pathophysiology: str
    causes: str
    riskFactors: list[str]
    regionsSummary: str
    symptoms: list[str]
    progression: str
    diagnosis: list[str]
    imaging: str
    treatments: list[str]
    rehabilitation: str
    complications: list[str]
    prognosis: str
    prevention: str
    emergingResearch: str | None = None
    faq: list[FAQ]
    associations: list[Association]
    references: list[str]
    lastReviewed: str
    reviewStatus: str


class SearchHit(BaseModel):
    id: str
    name: str
    type: Literal["structure", "disease", "module", "symptom"]
    score: float
    match: str


class SearchResults(BaseModel):
    query: str
    structures: list[SearchHit]
    diseases: list[SearchHit]
    modules: list[SearchHit]
    symptoms: list[SearchHit]


class ModuleSummary(BaseModel):
    id: str
    title: str
    level: Literal["beginner", "intermediate", "advanced"]
    minutes: int
    summary: str
    steps: int


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    database: str
    contentHash: str
    counts: dict[str, int]
