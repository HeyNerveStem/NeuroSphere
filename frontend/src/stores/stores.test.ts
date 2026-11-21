import { beforeEach, describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { transforms, useTransformMeta } from './transformStore'
import { useAnimation } from './animationStore'
import { useViewer } from './viewerStore'
import { meshesOf } from '@/lib/anatomy'

describe('manual transform store', () => {
  beforeEach(() => transforms.resetAllImmediate())

  it('translates only the targeted meshes', () => {
    transforms.pushHistory()
    transforms.translate(['cerebellum'], new Vector3(0, 0, -0.5))
    expect(transforms.get('cerebellum').offset.z).toBeCloseTo(-0.5)
    expect(transforms.get('pons').offset.lengthSq()).toBe(0)
    transforms.endManipulation()
    expect(useTransformMeta.getState().moved).toBe(1)
  })

  it('returns to exactly the original transform (no drift)', () => {
    transforms.translate(['cerebellum'], new Vector3(0.123456, -0.3, 0.77))
    transforms.rotate(
      ['cerebellum'],
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.2),
      new Vector3(),
      new Map([['cerebellum', new Vector3(0, 0, -0.5)]]),
    )
    transforms.returnToOriginal(['cerebellum'])
    for (let i = 0; i < 400 && transforms.isReturning('cerebellum'); i++) transforms.stepReturn(1 / 60, false)
    const t = transforms.get('cerebellum')
    expect(t.offset.toArray()).toEqual([0, 0, 0])
    expect(t.rotation.toArray()).toEqual([0, 0, 0, 1])
  })

  it('supports undo and redo', () => {
    transforms.pushHistory()
    transforms.translate(['pons'], new Vector3(1, 0, 0))
    transforms.undo()
    expect(transforms.get('pons').offset.x).toBe(0)
    transforms.redo()
    expect(transforms.get('pons').offset.x).toBe(1)
  })

  it('group rotation moves members around the pivot', () => {
    const ids = ['left-caudate-nucleus']
    const pos = new Map([['left-caudate-nucleus', new Vector3(1, 0, 0)]])
    transforms.rotate(
      ids,
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      new Vector3(0, 0, 0),
      pos,
    )
    const o = transforms.get('left-caudate-nucleus').offset
    expect(o.x).toBeCloseTo(-1)
    expect(o.z).toBeCloseTo(-1)
  })
})

describe('animation store', () => {
  beforeEach(() => useAnimation.getState().reset())

  it('plays forward and stops at 1', () => {
    const a = useAnimation.getState()
    a.play(1)
    for (let i = 0; i < 100; i++) useAnimation.getState().tick(0.1)
    expect(useAnimation.getState().progress).toBe(1)
    expect(useAnimation.getState().playing).toBe(false)
  })

  it('respects playback speed', () => {
    useAnimation.getState().setSpeed(2)
    useAnimation.getState().play(1)
    useAnimation.getState().tick(0.5)
    expect(useAnimation.getState().progress).toBeCloseTo(0.25)
    useAnimation.getState().setSpeed(1)
  })

  it('scrub pauses and sets exact progress; reverse runs backwards without jumps', () => {
    const a = useAnimation.getState()
    a.play(1)
    a.setProgress(0.5)
    expect(useAnimation.getState().playing).toBe(false)
    expect(useAnimation.getState().progress).toBe(0.5)
    useAnimation.getState().reverse()
    useAnimation.getState().tick(0.1)
    const p = useAnimation.getState().progress
    expect(p).toBeLessThan(0.5)
    expect(0.5 - p).toBeCloseTo(0.1 / 4, 6)
  })

  it('animateTo stops exactly at the target', () => {
    useAnimation.getState().animateTo(0.6)
    for (let i = 0; i < 100; i++) useAnimation.getState().tick(0.05)
    expect(useAnimation.getState().progress).toBe(0.6)
  })
})

describe('viewer store', () => {
  it('hides, isolates and resets', () => {
    const v = useViewer.getState()
    v.toggleHidden('left-frontal-lobe')
    for (const m of meshesOf('left-frontal-lobe')) expect(useViewer.getState().hidden[m]).toBe(true)
    v.isolate('cerebellum')
    expect(useViewer.getState().isolated).toEqual(['cerebellum'])
    v.resetView()
    expect(useViewer.getState().hidden).toEqual({})
    expect(useViewer.getState().isolated).toBeNull()
  })
})
