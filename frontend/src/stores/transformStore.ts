/**
 * Manual-dissection transform state.
 *
 * The single authoritative transform of each structure is composed every frame as
 *   final = original + explodeOffset(animation) + manualOffset (+ lesion push)
 *   rotation = manualRotation
 * `original` comes from the validated manifest and is never mutated, so
 * returning a structure means driving its manual offset back to exactly zero —
 * no accumulated drift is possible.
 *
 * Offsets live in plain mutable objects (read inside useFrame without React
 * renders). A small zustand store exposes a version counter for UI badges.
 */
import { create } from 'zustand'
import { Quaternion, Vector3 } from 'three'
import { MESH_IDS } from '@/lib/anatomy'

export interface ManualTransform {
  offset: Vector3
  rotation: Quaternion
}

const manual = new Map<string, ManualTransform>()
for (const id of MESH_IDS) manual.set(id, { offset: new Vector3(), rotation: new Quaternion() })

/** ids currently animating back to their original transform */
const returning = new Set<string>()

type Snapshot = Record<string, [number, number, number, number, number, number, number]>
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

export const useTransformMeta = create<{ version: number; moved: number; canUndo: boolean; canRedo: boolean }>(() => ({
  version: 0,
  moved: 0,
  canUndo: false,
  canRedo: false,
}))

function bump() {
  let moved = 0
  for (const t of manual.values()) if (t.offset.lengthSq() > 1e-10 || Math.abs(t.rotation.w) < 0.999999) moved++
  useTransformMeta.setState((s) => ({
    version: s.version + 1,
    moved,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }))
}

function snapshot(): Snapshot {
  const s: Snapshot = {}
  for (const [id, t] of manual) {
    if (t.offset.lengthSq() > 0 || t.rotation.w !== 1) {
      s[id] = [t.offset.x, t.offset.y, t.offset.z, t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w]
    }
  }
  return s
}

function restore(s: Snapshot) {
  returning.clear()
  for (const [id, t] of manual) {
    const v = s[id]
    if (v) {
      t.offset.set(v[0], v[1], v[2])
      t.rotation.set(v[3], v[4], v[5], v[6])
    } else {
      t.offset.set(0, 0, 0)
      t.rotation.identity()
    }
  }
}

export const transforms = {
  get: (id: string) => manual.get(id)!,
  isReturning: (id: string) => returning.has(id),
  returningCount: () => returning.size,
  /** Call before a user manipulation starts so it can be undone. */
  pushHistory() {
    undoStack.push(snapshot())
    if (undoStack.length > 100) undoStack.shift()
    redoStack.length = 0
    bump()
  },
  translate(ids: string[], delta: Vector3) {
    for (const id of ids) {
      returning.delete(id)
      manual.get(id)!.offset.add(delta)
    }
  },
  /** rotate a set of meshes about a pivot: positions passed are current world positions */
  rotate(ids: string[], dq: Quaternion, pivot: Vector3, currentPositions: Map<string, Vector3>) {
    const tmp = new Vector3()
    for (const id of ids) {
      returning.delete(id)
      const t = manual.get(id)!
      const p = currentPositions.get(id)
      if (p) {
        tmp.copy(p).sub(pivot).applyQuaternion(dq).add(pivot)
        t.offset.add(tmp.sub(p))
      }
      t.rotation.premultiply(dq).normalize()
    }
  },
  endManipulation() {
    bump()
  },
  /** Smoothly return the given meshes to their original transform. */
  returnToOriginal(ids: string[]) {
    transforms.pushHistory()
    for (const id of ids) returning.add(id)
  },
  /** Advance return animations; called from the render loop. */
  stepReturn(dt: number, instant: boolean) {
    if (!returning.size) return false
    const k = instant ? 1 : 1 - Math.exp(-dt * 7)
    const ident = new Quaternion()
    for (const id of [...returning]) {
      const t = manual.get(id)!
      t.offset.multiplyScalar(1 - k)
      t.rotation.slerp(ident, k)
      if (t.offset.lengthSq() < 1e-8 && Math.abs(t.rotation.w) > 0.9999999) {
        // snap exactly to the validated original transform
        t.offset.set(0, 0, 0)
        t.rotation.identity()
        returning.delete(id)
      }
    }
    if (!returning.size) bump()
    return true
  },
  resetAllImmediate() {
    returning.clear()
    for (const t of manual.values()) {
      t.offset.set(0, 0, 0)
      t.rotation.identity()
    }
    undoStack.length = 0
    redoStack.length = 0
    bump()
  },
  isMoved(id: string) {
    const t = manual.get(id)
    return !!t && (t.offset.lengthSq() > 1e-10 || Math.abs(t.rotation.w) < 0.999999)
  },
  undo() {
    const s = undoStack.pop()
    if (!s) return
    redoStack.push(snapshot())
    restore(s)
    bump()
  },
  redo() {
    const s = redoStack.pop()
    if (!s) return
    undoStack.push(snapshot())
    restore(s)
    bump()
  },
}
