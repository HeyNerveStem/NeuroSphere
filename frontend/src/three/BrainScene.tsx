import { Environment, Lightformer, useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AdditiveBlending, Color, MeshStandardMaterial } from 'three'
import { useViewer } from '@/stores/viewerStore'
import { useAnimation } from '@/stores/animationStore'
import { transforms } from '@/stores/transformStore'
import { BrainModel } from './BrainModel'
import { CameraController } from './CameraController'
import { DissectionGizmo } from './DissectionGizmo'
import { LabelManager } from './LabelManager'
import { TransformManager } from './TransformManager'
import { meshRegistry, overlay, sceneInfo } from './registry'

const DPR: Record<string, [number, number]> = { low: [0.75, 1], medium: [1, 1.25], high: [1, 2], ultra: [1, 2.5] }

function Pulse() {
  useFrame(({ clock }) => {
    const s = useViewer.getState()
    if (!s.pulse) return
    const k = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4.2))
    for (const id of Object.keys(s.highlight)) {
      const m = meshRegistry.get(id)
      if (m) (m.material as MeshStandardMaterial).emissiveIntensity = k
    }
  })
  return null
}

function Lesion() {
  const lesion = useViewer((s) => s.lesion)
  if (!lesion) return null
  return (
    <group position={lesion.position}>
      <mesh renderOrder={5}>
        <sphereGeometry args={[lesion.radius, 40, 28]} />
        <meshStandardMaterial
          color="#e11d48"
          emissive="#be123c"
          emissiveIntensity={0.5}
          roughness={0.5}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh renderOrder={6}>
        <sphereGeometry args={[lesion.radius * 1.45, 32, 20]} />
        <meshBasicMaterial color="#fb7185" transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

function Background() {
  const theme = useViewer((s) => s.theme)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new Color(theme === 'dark' ? '#080D18' : '#eef2f7')
  }, [theme, scene])
  return null
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    overlay.canvas = gl.domElement
    gl.localClippingEnabled = true
  }, [gl])
  useFrame(() => {
    if (!sceneInfo.ready && meshRegistry.size > 0) {
      sceneInfo.ready = true
      ;(window as unknown as { __ready: boolean }).__ready = true
      onReady?.()
    }
  })
  return null
}

export function LoadingProgress() {
  const { progress } = useProgress()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let raf = 0
    const tick = () => (meshRegistry.size > 0 ? setReady(true) : (raf = requestAnimationFrame(tick)))
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (ready) return null
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
      <div className="glass rounded-xl px-5 py-3 text-sm text-[var(--text-2)]">
        Loading anatomical model…{progress > 0 && progress < 100 ? ` ${Math.round(progress)}%` : ''}
      </div>
    </div>
  )
}

export function BrainScene({
  interactive = true,
  autoRotate = false,
  onReady,
}: {
  interactive?: boolean
  autoRotate?: boolean
  onReady?: () => void
}) {
  const quality = useViewer((s) => s.quality)
  const dpr = useMemo(() => DPR[quality] ?? DPR.high, [quality])
  const missed = useCallback(() => {
    if (!interactive) return
    const s = useViewer.getState()
    if (s.mode === 'explore') s.select(null)
  }, [interactive])

  useEffect(() => {
    sceneInfo.ready = false
    // expose read-only handles for automated browser tests
    ;(window as unknown as Record<string, unknown>).__neuro = {
      meshRegistry,
      useViewer,
      useAnimation,
      transforms,
      sceneInfo,
    }
  }, [])

  return (
    <Canvas
      key={quality}
      dpr={dpr}
      camera={{ fov: 35, near: 0.01, far: 100, position: [2, 1, 2.5] }}
      gl={{ antialias: quality !== 'low', preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      onPointerMissed={missed}
      aria-label="Interactive 3D brain model"
      style={{ touchAction: 'none' }}
    >
      <Background />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <directionalLight position={[-4, 1, -3]} intensity={0.55} color="#a5c8ff" />
      <directionalLight position={[0, -4, 1]} intensity={0.3} />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.2} position={[0, 4, 3]} scale={[8, 3, 1]} />
        <Lightformer
          intensity={0.6}
          color="#9ec5ff"
          position={[-5, 0, -2]}
          rotation-y={Math.PI / 2}
          scale={[6, 4, 1]}
        />
        <Lightformer
          intensity={0.5}
          color="#ffd6c8"
          position={[5, -1, 2]}
          rotation-y={-Math.PI / 2}
          scale={[6, 4, 1]}
        />
      </Environment>
      <Suspense fallback={null}>
        <BrainModel />
        <Lesion />
      </Suspense>
      <TransformManager />
      <CameraController autoRotate={autoRotate} />
      {interactive && <DissectionGizmo />}
      <LabelManager />
      <Pulse />
      <ReadySignal onReady={onReady} />
    </Canvas>
  )
}
