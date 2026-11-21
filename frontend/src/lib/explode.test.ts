import { describe, expect, it } from 'vitest'
import { MANIFEST, meshesOf, manifestById } from './anatomy'
import { activeLayer, centroidOf, easeInOutCubic, explodeOffset, layerWindow, localProgress, nextStep } from './explode'
import type { Vec3 } from '@/types'

const mesh = (id: string) => manifestById.get(id)!

describe('exploded-view math', () => {
  it('is deterministic: identical inputs give identical offsets', () => {
    const a = MANIFEST.meshes.map((m) => explodeOffset(m, 'complete', 0.37, 1.1, null, [0, 0, 0]))
    const b = MANIFEST.meshes.map((m) => explodeOffset(m, 'complete', 0.37, 1.1, null, [0, 0, 0]))
    expect(a).toEqual(b)
  })

  it('is zero at progress 0 and equals direction × weight × distance at 1', () => {
    for (const m of MANIFEST.meshes) {
      expect(explodeOffset(m, 'complete', 0, 1, null)).toEqual([0, 0, 0])
      const o = explodeOffset(m, 'complete', 1, 1.5, null)
      m.explodeDirection.forEach((d, i) => expect(o[i]).toBeCloseTo(d * m.explodeWeight * 1.5, 10))
    }
  })

  it('easing is symmetric so reverse playback mirrors forward', () => {
    for (const t of [0.1, 0.25, 0.4, 0.5]) expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 12)
  })

  it('scrubbing to 50% gives a deterministic intermediate state between start and end', () => {
    const m = mesh('cerebellum')
    const half = explodeOffset(m, 'complete', 0.5, 1, null)
    const full = explodeOffset(m, 'complete', 1, 1, null)
    half.forEach((v, i) => expect(v).toBeCloseTo(full[i] * 0.5, 10))
  })

  it('layer-by-layer mode moves cortex before the cerebellum', () => {
    const cortex = mesh('left-precentral-gyrus')
    const cb = mesh('cerebellum')
    expect(localProgress(cortex, 'layered', 0.2, false)).toBeGreaterThan(0.5)
    expect(localProgress(cb, 'layered', 0.2, false)).toBe(0)
    expect(localProgress(cb, 'layered', 1, false)).toBe(1)
    expect(layerWindow(0)[0]).toBe(0)
    expect(layerWindow(5)[1]).toBe(1)
    expect(activeLayer(0.8)).toBe(5)
  })

  it('selected-region mode only moves members of the group, away from its own centroid', () => {
    const members = meshesOf('left-temporal-lobe')
    const group = { members: new Set(members), centroid: centroidOf(members.map(mesh)) as Vec3 }
    expect(explodeOffset(mesh('cerebellum'), 'selected', 1, 1, group)).toEqual([0, 0, 0])
    for (const id of members) {
      const m = mesh(id)
      const o = explodeOffset(m, 'selected', 1, 1, group)
      expect(Math.hypot(...o)).toBeGreaterThan(0.1)
    }
  })

  it('left structures explode toward +X (patient left) and right toward -X', () => {
    expect(explodeOffset(mesh('left-angular-gyrus'), 'complete', 1, 1, null)[0]).toBeGreaterThan(0)
    expect(explodeOffset(mesh('right-angular-gyrus'), 'complete', 1, 1, null)[0]).toBeLessThan(0)
  })

  it('step controls move between boundaries', () => {
    expect(nextStep('complete', 0, 1)).toBe(0.25)
    expect(nextStep('complete', 0.25, -1)).toBe(0)
    expect(nextStep('layered', 0, 1)).toBeCloseTo(0.15)
  })
})
