/**
 * Shared, non-reactive handles between the R3F scene and DOM overlays.
 * Everything here is mutated inside the render loop, never through React state.
 */
import type { Mesh, PerspectiveCamera } from 'three'
import { Vector3 } from 'three'

export const meshRegistry = new Map<string, Mesh>()

export const overlay = {
  labelLayer: null as HTMLDivElement | null,
  leaderSvg: null as SVGSVGElement | null,
  orientation: null as SVGSVGElement | null,
  canvas: null as HTMLCanvasElement | null,
}

export const sceneInfo = {
  camera: null as PerspectiveCamera | null,
  ready: false,
}

/** World-space position of a mesh-local point (uses the live transform). */
export function localToWorld(id: string, local: [number, number, number], out = new Vector3()): Vector3 | null {
  const m = meshRegistry.get(id)
  if (!m) return null
  out.set(local[0], local[1], local[2])
  return m.localToWorld(out)
}
