import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Outlines } from '@react-three/drei'
import { suspend, preload } from 'suspend-react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { ThreeEvent } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Vector3,
} from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { ancestors, byId, manifestById, MESH_IDS, meshesOf, selectionTarget } from '@/lib/anatomy'
import { useViewer } from '@/stores/viewerStore'
import { HIGHLIGHT_COLORS, realisticColor, regionColor } from './materials'
import { meshRegistry } from './registry'

// Efficient raycasting: BVH acceleration for all meshes
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast
const noRaycast = () => {}

/**
 * Load the model. Normal builds fetch the (meshopt) .glb; hosts that only serve text files can ship
 * it as JSON `{ "glb": "<base64>" }` (VITE_MODEL_FILE=brain.json), parsed locally with no extra request.
 */
async function loadModel(url: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  if (url.endsWith('.json')) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Model download failed (${res.status})`)
    const { glb } = (await res.json()) as { glb: string }
    const bin = atob(glb)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return loader.parseAsync(bytes.buffer, '')
  }
  return loader.loadAsync(url)
}

export const MODEL_URL = `${import.meta.env.BASE_URL}models/${import.meta.env.VITE_MODEL_FILE ?? 'brain.glb'}`

declare module 'three' {
  interface BufferGeometry {
    computeBoundsTree: typeof computeBoundsTree
    disposeBoundsTree: typeof disposeBoundsTree
  }
}

/** Convert a (possibly quantised) attribute to float32 so it can be transformed. */
function toFloat(attr: BufferAttribute, itemSize: number): BufferAttribute {
  if (attr.array instanceof Float32Array && !attr.normalized) return attr.clone()
  const out = new Float32Array(attr.count * itemSize)
  for (let i = 0; i < attr.count; i++) {
    out[i * itemSize] = attr.getX(i)
    if (itemSize > 1) out[i * itemSize + 1] = attr.getY(i)
    if (itemSize > 2) out[i * itemSize + 2] = attr.getZ(i)
  }
  return new BufferAttribute(out, itemSize)
}

/** Extract each structure's geometry, expressed relative to its own validated centroid. */
function prepareGeometries(scene: import('three').Object3D): Map<string, BufferGeometry> {
  scene.updateMatrixWorld(true)
  const out = new Map<string, BufferGeometry>()
  for (const id of MESH_IDS) {
    const node = scene.getObjectByName(id) as Mesh | undefined
    if (!node?.isMesh) {
      console.error(`[NeuroSphere] mesh "${id}" missing from model — structure will be marked unavailable`)
      continue
    }
    const src = node.geometry
    const g = new BufferGeometry()
    g.setAttribute('position', toFloat(src.getAttribute('position') as BufferAttribute, 3))
    if (src.getAttribute('normal')) g.setAttribute('normal', toFloat(src.getAttribute('normal') as BufferAttribute, 3))
    if (src.index) g.setIndex(src.index.clone())
    const p = manifestById.get(id)!.originalPosition
    const m = new Matrix4().makeTranslation(-p[0], -p[1], -p[2]).multiply(node.matrixWorld)
    g.applyMatrix4(m)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    g.computeBoundingSphere()
    g.computeBoundingBox()
    g.computeBoundsTree()
    out.set(id, g)
  }
  return out
}

const selectedSetCache = new Map<string, Set<string>>()
const selectedSet = (id: string | null) => {
  if (!id) return null
  let s = selectedSetCache.get(id)
  if (!s) selectedSetCache.set(id, (s = new Set(meshesOf(id))))
  return s
}

const XRAY_GROUPS = new Set(['cortex'])
const tmpColor = new Color()

interface MeshProps {
  id: string
  geometry: BufferGeometry
  clipPlane: Plane | null
}

const StructureMesh = memo(function StructureMesh({ id, geometry, clipPlane }: MeshProps) {
  const ref = useRef<Mesh>(null)
  const def = byId.get(id)!
  const parentIds = useMemo(() => ancestors(id).map((a) => a.id), [id])
  const outline = useMemo(
    () => Math.min(0.01, Math.max(0.0025, (geometry.boundingSphere?.radius ?? 0.2) * 0.035)),
    [geometry],
  )
  const material = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.62, metalness: 0.02, color: realisticColor(def) }),
    [def],
  )
  useEffect(() => () => material.dispose(), [material])

  const selected = useViewer((s) => !!selectedSet(s.selectedId)?.has(id))
  const hovered = useViewer((s) => {
    if (!s.hoveredMesh) return false
    const t = selectionTarget(s.hoveredMesh, s.granularity)
    return t === id || !!selectedSet(t)?.has(id)
  })
  const hidden = useViewer((s) => !!s.hidden[id] || (!!s.isolated && !s.isolated.includes(id)))
  const opacityOverride = useViewer((s) => s.opacity[id])
  const xray = useViewer((s) => s.xray)
  const hl = useViewer((s) => s.highlight[id])
  const dim = useViewer((s) => s.dimOthers && Object.keys(s.highlight).length > 0)
  const colorMode = useViewer((s) => s.colorMode)
  const isolatedSelf = useViewer((s) => !!s.isolated?.includes(id))

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    meshRegistry.set(id, mesh)
    mesh.name = id
    return () => {
      meshRegistry.delete(id)
    }
  }, [id])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const base = colorMode === 'regions' ? regionColor(def, parentIds) : realisticColor(def)
    material.color.set(base)
    let opacity = opacityOverride ?? 1
    const xrayed =
      xray && !isolatedSelf && (def.groups.some((g) => XRAY_GROUPS.has(g)) || id === 'cerebral-white-matter')
    if (xrayed && !selected) opacity = Math.min(opacity, hl ? 0.4 : 0.09)
    if (dim && !hl && !selected) {
      opacity = Math.min(opacity, 0.12)
      material.color.lerp(tmpColor.set('#64748b'), 0.6)
    }
    if (hl) material.color.lerp(HIGHLIGHT_COLORS[hl], hl === 'tour' ? 0.55 : 0.7)
    material.emissive.copy(
      selected
        ? HIGHLIGHT_COLORS.selected
        : hovered
          ? HIGHLIGHT_COLORS.hover
          : hl
            ? HIGHLIGHT_COLORS[hl]
            : tmpColor.set(0),
    )
    material.emissiveIntensity = selected ? 0.38 : hovered ? 0.22 : hl ? 0.28 : 0
    material.opacity = opacity
    material.transparent = opacity < 0.999
    material.depthWrite = opacity >= 0.6
    material.clippingPlanes = clipPlane ? [clipPlane] : []
    material.side = clipPlane ? DoubleSide : FrontSide
    material.needsUpdate = true
    mesh.renderOrder = opacity < 0.999 ? 2 : def.layer === 0 ? 1 : 0
    // click-through for nearly invisible structures so internal anatomy stays selectable
    mesh.raycast = hidden || opacity < 0.3 ? noRaycast : acceleratedRaycast
  }, [
    material,
    def,
    parentIds,
    selected,
    hovered,
    opacityOverride,
    xray,
    hl,
    dim,
    colorMode,
    clipPlane,
    hidden,
    isolatedSelf,
    id,
  ])

  return (
    <mesh ref={ref} geometry={geometry} material={material} visible={!hidden} name={id}>
      {selected && !hidden && <Outlines thickness={outline} color="#22D3EE" opacity={0.95} transparent angle={0} />}
    </mesh>
  )
})

export function BrainModel({ onReady }: { onReady?: () => void }) {
  const gltf = suspend(loadModel, [MODEL_URL])
  const geometries = useMemo(() => prepareGeometries(gltf.scene), [gltf.scene])
  const clip = useViewer((s) => s.clip)
  const clipPlane = useMemo(() => {
    if (clip.mode === 'none') return null
    if (clip.mode === 'sagittal') return new Plane(new Vector3(1, 0, 0), -clip.offset)
    if (clip.mode === 'coronal') return new Plane(new Vector3(0, 0, -1), clip.offset)
    return new Plane(new Vector3(0, -1, 0), clip.offset)
  }, [clip.mode, clip.offset])

  useEffect(() => {
    onReady?.()
    return () =>
      geometries.forEach((g) => {
        g.disposeBoundsTree()
        g.dispose()
      })
  }, [geometries, onReady])

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    useViewer.getState().setHovered(e.object.name)
  }
  const onPointerOut = () => useViewer.getState().setHovered(null)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 5) return // a drag, not a click
    const s = useViewer.getState()
    s.select(selectionTarget(e.object.name, s.granularity))
  }
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useViewer.getState()
    const target = selectionTarget(e.object.name, s.granularity)
    s.select(target)
    s.requestCamera({ kind: 'focus', id: target })
  }

  return (
    <group onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} onDoubleClick={onDoubleClick}>
      {MESH_IDS.map((id) => {
        const g = geometries.get(id)
        return g ? <StructureMesh key={id} id={id} geometry={g} clipPlane={clipPlane} /> : null
      })}
    </group>
  )
}

preload(loadModel, [MODEL_URL])
