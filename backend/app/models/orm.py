"""Relational model: structures, diseases, structure–disease relationships, references, learning modules."""
from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Structure(Base):
    __tablename__ = "structures"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    parent_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("structures.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(10))  # mesh | group
    hemisphere: Mapped[str] = mapped_column(String(12))
    content_id: Mapped[str] = mapped_column(String(80), index=True)
    fma_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    layer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    groups: Mapped[list] = mapped_column(JSON, default=list)
    synonyms: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # geometry metadata from the validated model manifest (mesh structures only)
    original_position: Mapped[list | None] = mapped_column(JSON, nullable=True)
    label_anchor: Mapped[list | None] = mapped_column(JSON, nullable=True)
    explode_direction: Mapped[list | None] = mapped_column(JSON, nullable=True)
    explode_weight: Mapped[float | None] = mapped_column(nullable=True)


class AnatomyContent(Base):
    __tablename__ = "anatomy_content"
    content_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


class Disease(Base):
    __tablename__ = "diseases"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    classification: Mapped[str] = mapped_column(String(200))
    overview: Mapped[str] = mapped_column(Text)
    last_reviewed: Mapped[str] = mapped_column(String(10))
    data: Mapped[dict] = mapped_column(JSON)  # full validated page content
    relationships: Mapped[list[StructureDiseaseRelationship]] = relationship(back_populates="disease", cascade="all, delete-orphan")


class StructureDiseaseRelationship(Base):
    __tablename__ = "structure_disease_relationships"
    __table_args__ = (UniqueConstraint("target_id", "disease_id", "association_type"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_id: Mapped[str] = mapped_column(String(80), index=True)  # structure id, group id or contentId
    disease_id: Mapped[str] = mapped_column(String(80), ForeignKey("diseases.id"), index=True)
    association_type: Mapped[str] = mapped_column(String(12))
    distribution: Mapped[str] = mapped_column(String(12))
    explanation: Mapped[str] = mapped_column(Text)
    evidence_level: Mapped[str] = mapped_column(String(12))
    references: Mapped[list] = mapped_column(JSON, default=list)
    resolved_mesh_ids: Mapped[list] = mapped_column(JSON, default=list)
    disease: Mapped[Disease] = relationship(back_populates="relationships")


class Reference(Base):
    __tablename__ = "references"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    organization: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(120))


class LearningModule(Base):
    __tablename__ = "learning_modules"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    level: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class Meta(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
