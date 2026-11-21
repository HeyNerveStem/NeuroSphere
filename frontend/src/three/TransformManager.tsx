/**
 * Composes the single authoritative transform of every structure each frame:
 *   position = original + explodeOffset(progress) + manualOffset + lesionPush
 *   rotation = manualRotation
 * Runs inside the render loop, outside React renders.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { manifestById, MESH_IDS, meshesOf } from '@/lib/anatomy'
import { centroidOf, explodeOffset } from '@/lib/explode'
import { useAnimation } from '@/stores/animationStore'
import { transforms } from '@/stores/transformStore'
import { useViewer } from '@/stores/viewerStore'
import type { Vec3 } from '@/types'
import { meshRegistry } from './registry'

const groupCache = new Map<string, { members: Set<string>; centroid: Vec3 }>()
function groupInfo(id: string | null) {
  if (!id) return null
  let g = groupCache.get(id)
  if (!g) {
    const members = meshesOf(id)
    g = { members: new Set(members), centroid: centroidOf(members.map((m) => manifestById.get(m)!)) }
    groupCache.set(id, g)
  }
  return g
}

export function TransformManager() {
  const off = useRef<Vec3>([0, 0, 0])
  const tmp = useMemo(() => new Vector3(), [])
  const lesionPos = useMemo(() => new Vector3(), [])
  const lesionStrength = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const anim = useAnimation.getState()
    anim.tick(dt)
    const viewer = useViewer.getState()
    transforms.stepReturn(dt, viewer.reducedMotion)

    const { mode, progress, explosionDistance, activeGroup } = useAnimation.getState()
    const group = mode === 'selected' ? groupInfo(activeGroup) : null

    // lesion mass effect eases in/out smoothly
    const lesion = viewer.lesion
    const targetStrength = lesion?.massEffect ?? 0
    lesionStrength.current += (targetStrength - lesionStrength.current) * (1 - Math.exp(-dt * 3))
    if (lesion) lesionPos.set(...lesion.position)
    const lesionRadius = lesion?.radius ?? 0.1

    for (const id of MESH_IDS) {
      const mesh = meshRegistry.get(id)
      if (!mesh) continue
      const m = manifestById.get(id)!
      const e = explodeOffset(m, mode, progress, explosionDistance, group, off.current)
      const t = transforms.get(id)
      mesh.position.set(
        m.originalPosition[0] + e[0] + t.offset.x,
        m.originalPosition[1] + e[1] + t.offset.y,
        m.originalPosition[2] + e[2] + t.offset.z,
      )
      if (lesionStrength.current > 1e-4) {
        tmp.copy(mesh.position).sub(lesionPos)
        const d = tmp.length()
        const fall = Math.exp(-Math.pow(d / (lesionRadius * 2.6), 2))
        if (d > 1e-6) mesh.position.addScaledVector(tmp.divideScalar(d), lesionStrength.current * fall)
      }
      mesh.quaternion.copy(t.rotation)
    }
  })
  return null
}
