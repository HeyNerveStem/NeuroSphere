# Processed models

`scripts/model-optimization/build_model.sh` writes its output here (`brain.raw.glb`, then the
meshopt-compressed `brain.glb`) and copies the final model to `frontend/public/models/brain.glb`,
which is the single committed copy. Both files in this folder are git-ignored to avoid duplicating
the 1.7 MB model.
