import { CameraControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, Sphere, Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'
import { brainRadius, byId, meshesOf } from '@/lib/anatomy'
import { useAnimation } from '@/stores/animationStore'
import { useViewer, type CameraRequest } from '@/stores/viewerStore'
import type { CameraPreset } from '@/types'
import { meshRegistry, overlay, sceneInfo } from './registry'

const D = brainRadius * 2.9
const EPS = 0.001
/**
 * Camera presets in the model's LSA frame (+X patient left, +Y superior, +Z anterior).
 * Lateral views show the frontal pole toward the viewer's left (left lateral) or right (right lateral).
 * Axial/superior views place anterior at the top of the screen.
 */
export const PRESETS: Record<CameraPreset, { pos: [number, number, number]; clip?: 'sagittal' | 'coronal' | 'axial' }> = {
  anterior: { pos: [0, 0.15 * D, D] },
  posterior: { pos: [0, 0.15 * D, -D] },
  superior: { pos: [0, D, -EPS] },
  inferior: { pos: [0, -D, -EPS] },
  'left-lateral': { pos: [D, 0.1 * D, 0] },
  'right-lateral': { pos: [-D, 0.1 * D, 0] },
  sagittal: { pos: [-D, 0.05 * D, 0], clip: 'sagittal' },
  coronal: { pos: [0, 0.05 * D, D], clip: 'coronal' },
  axial: { pos: [0, D, -EPS], clip: 'axial' },
}

const AXES = [
  { v: new Vector3(1, 0, 0), pos: 'L', neg: 'R' },
  { v: new Vector3(0, 1, 0), pos: 'S', neg: 'I' },
  { v: new Vector3(0, 0, 1), pos: 'A', neg: 'P' },
]

export function CameraController({ autoRotate = false }: { autoRotate?: boolean }) {
  const ref = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const mode = useViewer((s) => s.mode)
  const tmp = useRef(new Vector3())
  const userActive = useRef(false)

  useEffect(() => {
    sceneInfo.camera = camera as import('three').PerspectiveCamera
    const c = ref.current
    if (!c) return
    c.setLookAt(D * 0.62, D * 0.32, D * 0.72, 0, 0, 0, false)
    c.minDistance = brainRadius * 0.6
    c.maxDistance = brainRadius * 7
  }, [camera])

  const handled = useRef(0)
  const handle = (c: CameraControlsImpl, request: CameraRequest) => {
    const smooth = !useViewer.getState().reducedMotion
    if (request.kind === 'reset') {
      void c.setLookAt(D * 0.62, D * 0.32, D * 0.72, 0, 0, 0, smooth)
      return true
    }
    if (request.kind === 'overview') {
      // pull back and look from anterior-superior so lateral separation reads left/right on screen
      const k = request.scale
      void c.setLookAt(D * 0.18 * k, D * 0.55 * k, D * 0.95 * k, 0, 0, 0, smooth)
      return true
    }
    if (request.kind === 'preset') {
      const p = PRESETS[request.preset]
      if (p.clip) useViewer.getState().setClip({ mode: p.clip, offset: 0 })
      void c.setLookAt(p.pos[0], p.pos[1], p.pos[2], 0, 0, 0, smooth)
      return true
    }
    // focus: fit the live bounding sphere of the structure's meshes (wait until meshes exist)
    const ids = meshesOf(request.id)
    const v = useViewer.getState()
    // buried structures (no cortical surface) are revealed with x-ray when nothing else exposes them
    const buried = ids.length > 0 && ids.every((id) => {
      const s = byId.get(id)
      return !!s && (s.layer ?? 0) >= 2 && id !== 'cerebellum' && !s.groups.includes('cortex')
    })
    if (buried && !v.xray && v.clip.mode === 'none' && useAnimation.getState().progress < 0.25 && !v.isolated) v.setXray(true)
    const box = new Box3()
    for (const id of ids) {
      const m = meshRegistry.get(id)
      if (m?.visible) box.expandByObject(m)
    }
    if (box.isEmpty()) return meshRegistry.size > 0
    const sphere = box.getBoundingSphere(new Sphere())
    sphere.radius = Math.max(sphere.radius * 1.15, brainRadius * (buried ? 0.45 : 0.22))
    void c.fitToSphere(sphere, smooth)
    return true
  }

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const on = () => (userActive.current = true)
    const off = () => (userActive.current = false)
    c.addEventListener('controlstart', on)
    c.addEventListener('controlend', off)
    return () => {
      c.removeEventListener('controlstart', on)
      c.removeEventListener('controlend', off)
    }
  }, [])

  // keep the orientation widget in sync with the camera (no React renders)
  useFrame((_, dt) => {
    // process camera requests here so none are lost before the controls mount
    const pending = useViewer.getState().cameraRequest
    if (pending && pending.nonce !== handled.current && ref.current && handle(ref.current, pending)) handled.current = pending.nonce
    if (autoRotate && !userActive.current && ref.current && !useViewer.getState().reducedMotion) ref.current.rotate(dt * 0.25, 0, false)
    const svg = overlay.orientation
    if (!svg) return
    const q = camera.quaternion.clone().invert()
    AXES.forEach((a, i) => {
      const v = tmp.current.copy(a.v).applyQuaternion(q)
      const x = v.x * 26
      const y = -v.y * 26
      const line = svg.querySelector<SVGLineElement>(`[data-axis="${i}"]`)
      const tp = svg.querySelector<SVGTextElement>(`[data-label="${i}p"]`)
      const tn = svg.querySelector<SVGTextElement>(`[data-label="${i}n"]`)
      line?.setAttribute('x2', `${x}`)
      line?.setAttribute('y2', `${y}`)
      line?.setAttribute('opacity', v.z > 0 ? '1' : '0.45')
      tp?.setAttribute('x', `${x * 1.32}`)
      tp?.setAttribute('y', `${y * 1.32 + 4}`)
      tn?.setAttribute('x', `${-x * 1.32}`)
      tn?.setAttribute('y', `${-y * 1.32 + 4}`)
      tp?.setAttribute('opacity', v.z > -0.2 ? '1' : '0.5')
      tn?.setAttribute('opacity', v.z < 0.2 ? '1' : '0.5')
    })
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.08}
      dollyToCursor={mode === 'explore'}
    />
  )
}
