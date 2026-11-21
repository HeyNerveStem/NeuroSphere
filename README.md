# NeuroSphere 3D

NeuroSphere 3D – Interactive Brain Anatomy Lab (full-stack web, 3D visualization). NeuroSphere 3D lets users rotate, slice and explore a real segmented human brain model, learn each structure's function, follow guided lessons with quizzes, and see how neurological diseases relate to specific regions.

> **Medical disclaimer.** NeuroSphere 3D is intended for anatomy and neuroscience education. It does not provide medical diagnosis, personalized treatment recommendations, or emergency medical services.

**What it does**
- **Real segmented model:** 86 independently selectable brain structures from the peer-reviewed BodyParts3D database (CC BY-SA 2.1 JP). Structures the asset does not contain are listed as *unavailable*. None are faked.
- **Anatomy Lab:** orbit, pan, zoom and double-click to focus. Nine anatomical camera presets, including sagittal, coronal and axial section planes. You can also use X-ray cortex, hide/isolate/opacity per structure, realistic or region colours, and an orientation widget. Labels follow the 3D anchors, avoid overlapping each other, and show a leader line for the selected structure.
- **Manual dissection:** select a structure, then move or rotate it with a 3D gizmo. Snapping, lock, undo/redo, return-to-original and reassemble-all are supported. Camera orbiting is disabled while you drag.
- **Exploded view:** four modes (complete, layer-by-layer, selected region, guided with captions). Every position is deterministic. Controls include play/pause/reverse/restart, step, a scrubbable timeline, speeds from 0.25× to 2×, and an explosion-distance slider.
- **Information panel:** overview, description, functions, connections (with a "show connected regions" button), clinical significance, related conditions (with association type and evidence), and references. The depth adapts to beginner, intermediate or advanced level.
- **Disease Explorer:** 34 conditions in 8 clinical categories. Each page has 18 sections, scoped structure–disease associations, a "Highlight affected regions" button in an embedded viewer, and 7 schematic animations. Multiple sclerosis uses a separate axon/myelin animation.
- **Guided learning:** 10 tours that drive the same viewer, with progress tracking, optional narration and quizzes.
- **Unified search** across structures, synonyms, functions, diseases, symptoms and lessons.
- **FastAPI backend** (SQLAlchemy, SQLite, PostgreSQL-compatible). The viewer and all content also work fully offline.

## Quick start
Requirements: Node 20+ and Python 3.11+.

```bash
# backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000          # API docs: http://127.0.0.1:8000/api/docs

# frontend (second terminal)
cd frontend
npm install
npm run dev                                         # http://localhost:5173 (proxies /api → :8000)
```
The repository ships the processed model (`frontend/public/models/brain.glb`), so you do not need Blender or the source STLs to run the app.

## Commands
| Task | Command |
|---|---|
| Frontend dev server | `cd frontend && npm run dev` |
| Backend dev server | `cd backend && uvicorn app.main:app --reload --port 8000` |
| Production build | `cd frontend && npm run build` (or `npm run build:demo` for a static offline build with hash routing) |
| Typecheck / lint | `npm run typecheck` · `npm run lint` |
| Unit tests | `cd frontend && npm test` · `cd backend && python3 -m pytest -q` |
| Browser acceptance tests | `cd frontend && npm run build && npx playwright test` (uses system Chrome; set `E2E_CHANNEL=chromium` after `npx playwright install chromium`) |
| Validate content | `python3 scripts/content-validation/validate_content.py` |
| Rebuild model from source | `scripts/model-optimization/fetch_bodyparts3d.sh && scripts/model-optimization/build_model.sh` |
| Validate model | `python3 scripts/model-validation/validate_model.py` |

Deployment is covered in [docs/deployment.md](docs/deployment.md).

## Project layout
```
neurosphere-3d/
├── frontend/                 React + TypeScript + Vite + Tailwind + R3F
│   ├── public/models/brain.glb
│   ├── src/three/            BrainScene, BrainModel (meshes, materials, picking),
│   │                         TransformManager (authoritative transforms + explode),
│   │                         CameraController, DissectionGizmo, LabelManager
│   ├── src/components/       layout · anatomy · viewer · animation · diseases · learning · ui
│   ├── src/stores/           viewerStore · animationStore · transformStore (Zustand)
│   ├── src/lib/              anatomy index, deterministic explode math, search, disease viz
│   ├── src/pages/            Home, AnatomyLab, DiseaseCatalog/Detail, Learn/Module, About, Settings
│   └── e2e/                  Playwright acceptance tests
├── backend/app/              FastAPI: api/ models/ schemas/ services/ database/
├── content/                  single source of truth (structures, anatomy, diseases, relationships,
│                             references, learning modules, animations)
├── assets/                   model-manifest.json, processed-models/, licenses/, attribution/
├── scripts/                  model-optimization/ model-validation/ content-validation/ dev/
└── docs/                     architecture, anatomy-assets, medical-content-sources,
                              animation-system, deployment
```
The spec's `SelectionManager` and `ExplodedViewController` are merged into `BrainModel` (picking) and `TransformManager` (composition), so there is only one writer of mesh transforms. See [docs/architecture.md](docs/architecture.md).

## Routes
`/` · `/anatomy` · `/anatomy/:structureId` (deep link with camera focus) · `/diseases` · `/diseases/:diseaseId` · `/learn` · `/learn/:moduleId` · `/about` · `/settings`

