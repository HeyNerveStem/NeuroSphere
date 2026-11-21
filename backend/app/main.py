"""NeuroSphere 3D content API.

Run:  uvicorn app.main:app --reload --port 8000     (from backend/)
Docs: http://127.0.0.1:8000/api/docs
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import router
from app.database.session import Base, SessionLocal, engine
from app.services.content import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(
    title="NeuroSphere 3D API",
    version=__version__,
    description="Content delivery and search for the NeuroSphere 3D educational brain atlas. "
                "Educational use only — not for diagnosis or treatment decisions.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",")],
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(router)
