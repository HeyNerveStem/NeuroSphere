#!/usr/bin/env bash
# Download the BodyParts3D 3.0 brain elements used by NeuroSphere 3D (≈97 MB of STL).
# Source: STL conversion of the DBCLS BodyParts3D archive by K. M. Moerman (CC BY-SA 2.1 JP).
# If GitHub raw access is blocked, download the repository manually and copy
# assets/BodyParts3D_data/stl/<FMA id>.stl into assets/source-models/bodyparts3d/.
set -euo pipefail
cd "$(dirname "$0")/../.."
DEST=assets/source-models/bodyparts3d
BASE=https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main
mkdir -p "$DEST"
python3 scripts/model-optimization/structure_catalog.py >/dev/null
IDS=$(python3 -c "import json;print(' '.join(s['fma'] for s in json.load(open('content/structures.json'))['structures'] if s['kind']=='mesh'))")
for id in $IDS; do
  [ -s "$DEST/$id.stl" ] && continue
  echo "fetch $id"
  curl -sSf -o "$DEST/$id.stl" "$BASE/assets/BodyParts3D_data/stl/$id.stl"
done
for f in parts_list_e.txt conventional_part_of.txt composite_parts.txt; do
  curl -sSf -o "$DEST/$f" "$BASE/assets/BodyParts3D_data/$f"
done
curl -sSf -o "$DEST/LICENSE_content.txt" "$BASE/LICENSE_content"
echo "done: $(ls "$DEST"/*.stl | wc -l) STL files"
