import { create } from 'zustand'
import type { ExplodeMode } from '@/types'
import { activeLayer, clamp01, nextStep } from '@/lib/explode'

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const
/** seconds for a full 0→1 sweep at 1× */
export const BASE_DURATION = 4

export interface AnimationState {
  mode: ExplodeMode
  progress: number
  playing: boolean
  playbackSpeed: number
  direction: 1 | -1
  explosionDistance: number
  activeGroup: string | null
  animationPhase: number
  /** optional stop point for animateTo() */
  target: number | null
  animateTo: (p: number) => void
  setMode: (m: ExplodeMode, group?: string | null) => void
  setProgress: (p: number) => void
  play: (direction?: 1 | -1) => void
  pause: () => void
  toggle: () => void
  reverse: () => void
  restart: () => void
  reset: () => void
  step: (dir: 1 | -1) => void
  setSpeed: (s: number) => void
  setDistance: (d: number) => void
  disassemble: (mode?: ExplodeMode, group?: string | null) => void
  reassemble: () => void
  tick: (dt: number) => void
}

export const useAnimation = create<AnimationState>((set, get) => ({
  mode: 'complete',
  progress: 0,
  playing: false,
  playbackSpeed: 1,
  direction: 1,
  explosionDistance: 0.9,
  activeGroup: null,
  animationPhase: 0,
  target: null,
  animateTo: (p) => {
    const t = clamp01(p)
    const cur = get().progress
    if (Math.abs(t - cur) < 1e-3) return set({ progress: t, playing: false, target: null })
    set({ target: t, direction: t > cur ? 1 : -1, playing: true })
  },
  setMode: (mode, group) => set({ mode, ...(group !== undefined ? { activeGroup: group } : {}) }),
  setProgress: (p) => {
    const progress = clamp01(p)
    set({ progress, animationPhase: activeLayer(progress), playing: false, target: null })
  },
  play: (direction) => {
    const d = direction ?? get().direction
    const p = get().progress
    // restart from the corresponding end if already finished in this direction
    if (d > 0 && p >= 1) set({ progress: 0 })
    if (d < 0 && p <= 0) set({ progress: 1 })
    set({ playing: true, direction: d, target: null })
  },
  pause: () => set({ playing: false, target: null }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  reverse: () => set((s) => ({ direction: (s.direction * -1) as 1 | -1, playing: true })),
  restart: () => set((s) => ({ progress: s.direction > 0 ? 0 : 1, playing: true })),
  reset: () => set({ progress: 0, playing: false, direction: 1, animationPhase: 0, target: null }),
  step: (dir) => {
    const s = get()
    const progress = nextStep(s.mode, s.progress, dir)
    set({ progress, playing: false, animationPhase: activeLayer(progress) })
  },
  setSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setDistance: (explosionDistance) => set({ explosionDistance }),
  disassemble: (mode, group) => {
    if (mode) set({ mode })
    if (group !== undefined) set({ activeGroup: group })
    get().play(1)
  },
  reassemble: () => get().play(-1),
  tick: (dt) => {
    const s = get()
    if (!s.playing) return
    let progress = s.progress + (dt * s.playbackSpeed * s.direction) / BASE_DURATION
    let playing = true
    let target = s.target
    if (target !== null && ((s.direction > 0 && progress >= target) || (s.direction < 0 && progress <= target))) {
      progress = target
      playing = false
      target = null
    }
    if (progress >= 1) {
      progress = 1
      playing = false
    } else if (progress <= 0) {
      progress = 0
      playing = false
    }
    set({ progress, playing, target, animationPhase: activeLayer(progress) })
  },
}))
