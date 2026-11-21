# Scripts

| Script                                    | Purpose                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `model-optimization/fetch_bodyparts3d.sh` | Download the 86 BodyParts3D STL elements (~97 MB) into `assets/source-models/bodyparts3d/`                       |
| `model-optimization/structure_catalog.py` | Canonical structure tree → `content/structures.json` (mesh ↔ FMA id, groups, layers, unavailable structures)     |
| `model-optimization/build_brain_glb.py`   | STL → oriented, centred, decimated, per-structure GLB + `assets/model-manifest.json`                             |
| `model-optimization/build_model.sh`       | Full pipeline: catalog → GLB → meshopt → copy into the frontend → validate                                       |
| `model-validation/validate_model.py`      | Mesh ids, FMA mapping, finite transforms, explode vectors, anatomical orientation, label anchors                 |
| `content-validation/validate_content.py`  | Merge disease files, derive `relationships.json`, validate references/targets/enums, reject unsourced statistics |
| `dev/shot.py`                             | One-off headless screenshot: `shot.py URL out.png [WxH] [wait_ms] [js]`                                          |
| `dev/capture_demo.py`                     | Regenerate every README image and the demo GIF from a running preview build                                      |

All Python scripts run from any directory (paths resolve from the repo root). The `Makefile` at the
root wraps the common ones: `make validate`, `make model`, `make screenshots`.
