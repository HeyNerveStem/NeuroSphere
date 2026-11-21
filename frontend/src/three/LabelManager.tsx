/**
 * Anatomical labels anchored to projected 3D points. Positions are updated in
 * the render loop by writing element styles directly (no React re-render per
 * frame). Overlap is resolved greedily by priority; labels whose anchor faces
 * away from the camera, or whose structure is buried under opaque cortex, are
 * hidden (occlusion-aware heuristic, no per-frame raycasts).
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { byId, manifestById, meshesOf, MESH_IDS, STRUCTURES } from '@/lib/anatomy'
import { useAnimation } from '@/stores/animationStore'
import { useViewer } from '@/stores/viewerStore'
import { meshRegistry, overlay } from './registry'

export interface LabelEntry {
  id: string
  text: string
  meshes: string[]
  priority: number
}

const MAJOR_GROUPS = STRUCTURES.filter((s) => s.kind === 'group' && s.majorSelect).map((s) => s.id)

export function computeLabelEntries(mode: string, selectedId: string | null, level: string): LabelEntry[] {
  const entries: LabelEntry[] = []
  const push = (id: string, priority: number) => {
    const s = byId.get(id)
    if (!s) return
    let text = s.name
    if (level === 'beginner') text = text.replace(/\s*\((remaining parts|main gyri)\)/, '')
    entries.push({ id, text, meshes: meshesOf(id), priority })
  }
  if (mode === 'all') {
    MESH_IDS.forEach((id) => push(id, byId.get(id)!.labelPriority ?? 2))
  } else if (mode === 'major') {
    MAJOR_GROUPS.forEach((id) => push(id, 1))
    MESH_IDS.filter(
      (id) => (byId.get(id)!.labelPriority ?? 2) === 1 && !byId.get(id)!.parentId?.endsWith('-lobe'),
    ).forEach((id) => push(id, 1.5))
  }
  if (selectedId && mode !== 'none') {
    const existing = entries.find((e) => e.id === selectedId)
    if (existing) existing.priority = 0
    else push(selectedId, 0)
  }
  return entries
}

export function LabelManager() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const labelMode = useViewer((s) => s.labelMode)
  const selectedId = useViewer((s) => s.selectedId)
  const level = useViewer((s) => s.level)
  const entries = useMemo(() => computeLabelEntries(labelMode, selectedId, level), [labelMode, selectedId, level])
  const v = useMemo(() => new Vector3(), [])
  const n = useMemo(() => new Vector3(), [])
  const c = useMemo(() => new Vector3(), [])
  const camDir = useMemo(() => new Vector3(), [])
  const frame = useRef(0)

  useFrame(() => {
    const layer = overlay.labelLayer
    if (!layer) return
    frame.current++
    const viewer = useViewer.getState()
    const progress = useAnimation.getState().progress
    const internalVisible = viewer.xray || progress > 0.25 || viewer.clip.mode !== 'none' || !!viewer.isolated
    const placed: [number, number, number, number][] = []
    const sorted = [...entries].sort((a, b) => a.priority - b.priority)
    const line = overlay.leaderSvg?.querySelector('line')
    const dot = overlay.leaderSvg?.querySelector('circle')
    let leaderShown = false
    camera.getWorldDirection(camDir)

    for (const e of sorted) {
      const el = layer.querySelector<HTMLElement>(`[data-label-id="${e.id}"]`)
      if (!el) continue
      // average anchor across visible meshes
      v.set(0, 0, 0)
      c.set(0, 0, 0)
      let count = 0
      let layerMin = 9
      for (const id of e.meshes) {
        const mesh = meshRegistry.get(id)
        if (!mesh || !mesh.visible) continue
        const a = manifestById.get(id)!.labelAnchorLocal
        n.set(a[0], a[1], a[2])
        mesh.localToWorld(n)
        v.add(n)
        c.add(mesh.position)
        layerMin = Math.min(layerMin, manifestById.get(id)!.layer)
        count++
      }
      const isSel = e.priority === 0
      if (!count) {
        el.style.display = 'none'
        continue
      }
      v.divideScalar(count)
      c.divideScalar(count)
      // back-facing anchor test (anchor normal ≈ anchor - structure centre)
      n.copy(v).sub(c).normalize()
      const facing = n.dot(camDir) < 0.25
      const buried = layerMin > 0 && e.id !== 'cerebellum' && !internalVisible
      if (!isSel && (!facing || buried)) {
        el.style.display = 'none'
        continue
      }
      const p = v.clone().project(camera)
      if (p.z > 1 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) {
        el.style.display = 'none'
        continue
      }
      const x = (p.x * 0.5 + 0.5) * size.width
      const y = (-p.y * 0.5 + 0.5) * size.height
      const ox = isSel ? 28 : 0
      const oy = isSel ? -34 : -10
      const w = el.offsetWidth || e.text.length * 6.5 + 16
      const h = el.offsetHeight || 22
      const box: [number, number, number, number] = [x + ox - w / 2, y + oy - h, x + ox + w / 2, y + oy]
      const overlaps = placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))
      if (overlaps && !isSel) {
        el.style.display = 'none'
        continue
      }
      placed.push(box)
      el.style.display = 'block'
      el.style.transform = `translate(${box[0]}px, ${box[1]}px)`
      if (isSel && line && dot) {
        leaderShown = true
        line.setAttribute('x1', `${x}`)
        line.setAttribute('y1', `${y}`)
        line.setAttribute('x2', `${x + ox}`)
        line.setAttribute('y2', `${y + oy}`)
        dot.setAttribute('cx', `${x}`)
        dot.setAttribute('cy', `${y}`)
      }
    }
    if (overlay.leaderSvg) overlay.leaderSvg.style.display = leaderShown ? 'block' : 'none'
  })

  return null
}
