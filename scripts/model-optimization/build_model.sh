#!/usr/bin/env bash
# Rebuild the shipped brain model end to end.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 scripts/model-optimization/structure_catalog.py
python3 scripts/model-optimization/build_brain_glb.py "$@"
# meshopt compression + quantisation; keeps one node per structure
npx --yes @gltf-transform/cli@4 meshopt assets/processed-models/brain.raw.glb assets/processed-models/brain.glb
mkdir -p frontend/public/models frontend/src/data
cp assets/processed-models/brain.glb frontend/public/models/brain.glb
cp assets/model-manifest.json frontend/src/data/model-manifest.json
python3 scripts/model-validation/validate_model.py
