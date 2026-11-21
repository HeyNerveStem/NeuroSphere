"""
Build the segmented NeuroSphere 3D brain model from BodyParts3D 3.0 STL elements.

Pipeline (deterministic, no random numbers anywhere):
  1. Load each STL listed in content/structures.json (kind == "mesh").
  2. Convert BodyParts3D axes (+X left, +Y posterior, +Z superior, mm) to the
     app's LSA frame (+X left, +Y superior, +Z anterior) and scale mm -> 0.01.
  3. Centre the whole brain on the origin (bounding-box centre of all meshes).
  4. Quadric-decimate each element towards a global triangle budget.
  5. Re-centre every element's geometry on its own centroid, so the node
     translation *is* the structure's validated original position.
  6. Compute label anchors and deterministic exploded-view directions.
  7. Export one GLB (one node per structure, node name == structure id) and
     assets/model-manifest.json.

Usage:  python3 scripts/model-optimization/build_brain_glb.py [--budget 320000]
Then:   npx @gltf-transform/cli meshopt <out>.glb <final>.glb   (see build_model.sh)
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets" / "source-models" / "bodyparts3d"
OUT_DIR = ROOT / "assets" / "processed-models"

# BodyParts3D (x, y, z) -> app (x, z, -y), then mm -> 0.01 units
CONVERT = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64) * 0.01


def explode_rule(s: dict, r: np.ndarray) -> tuple[np.ndarray, float]:
    """Return (unnormalised direction bias, weight) for one structure.

    Directions are hand-specified per anatomical group (the "manually
    configurable direction vectors" in the spec) and blended with the radial
    vector from the brain centre so neighbours separate consistently.
    """
    sid, hem, layer = s["id"], s["hemisphere"], s["layer"]
    lat = {"left": 1.0, "right": -1.0}.get(hem, 0.0)
    radial = r / (np.linalg.norm(r) + 1e-9)

    def blend(bias, radial_w, weight):
        return np.array(bias, float) + radial * radial_w, weight

    if sid == "cerebellum":
        return blend([0, -0.55, -1.0], 0.2, 0.95)
    if sid == "orbital-and-straight-gyri":
        return blend([0, -0.5, 1.0], 0.3, 0.75)
    if layer == 0:  # lateral cortex shells
        return blend([1.25 * lat, 0.25, 0], 1.0, 1.0)
    if sid == "cerebral-white-matter":
        return blend([0, 1.0, 0], 0.0, 0.62)
    if sid == "corpus-callosum":
        return blend([0, 1.0, 0], 0.0, 0.38)
    if "cingulate" in sid:
        return blend([0.6 * lat, 1.0, 0], 0.2, 0.62)
    if "insula" in sid or "accessory-short" in sid:
        return blend([1.0 * lat, 0, 0], 0.3, 0.68)
    if "parahippocampal" in sid:
        return blend([1.0 * lat, -0.6, 0], 0.4, 0.66)
    if layer == 2:  # subcortical
        if "hippocampus" in sid:
            return blend([1.0 * lat, -0.5, -0.2], 0.3, 0.42)
        if "amygdala" in sid:
            return blend([1.0 * lat, -0.4, 0.5], 0.3, 0.42)
        if "caudate" in sid:
            return blend([0.7 * lat, 0.6, 0.2], 0.3, 0.36)
        if "putamen" in sid:
            return blend([1.0 * lat, 0, 0], 0.2, 0.34)
        if "globus-pallidus" in sid:
            return blend([1.0 * lat, -0.3, 0], 0.2, 0.25)
        if "lateral-ventricle" in sid or "choroid" in sid:
            return blend([0.6 * lat, 0.8, 0], 0.2, 0.24)
        if "internal-capsule" in sid:
            return blend([0.8 * lat, 0.3, 0.4], 0.2, 0.28)
        if "fornix" in sid:
            return blend([0.3 * lat, 0.8, -0.3], 0.2, 0.22)
        if sid == "septum-pellucidum":
            return blend([0, 0.8, 0.3], 0.0, 0.2)
        return blend([lat, 0, 0], 0.3, 0.3)
    if layer == 3:  # diencephalon + visual pathway
        if "thalamus" in sid:
            return blend([0.6 * lat, 0.2, -0.2], 0.2, 0.12)
        if "geniculate" in sid:
            return blend([1.0 * lat, -0.2, -0.4], 0.2, 0.2)
        if sid in ("pituitary-gland",):
            return blend([0, -1.0, 0.6], 0.0, 0.34)
        if sid in ("hypothalamus-other", "mammillary-body", "tuber-cinereum"):
            return blend([0, -0.8, 0.5], 0.0, 0.22)
        if sid in ("pineal-gland", "habenula"):
            return blend([0, 0.4, -1.0], 0.0, 0.22)
        if sid == "third-ventricle":
            return blend([0, 0.5, 0.2], 0.0, 0.08)
        if "optic" in sid:
            return blend([0.4 * lat, -0.4, 1.0], 0.2, 0.42)
        return blend([0, 0, 0], 1.0, 0.15)
    if layer == 4:  # brainstem
        if "colliculus" in sid:
            return blend([0.4 * lat, 0, -1.0], 0.2, 0.42)
        if sid == "fourth-ventricle":
            return blend([0, -0.6, -1.0], 0.0, 0.5)
        if sid == "medulla-oblongata":
            return blend([0, -1.0, 0.15], 0.0, 0.62)
        if sid == "pons":
            return blend([0, -1.0, 0.35], 0.0, 0.5)
        return blend([0, -1.0, 0.1], 0.0, 0.38)
    return blend([0, 0, 0], 1.0, 0.3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=int, default=320_000, help="total triangle budget")
    args = ap.parse_args()

    catalog = json.loads((ROOT / "content" / "structures.json").read_text())
    meshes = [s for s in catalog["structures"] if s["kind"] == "mesh"]

    loaded = {}
    for s in meshes:
        path = SRC / f"{s['fma']}.stl"
        m = trimesh.load(path, force="mesh", process=True)
        m.merge_vertices()
        v = m.vertices @ CONVERT.T
        loaded[s["id"]] = (s, v, np.asarray(m.faces), path)

    allv = np.vstack([v for _, v, _, _ in loaded.values()])
    center = (allv.min(0) + allv.max(0)) / 2
    total = sum(len(f) for *_, f, _ in [(a, b, c, d) for a, b, c, d in loaded.values()])
    ratio = min(1.0, args.budget / total)
    print(f"source triangles: {total:,}  -> budget {args.budget:,} (ratio {ratio:.3f})")

    scene = trimesh.Scene()
    manifest_meshes = []
    for sid, (s, v, f, path) in loaded.items():
        v = v - center
        n0 = len(f)
        target = int(min(n0, max(1500, n0 * ratio)))
        if target < n0:
            reduction = 1 - target / n0
            v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=reduction)
        else:
            v2, f2 = v, f
        tm = trimesh.Trimesh(vertices=np.asarray(v2, float), faces=np.asarray(f2), process=True)
        tm.remove_unreferenced_vertices()
        # centroid of the surface (area-weighted); robust for non-watertight shells
        centroid = tm.centroid.copy()
        local = tm.copy()
        local.apply_translation(-centroid)
        local.fix_normals() if local.is_watertight else None
        _ = local.vertex_normals  # force smooth normals to be computed & exported
        r = centroid  # relative to brain centre (origin)
        bias, weight = explode_rule(s, r)
        direction = bias / (np.linalg.norm(bias) + 1e-9)
        # label anchor: outermost surface vertex along the outward direction
        outward = r / (np.linalg.norm(r) + 1e-9) if s["layer"] == 0 or s["id"] == "cerebellum" else direction
        idx = int(np.argmax(local.vertices @ outward))
        anchor_local = local.vertices[idx]
        bmin, bmax = local.bounds
        T = np.eye(4)
        T[:3, 3] = centroid
        scene.add_geometry(local, node_name=sid, geom_name=sid, transform=T)
        manifest_meshes.append(dict(
            meshName=sid, structureId=sid, fmaId=s["fma"], sourceFile=f"source-models/bodyparts3d/{path.name}",
            sourceSha1=hashlib.sha1(path.read_bytes()).hexdigest(),
            trianglesSource=int(n0), trianglesShipped=int(len(local.faces)),
            originalPosition=[round(float(x), 5) for x in centroid],
            originalQuaternion=[0, 0, 0, 1],
            boundsLocal=[[round(float(x), 5) for x in bmin], [round(float(x), 5) for x in bmax]],
            labelAnchorLocal=[round(float(x), 5) for x in anchor_local],
            explodeDirection=[round(float(x), 5) for x in direction],
            explodeWeight=round(float(weight), 4),
            layer=s["layer"],
            watertight=bool(tm.is_watertight),
        ))
        print(f"  {sid:45s} {n0:7d} -> {len(local.faces):6d}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = OUT_DIR / "brain.raw.glb"
    scene.export(raw)
    allc = np.vstack([np.array(m["originalPosition"]) for m in manifest_meshes])
    manifest = dict(
        model="brain.glb",
        source=dict(name="BodyParts3D 3.0 (20110915)", mirror="https://github.com/Kevin-Mattheus-Moerman/BodyParts3D",
                    license="CC BY-SA 2.1 JP", attribution="BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
                    citation="Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37:D782-5. doi:10.1093/nar/gkn613"),
        coordinateSystem=dict(x="patient left", y="superior", z="anterior", unitsPerMm=0.01),
        sourceCentreMm=[round(float(x) / 0.01, 3) for x in (center)],
        brainBounds=[[round(float(x), 4) for x in allv.min(0) - center], [round(float(x), 4) for x in allv.max(0) - center]],
        trianglesTotal=int(sum(m["trianglesShipped"] for m in manifest_meshes)),
        meshes=manifest_meshes,
    )
    (ROOT / "assets" / "model-manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"wrote {raw} ({raw.stat().st_size/1e6:.1f} MB), {manifest['trianglesTotal']:,} triangles")


if __name__ == "__main__":
    main()
