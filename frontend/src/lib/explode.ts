/**
 * Deterministic exploded-view math. No randomness: every structure's target is
 * a pure function of (manifest, mode, progress, distance, active group).
 */
import type { ExplodeMode, ManifestMesh, Vec3 } from '@/types'

export const LAYER_COUNT = 6
export const LAYER_NAMES = [
  'External cerebral cortex',
  'Deep cortex, white matter & commissures',
  'Subcortical nuclei, limbic structures & ventricles',
  'Diencephalon & visual pathway',
  'Brainstem',
  'Cerebellum',
]
const LAYER_START_STEP = 0.15
const LAYER_SPAN = 0.25

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Smooth, symmetric easing so reverse playback mirrors forward playback exactly. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function layerWindow(layer: number): [number, number] {
  const s = layer * LAYER_START_STEP
  return [s, Math.min(1, s + LAYER_SPAN)]
}

/** Local progress (0..1, eased) of one structure for a global progress value. */
export function localProgress(mesh: ManifestMesh, mode: ExplodeMode, progress: number, inGroup: boolean): number {
  const p = clamp01(progress)
  switch (mode) {
    case 'complete':
      return easeInOutCubic(p)
    case 'layered':
    case 'guided': {
      const [a, b] = layerWindow(mesh.layer)
      return easeInOutCubic(clamp01((p - a) / (b - a)))
    }
    case 'selected':
      return inGroup ? easeInOutCubic(p) : 0
  }
}

/** Layer index currently animating, for captions in guided/layered modes. */
export function activeLayer(progress: number): number {
  let cur = 0
  for (let i = 0; i < LAYER_COUNT; i++) if (progress >= layerWindow(i)[0]) cur = i
  return cur
}

/** Step boundaries used by step-forward / step-backward controls. */
export function stepBoundaries(mode: ExplodeMode): number[] {
  if (mode === 'layered' || mode === 'guided') {
    const pts = new Set<number>([0, 1])
    for (let i = 0; i < LAYER_COUNT; i++) layerWindow(i).forEach((v) => pts.add(+v.toFixed(4)))
    return [...pts].sort((a, b) => a - b)
  }
  return [0, 0.25, 0.5, 0.75, 1]
}

export function nextStep(mode: ExplodeMode, progress: number, dir: 1 | -1): number {
  const pts = stepBoundaries(mode)
  if (dir > 0) return pts.find((v) => v > progress + 1e-4) ?? 1
  return [...pts].reverse().find((v) => v < progress - 1e-4) ?? 0
}

/**
 * Direction used in "selected region" mode: members separate from the group's
 * own centroid, blended with their global direction so the result stays readable.
 */
export function groupDirection(mesh: ManifestMesh, groupCentroid: Vec3): Vec3 {
  const p = mesh.originalPosition
  let d: Vec3 = [p[0] - groupCentroid[0], p[1] - groupCentroid[1], p[2] - groupCentroid[2]]
  const n = Math.hypot(...d)
  d = n > 1e-6 ? [d[0] / n, d[1] / n, d[2] / n] : [0, 0, 0]
  const g = mesh.explodeDirection
  const v: Vec3 = [d[0] * 0.75 + g[0] * 0.25, d[1] * 0.75 + g[1] * 0.25, d[2] * 0.75 + g[2] * 0.25]
  const m = Math.hypot(...v) || 1
  return [v[0] / m, v[1] / m, v[2] / m]
}

/** Exploded offset (added to the original position) for one structure. */
export function explodeOffset(
  mesh: ManifestMesh,
  mode: ExplodeMode,
  progress: number,
  distance: number,
  group: { members: Set<string>; centroid: Vec3 } | null,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const inGroup = !!group && group.members.has(mesh.meshName)
  const t = localProgress(mesh, mode, progress, inGroup)
  if (t === 0) {
    out[0] = out[1] = out[2] = 0
    return out
  }
  if (mode === 'selected' && group) {
    const d = groupDirection(mesh, group.centroid)
    const k = t * distance * 0.45
    out[0] = d[0] * k
    out[1] = d[1] * k
    out[2] = d[2] * k
    return out
  }
  const k = t * distance * mesh.explodeWeight
  out[0] = mesh.explodeDirection[0] * k
  out[1] = mesh.explodeDirection[1] * k
  out[2] = mesh.explodeDirection[2] * k
  return out
}

export function centroidOf(meshes: ManifestMesh[]): Vec3 {
  if (!meshes.length) return [0, 0, 0]
  const c: Vec3 = [0, 0, 0]
  for (const m of meshes) {
    c[0] += m.originalPosition[0]
    c[1] += m.originalPosition[1]
    c[2] += m.originalPosition[2]
  }
  return [c[0] / meshes.length, c[1] / meshes.length, c[2] / meshes.length]
}
