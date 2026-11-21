/**
 * Manual dissection: a TransformControls gizmo attached to a proxy pivot at the
 * selected structure's live centroid. Gizmo deltas are applied to the manual
 * offsets of every (unlocked) mesh in the selection. Camera orbiting is
 * disabled automatically while dragging (drei wires 'dragging-changed' to the
 * default controls), and any running exploded-view animation is paused first,
 * so manual and automatic motion never race.
 */
import { TransformControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, Object3D, Quaternion, Vector3 } from 'three'
import { meshesOf } from '@/lib/anatomy'
import { useAnimation } from '@/stores/animationStore'
import { transforms } from '@/stores/transformStore'
import { useViewer } from '@/stores/viewerStore'
import { meshRegistry } from './registry'

export function DissectionGizmo() {
  const selectedId = useViewer((s) => s.selectedId)
  const mode = useViewer((s) => s.mode)
  const gizmoMode = useViewer((s) => s.gizmoMode)
  const snap = useViewer((s) => s.snap)
  const locked = useViewer((s) => s.locked)
  const hidden = useViewer((s) => s.hidden)
  const proxy = useMemo(() => new Object3D(), [])
  const dragging = useRef(false)
  const lastPos = useRef(new Vector3())
  const lastQuat = useRef(new Quaternion())
  const [, force] = useState(0)

  const ids = useMemo(
    () => (selectedId ? meshesOf(selectedId).filter((m) => !locked[m] && !hidden[m]) : []),
    [selectedId, locked, hidden],
  )
  const centroid = (out: Vector3) => {
    out.set(0, 0, 0)
    let n = 0
    for (const id of ids) {
      const m = meshRegistry.get(id)
      if (m) {
        out.add(m.position)
        n++
      }
    }
    return n ? out.divideScalar(n) : out
  }

  useFrame(() => {
    if (dragging.current || !ids.length) return
    centroid(proxy.position)
    proxy.quaternion.identity()
    proxy.updateMatrixWorld()
    lastPos.current.copy(proxy.position)
    lastQuat.current.identity()
  })

  if (mode !== 'dissect' || !ids.length) return null

  const onMouseDown = () => {
    dragging.current = true
    useAnimation.getState().pause()
    transforms.pushHistory()
    lastPos.current.copy(proxy.position)
    lastQuat.current.copy(proxy.quaternion)
  }
  const onMouseUp = () => {
    dragging.current = false
    transforms.endManipulation()
    force((x) => x + 1)
  }
  const onObjectChange = () => {
    if (!dragging.current) return
    if (gizmoMode === 'translate') {
      const delta = proxy.position.clone().sub(lastPos.current)
      if (delta.lengthSq() > 0) transforms.translate(ids, delta)
      lastPos.current.copy(proxy.position)
    } else {
      const dq = proxy.quaternion.clone().multiply(lastQuat.current.clone().invert())
      const current = new Map<string, Vector3>()
      for (const id of ids) {
        const m = meshRegistry.get(id)
        if (m) current.set(id, m.position.clone())
      }
      transforms.rotate(ids, dq, proxy.position.clone(), current)
      lastQuat.current.copy(proxy.quaternion)
    }
  }

  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        object={proxy}
        mode={gizmoMode}
        size={0.85}
        translationSnap={snap ? 0.05 : null}
        rotationSnap={snap ? MathUtils.degToRad(15) : null}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onObjectChange={onObjectChange}
      />
    </>
  )
}
