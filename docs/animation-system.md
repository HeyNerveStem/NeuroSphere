# Animation system

## One authoritative transform

For every mesh, each frame (`TransformManager`):

```
position = originalPosition                          (manifest, immutable)
         + explodeOffset(mesh, mode, progress, distance, group)
         + manualOffset                              (transformStore)
         + lesionPush                                (disease schematic only)
rotation = manualRotation
```

Nothing else writes mesh transforms. Manual drags change only `manualOffset/rotation`; the timeline changes only `progress`. "Return to original" drives the manual part to zero with exponential smoothing and then **snaps to exactly zero**, so there is no accumulated drift (unit-tested). Starting a drag pauses playback, so manual and automatic motion never race.

## Exploded targets (deterministic)

`explodeOffset = direction × weight × distance × localProgress` — direction and weight come from the build step (per-group bias + radial blend), never from randomness. A SHA-1 fingerprint of all directions is printed by the validator.

| Mode                | localProgress                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Complete        | `ease(p)` for all meshes                                                                                                                        |
| B — Layer-by-layer  | layer _i_ animates in window `[0.15 i, 0.15 i + 0.25]`: cortex → deep cortex/white matter → subcortical → diencephalon → brainstem → cerebellum |
| C — Selected region | only members of the chosen group move, away from the group's own centroid                                                                       |
| D — Guided          | as B, plus per-layer captions, camera presets and highlighting                                                                                  |

`ease` is a symmetric cubic in-out, so reverse playback is the exact mirror of forward playback. Scrubbing sets `progress` directly (state is a pure function of it). Step forward/back jumps between layer boundaries. Speeds: 0.25×, 0.5×, 1×, 1.5×, 2× over a 4-second base sweep.

## Disease schematics

`content/animations.json` defines step sequences (highlight targets with styles, camera, explode amount, x-ray, pulse, and optional illustrative lesion with mass effect). The lesion push is a Gaussian fall-off away from the lesion centre, added on top of the authoritative transform and eased in/out. Multiple sclerosis uses a separate 2D axon/myelin animation because demyelination is microscopic. Every schematic is labelled as educational, non-diagnostic and non-predictive.

## Performance notes

All per-frame work happens in `useFrame` without React renders: transforms (86 meshes), label projection (direct style writes), orientation widget and pulse. React re-renders only individual `StructureMesh` components whose visual state changed (Zustand selectors).