API: `GET /api/health`, `/api/anatomy/structures` (filters: kind, group, hemisphere, parent, q; pagination), `/api/anatomy/structures/{id}`, `/api/anatomy/structures/{id}/diseases`, `/api/anatomy/groups`, `/api/diseases` (category, q, pagination), `/api/diseases/{id}`, `/api/diseases/{id}/structures`, `/api/search?q=`, `/api/learning/modules`, `/api/learning/modules/{id}`.

## Feature verification checklist
Checked in this build. ✅ = automated test passing.

| # | Acceptance scenario | Status |
|---|---|---|
| 1 | Rotate the brain with the mouse | ✅ Playwright |
| 2 | Click left frontal lobe: correct highlight and info | ✅ Playwright (real click on rendered mesh) |
| 3 | Drag cerebellum away; rest stays put | ✅ Playwright (real gizmo drag) |
| 4 | Return to original: exact transform | ✅ Playwright + unit test (offset exactly 0) |
| 5 | Disassemble all: readable exploded arrangement | ✅ Playwright (all 86 moved), visually reviewed |
| 6 | Scrub to 50%: deterministic state | ✅ Playwright + unit tests |
| 7 | Pause and reverse without jumps | ✅ Playwright (monotonic, bounded steps) |
| 8 | Hippocampus information | ✅ Playwright + component test |
| 9 | Alzheimer's disease page | ✅ Playwright |
| 10 | Highlight affected regions | ✅ Playwright |
| 11 | Search "cerebellum": result and camera focus | ✅ Playwright |
| 12 | Reset all | ✅ Playwright |
| 13 | Mobile viewport | ✅ Playwright (390×844, touch) |
| 14 | No fabricated sources | ✅ Playwright + content validator + unit tests |
| — | Frontend ↔ backend communication | ✅ Playwright integration test + 12 pytest API tests |

Totals: 34 Vitest unit/component tests, 12 pytest API tests, 11 Playwright browser tests (covering all 14 scenarios plus API integration), plus the model and content validators.

## Performance
| Metric | Value |
|---|---|
| Model | 86 meshes, 336,520 triangles, **1.66 MB** GLB (meshopt) |
| JS transferred (Anatomy Lab) | ≈ 495 KB gzipped (three/R3F ≈ 310 KB) |
| Time to model ready (local server, headless Chrome) | ≈ 3.0 s |
| JS heap | ≈ 35 MB |
| Frame time, **software rendering** (SwiftShader, no GPU), 1280×800 | High ≈ 600 ms/frame · Low ≈ 160 ms/frame |

The frame times come from a CPU-only software renderer, which is the worst case. They are **not** representative of real devices, and GPU frame rates have not been measured yet. The quality selector (Low, Medium, High, Ultra) caps the device pixel ratio and toggles antialiasing. Per-frame work runs outside React renders.

## Asset and license attribution
- **3D anatomy:** "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan". Mitsuhashi N, et al. *Nucleic Acids Res.* 2009;37:D782-5, doi:10.1093/nar/gkn613. The processed GLB is a derivative under the same license. Details: [assets/attribution/ATTRIBUTION.md](assets/attribution/ATTRIBUTION.md).
- **Medical references:** NINDS, MedlinePlus, NCBI Bookshelf, PubMed Central, OpenStax, American Cancer Society and Cleveland Clinic. Every URL was confirmed before inclusion. See [docs/medical-content-sources.md](docs/medical-content-sources.md).

## Known limitations
1. **Not clinically reviewed.** All anatomy and disease text is marked *Draft* until a qualified clinician or neuroanatomist signs it off.
2. **Asset coverage.** The asset does not separate the cerebellar hemispheres or vermis. It has no inferior frontal gyrus (which leaves a visible gap on the lateral frontal surface), no separate substantia nigra or nucleus accumbens, no medial occipital subdivisions, no cranial nerves III–XII and no tractography. These are shown as unavailable in the UI.
3. Single adult male surface model, not an MRI atlas. Disease highlights are schematic regional associations: whole meshes are coloured even when the pathology is focal or microscopic. This is labelled in the UI.
4. Label occlusion uses heuristics (back-facing and buried tests), not per-frame raycasts. Some labels can still overlap geometry.
5. GPU performance has not been measured on real hardware. Only software-renderer numbers exist (see above).
6. PostgreSQL support is by design (portable SQLAlchemy types) but has not been tested against a live server. No Docker images are provided.
7. Narration uses the browser's speech synthesis. Quiz progress is stored in the browser only (no accounts or bookmarks yet).
8. No Blender step was needed. The pipeline is scripted in Python (trimesh, fast-simplification) plus gltf-transform. LOD variants are not generated yet; the "Low" quality setting reduces resolution only.

## Future improvements
- Integrate CIT168 or Harvard-Oxford subcortical labels (substantia nigra, accumbens, subthalamic nucleus) and a cerebellar lobule atlas, registered to the BodyParts3D frame.
- Add a cortical parcellation (Desikan-Killiany) to fill the inferior frontal gyrus and medial occipital regions.
- Tractography tubes (e.g. HCP-842) and a cranial-nerve set.
- Clinician review workflow in the UI, user accounts, bookmarks and server-side progress.
- LOD meshes, KTX2 textures, and GPU performance profiling on reference devices.

## License
- **Code** (frontend, backend, scripts): MIT — see [LICENSE](LICENSE).
- **3D brain model** (`frontend/public/models/brain.glb`, `assets/processed-models/`, `assets/model-manifest.json`): derived from BodyParts3D and distributed under **CC BY-SA 2.1 JP**, not MIT. Keep the attribution in [assets/attribution/ATTRIBUTION.md](assets/attribution/ATTRIBUTION.md) with any redistribution.
- **Educational content** (`content/`): original text citing public sources; see [docs/medical-content-sources.md](docs/medical-content-sources.md).
