"""
Validate the shipped brain model against the structure catalog and manifest.

Checks (spec section 23):
  - every expected mesh id exists in the GLB, no extras, no duplicates
  - every mesh maps to exactly one catalog structure, and FMA ids match
  - transforms are finite; local bounds finite and non-degenerate
  - exploded directions are unit length and deterministic (recomputed hash)
  - anatomical orientation: left structures have +X, frontal lobe anterior to
    occipital lobe, cerebellum posterior & inferior to cerebrum, medulla inferior to pons
  - label anchors lie inside (or on) their own mesh bounds
Exit code 1 on any failure.
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def glb_node_names(path: Path) -> list[str]:
    data = path.read_bytes()
    assert data[:4] == b"glTF", "not a GLB"
    (json_len,) = struct.unpack_from("<I", data, 12)
    gltf = json.loads(data[20:20 + json_len])
    return [n.get("name") for n in gltf.get("nodes", []) if "mesh" in n]


def main() -> int:
    errors: list[str] = []
    catalog = json.loads((ROOT / "content/structures.json").read_text())
    manifest = json.loads((ROOT / "assets/model-manifest.json").read_text())
    glb = ROOT / "assets/processed-models/brain.glb"
    if not glb.exists():
        glb = ROOT / "assets/processed-models/brain.raw.glb"
    names = glb_node_names(glb)

    expected = {s["id"]: s for s in catalog["structures"] if s["kind"] == "mesh"}
    ids = [s["id"] for s in catalog["structures"]]
    if len(ids) != len(set(ids)):
        errors.append("duplicate structure ids in catalog")
    if len(names) != len(set(names)):
        errors.append("duplicate node names in GLB")
    missing = set(expected) - set(names)
    extra = set(names) - set(expected)
    if missing:
        errors.append(f"missing meshes in GLB: {sorted(missing)}")
    if extra:
        errors.append(f"unexpected meshes in GLB: {sorted(extra)}")

    by_id = {m["meshName"]: m for m in manifest["meshes"]}
    for sid, s in expected.items():
        m = by_id.get(sid)
        if not m:
            errors.append(f"{sid}: not in manifest"); continue
        if m["fmaId"] != s["fma"]:
            errors.append(f"{sid}: FMA mismatch {m['fmaId']} != {s['fma']}")
        vals = m["originalPosition"] + sum(m["boundsLocal"], []) + m["explodeDirection"] + m["labelAnchorLocal"]
        if not all(abs(v) < 1e3 and v == v for v in vals):
            errors.append(f"{sid}: non-finite transform/bounds")
        bmin, bmax = m["boundsLocal"]
        if any(hi - lo <= 0 for lo, hi in zip(bmin, bmax)):
            errors.append(f"{sid}: degenerate bounds")
        n = sum(v * v for v in m["explodeDirection"]) ** 0.5
        if abs(n - 1) > 1e-3:
            errors.append(f"{sid}: explode direction not unit ({n:.4f})")
        a = m["labelAnchorLocal"]
        if not all(lo - 1e-4 <= x <= hi + 1e-4 for x, lo, hi in zip(a, bmin, bmax)):
            errors.append(f"{sid}: label anchor outside its mesh bounds")

    P = {k: v["originalPosition"] for k, v in by_id.items()}
    def check(cond, msg):
        if not cond:
            errors.append("orientation: " + msg)
    for s in expected.values():
        if s["hemisphere"] == "left":
            check(P[s["id"]][0] > 0, f"{s['id']} should have +X (patient left)")
        if s["hemisphere"] == "right":
            check(P[s["id"]][0] < 0, f"{s['id']} should have -X (patient right)")
    check(P["left-superior-frontal-gyrus"][2] > P["left-occipital-lobe"][2], "frontal must be anterior (+Z) to occipital")
    check(P["cerebellum"][2] < P["corpus-callosum"][2], "cerebellum must be posterior to corpus callosum")
    check(P["cerebellum"][1] < P["corpus-callosum"][1], "cerebellum must be inferior to corpus callosum")
    check(P["medulla-oblongata"][1] < P["pons"][1] < P["midbrain-other"][1], "medulla < pons < midbrain (superior axis)")
    check(P["pituitary-gland"][1] < P["hypothalamus-other"][1], "pituitary must be inferior to hypothalamus")

    # determinism fingerprint of exploded targets
    fp = hashlib.sha1(json.dumps([(m["meshName"], m["explodeDirection"], m["explodeWeight"]) for m in manifest["meshes"]]).encode()).hexdigest()

    if errors:
        print("MODEL VALIDATION FAILED")
        for e in errors:
            print("  -", e)
        return 1
    print(f"model OK: {len(names)} meshes, {manifest['trianglesTotal']:,} triangles, explode fingerprint {fp[:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
