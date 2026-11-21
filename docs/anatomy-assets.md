# Anatomical assets

## Candidate evaluation (Phase 1)

| Candidate                                          | Segmentation                                                                                     | License                       | Reachable here               | Verdict                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| **BodyParts3D 3.0** (DBCLS) via Moerman STL mirror | Per-concept surface meshes (FMA ids): gyri, deep nuclei, ventricles, brainstem parts, cerebellum | CC BY-SA 2.1 JP               | ✅ raw.githubusercontent.com | **Chosen** — peer-reviewed, mesh-level segmentation, permissive share-alike license       |
| fsaverage surfaces (bundled with nilearn)          | Cortical surface only, no lobe labels bundled                                                    | FreeSurfer license            | ✅ via pip                   | Rejected — would require fetching parcellations from blocked hosts; no subcortical meshes |
| Harvard-Oxford / AAL / CIT168 voxel atlases        | Voxel labels (needs marching cubes)                                                              | Various (some non-commercial) | ❌ hosts (NITRC/OSF) blocked | Documented as the upgrade path for missing structures                                     |
| Generic stylised brain models                      | Usually none                                                                                     | Varies                        | —                            | Rejected by the spec (not medically credible)                                             |

## What BodyParts3D provides — and what it does not

86 elements were integrated (see `content/structures.json`, `assets/model-manifest.json`). Notable limitations, shown in the UI as **unavailable** rather than faked:

- **Cerebellum** is one element → no left/right hemisphere or vermis selection.
- **Inferior frontal gyrus (Broca's area)** is absent in release 3.0 → frontal-lobe groups contain superior, middle and precentral gyri; the orbital/straight gyri come as one bilateral element. A visible gap on the lateral frontal surface exposes the insula/white matter beneath.
- **Substantia nigra** is not segmented (it lies inside the "cerebral peduncles" element) → Parkinson's highlights use the peduncle element with an explicit "schematic" note.
- **Nucleus accumbens, cuneus/lingual gyrus, cranial nerves III–XII, tractography** are not available.
- Single adult male specimen; surface model, not an MRI atlas. Some elements (white-matter envelope, medulla) are not watertight.

## Pipeline

```
scripts/model-optimization/fetch_bodyparts3d.sh      # download the 86 STLs (~97 MB)
scripts/model-optimization/build_model.sh            # catalog → GLB → meshopt → copy → validate
```

`build_brain_glb.py`:

1. axes `(x, y, z)_BP3D → (x, z, −y)` and mm × 0.01 (proper rotation, det = +1);
2. centre on the bounding-box centre of all elements;
3. quadric decimation (fast-simplification) to a 320 k-triangle budget, min 1 500 per element;
4. each element's geometry re-centred on its own area-weighted centroid → node translation = validated original position;
5. label anchor = outermost surface vertex along the outward direction; exploded direction = hand-specified per-group bias blended with the radial vector (deterministic);
6. GLB export (one node per structure, node name = structure id) + manifest with source SHA-1, triangle counts, bounds, anchors, explode vectors.

`gltf-transform meshopt` then quantises and compresses 8.2 MB → 1.66 MB. The viewer de-quantises to float32 on load.

## Adding structures later

Add entries to `structure_catalog.py` (mesh → FMA id, or a group with children), add an `anatomy.json` entry for its `contentId`, rebuild, and run both validators. Group-based selection, labels, explode, search and disease resolution pick it up automatically. For atlas-derived meshes (e.g. CIT168), run marching cubes on each label, register to the BodyParts3D frame, and document the registration error.
