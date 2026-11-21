# Architecture

```
            content/*.json  ◄── scripts/content-validation/validate_content.py (builds + validates)
                 │   ▲
                 │   └── scripts/model-optimization/structure_catalog.py (structure tree)
                 │
   ┌─────────────┼──────────────────────────────┐
   ▼             ▼                              ▼
frontend (bundled at build time)      backend (seeded into SQL at startup)
React + R3F viewer, works offline     FastAPI + SQLAlchemy, /api/*
   │                                            ▲
   └──── optional fetch /api/health, /api/diseases ┘

assets/source-models (BodyParts3D STL) ─► build_brain_glb.py ─► brain.glb + model-manifest.json
```

## Single source of truth
`content/` holds every fact the app shows: the structure tree (`structures.json`), anatomy entries keyed by `contentId` (`anatomy.json`), diseases (`diseases_part*.json` → merged `diseases.json`), derived structure–disease relationships (`relationships.json`), references, learning modules and disease animations. The frontend imports these at build time (so the viewer needs no server); the backend seeds the same files into relational tables, re-seeding automatically when the content hash changes.

## Frontend (`frontend/src`)
| Area | Files | Notes |
|---|---|---|
| 3D scene | `three/BrainScene.tsx` | Canvas, lights, Lightformer environment (no network HDRs), quality→DPR |
| Model | `three/BrainModel.tsx` | Loads meshopt GLB, converts each node to float geometry *relative to its validated centroid*, builds a BVH per mesh, one material per structure; selection/hover/highlight/x-ray/clip/opacity applied per mesh |
| Transform composition | `three/TransformManager.tsx` | Every frame: `position = original + explode(progress) + manual + lesionPush`, `rotation = manual`. The original is never mutated, so returns are exact |
| Manual dissection | `three/DissectionGizmo.tsx`, `stores/transformStore.ts` | TransformControls on a proxy pivot; deltas applied to manual offsets of all unlocked meshes in the selection; undo/redo snapshots; drei disables camera orbit while dragging; animation is paused before a drag starts |
| Exploded view | `lib/explode.ts`, `stores/animationStore.ts` | Pure, deterministic math (see `animation-system.md`) |
| Camera | `three/CameraController.tsx` | camera-controls (orbit/pan/dolly, smooth transitions), anatomical presets in LSA frame, focus via live bounding sphere; requests processed in the render loop so none are lost before mount |
| Labels | `three/LabelManager.tsx` + `components/viewer/Viewport.tsx` | DOM labels positioned from projected anchors each frame by direct style writes (no React renders), greedy priority-based overlap culling, back-facing/buried heuristics, leader line for the selection |
| State | `stores/*` | Zustand: `viewerStore` (selection, visibility, highlight, settings), `animationStore`, `transformStore` (mutable, non-reactive + version counter) |
| Knowledge | `lib/anatomy.ts`, `lib/search.ts`, `lib/diseaseViz.ts` | Target resolution (structure id / group id / contentId → meshes), scoped disease associations, unified search |
| Pages | `pages/*` | Home, AnatomyLab, DiseaseCatalog, DiseaseDetail, Learn, LearnModule, About, Settings — lazily loaded routes |

### Coordinate frame
+X = patient **left**, +Y = **superior**, +Z = **anterior** (right-handed LSA), 1 unit = 100 mm. `validate_model.py` checks orientation invariants (left structures have +X, frontal anterior to occipital, cerebellum posterior-inferior, medulla < pons < midbrain).

### Selection granularity
"Lobes & regions" resolves a clicked gyrus to its nearest `majorSelect` ancestor (e.g. *left superior frontal gyrus → left frontal lobe*); "Detailed parts" keeps the individual element. Nearly transparent or hidden meshes are click-through so internal structures stay selectable in x-ray mode.

### Disease association scoping
An association is shown on a structure if it targets that structure, something inside it, or a *regional* target (≤ 12 meshes, about one lobe on both sides) that overlaps it. Hemisphere-wide associations (e.g. metastases) are deliberately **not** pushed down onto small structures like the hippocampus. Same rule in `lib/anatomy.ts` and `backend/app/api/routes.py`.

## Backend (`backend/app`)
- `models/orm.py` — `structures` (self-referential tree + geometry metadata), `anatomy_content`, `diseases` (+ full JSON page), `structure_disease_relationships` (structure/group/contentId target, type, distribution, evidence, references, resolved mesh ids), `references`, `learning_modules`, `meta`.
- `api/routes.py` — documented REST endpoints with pagination/filters and 404/422 errors; OpenAPI at `/api/docs`.
- `services/content.py` — loads + hashes content, seeds the DB; `services/search.py` mirrors the frontend scoring.
- SQLite by default; any SQLAlchemy URL via `DATABASE_URL` (PostgreSQL-compatible JSON columns, no SQLite-specific SQL).

## Testing
- `scripts/model-validation/validate_model.py` — mesh ids, FMA mapping, finite transforms, unit explode vectors, anatomical orientation, label anchors inside bounds.
- `scripts/content-validation/validate_content.py` — anatomy coverage, reference keys, every target resolves to meshes, enums, and a guard that rejects unsourced numeric statistics.
- `frontend` — Vitest (explode math, stores, content integrity, search, InfoPanel/StructureTree components); Playwright acceptance tests 1–14 plus an API-integration test.
- `backend` — pytest API tests.
