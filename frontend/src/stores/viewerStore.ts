import { create } from 'zustand'
import type {
  CameraPreset,
  ColorMode,
  HighlightStyle,
  LabelMode,
  LearningLevel,
  Quality,
  SelectGranularity,
  Vec3,
} from '@/types'
import { meshesOf } from '@/lib/anatomy'

export type ClipMode = 'none' | 'sagittal' | 'coronal' | 'axial'
export type CameraRequest =
  | { kind: 'preset'; preset: CameraPreset; nonce: number }
  | { kind: 'focus'; id: string; nonce: number }
  | { kind: 'reset'; nonce: number }
  | { kind: 'overview'; scale: number; nonce: number }

export interface Lesion {
  position: Vec3
  radius: number
  massEffect: number
}

interface Settings {
  level: LearningLevel
  quality: Quality
  theme: 'dark' | 'light'
  reducedMotion: boolean
  colorMode: ColorMode
  labelMode: LabelMode
  showOrientation: boolean
}

const SETTINGS_KEY = 'neurosphere.settings.v1'
function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>
  } catch {
    return {}
  }
}
const prefersReduced =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export interface ViewerState extends Settings {
  selectedId: string | null
  hoveredMesh: string | null
  hidden: Record<string, true>
  opacity: Record<string, number>
  locked: Record<string, true>
  isolated: string[] | null
  xray: boolean
  granularity: SelectGranularity
  mode: 'explore' | 'dissect'
  gizmoMode: 'translate' | 'rotate'
  snap: boolean
  highlight: Record<string, HighlightStyle>
  highlightCaption: string | null
  dimOthers: boolean
  pulse: boolean
  clip: { mode: ClipMode; offset: number }
  cameraRequest: CameraRequest | null
  lesion: Lesion | null
  leftOpen: boolean
  rightOpen: boolean
  showConnections: boolean

  select: (id: string | null) => void
  setHovered: (id: string | null) => void
  toggleHidden: (id: string, value?: boolean) => void
  showAll: () => void
  setOpacity: (id: string, value: number) => void
  toggleLocked: (id: string) => void
  isolate: (id: string | null) => void
  setXray: (v: boolean) => void
  setGranularity: (g: SelectGranularity) => void
  setMode: (m: 'explore' | 'dissect') => void
  setGizmoMode: (m: 'translate' | 'rotate') => void
  setSnap: (v: boolean) => void
  setHighlight: (h: Record<string, HighlightStyle>, caption?: string | null, dim?: boolean) => void
  clearHighlight: () => void
  setPulse: (v: boolean) => void
  setClip: (c: Partial<{ mode: ClipMode; offset: number }>) => void
  requestCamera: (
    r:
      | { kind: 'preset'; preset: CameraPreset }
      | { kind: 'focus'; id: string }
      | { kind: 'reset' }
      | { kind: 'overview'; scale: number },
  ) => void
  setLesion: (l: Lesion | null) => void
  setPanel: (side: 'left' | 'right', open: boolean) => void
  setShowConnections: (v: boolean) => void
  updateSettings: (s: Partial<Settings>) => void
  resetView: () => void
}

let nonce = 0
const defaults: Settings = {
  level: 'intermediate',
  quality: 'high',
  theme: 'dark',
  reducedMotion: prefersReduced,
  colorMode: 'realistic',
  labelMode: 'selected',
  showOrientation: true,
}

export const useViewer = create<ViewerState>((set, get) => ({
  ...defaults,
  ...loadSettings(),
  selectedId: null,
  hoveredMesh: null,
  hidden: {},
  opacity: {},
  locked: {},
  isolated: null,
  xray: false,
  granularity: 'region',
  mode: 'explore',
  gizmoMode: 'translate',
  snap: false,
  highlight: {},
  highlightCaption: null,
  dimOthers: false,
  pulse: false,
  clip: { mode: 'none', offset: 0 },
  cameraRequest: null,
  lesion: null,
  leftOpen: typeof window === 'undefined' || window.innerWidth >= 1024,
  rightOpen: typeof window === 'undefined' || window.innerWidth >= 1024,
  showConnections: false,

  select: (id) => set({ selectedId: id, showConnections: false, ...(id ? { rightOpen: true } : {}) }),
  setHovered: (id) => (get().hoveredMesh === id ? undefined : set({ hoveredMesh: id })),
  toggleHidden: (id, value) =>
    set((s) => {
      const hidden = { ...s.hidden }
      const ids = meshesOf(id)
      const hide = value ?? !ids.every((m) => hidden[m])
      for (const m of ids) {
        if (hide) hidden[m] = true
        else delete hidden[m]
      }
      return { hidden }
    }),
  showAll: () => set({ hidden: {}, isolated: null }),
  setOpacity: (id, value) =>
    set((s) => {
      const opacity = { ...s.opacity }
      for (const m of meshesOf(id)) {
        if (value >= 0.999) delete opacity[m]
        else opacity[m] = value
      }
      return { opacity }
    }),
  toggleLocked: (id) =>
    set((s) => {
      const locked = { ...s.locked }
      const ids = meshesOf(id)
      const lock = !ids.every((m) => locked[m])
      for (const m of ids) {
        if (lock) locked[m] = true
        else delete locked[m]
      }
      return { locked }
    }),
  isolate: (id) => set({ isolated: id ? meshesOf(id) : null }),
  setXray: (xray) => set({ xray }),
  setGranularity: (granularity) => set({ granularity }),
  setMode: (mode) => set({ mode }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setSnap: (snap) => set({ snap }),
  setHighlight: (highlight, caption = null, dim = true) =>
    set({ highlight, highlightCaption: caption, dimOthers: dim }),
  clearHighlight: () => set({ highlight: {}, highlightCaption: null, dimOthers: false, pulse: false }),
  setPulse: (pulse) => set({ pulse }),
  setClip: (c) => set((s) => ({ clip: { ...s.clip, ...c } })),
  requestCamera: (r) => set({ cameraRequest: { ...r, nonce: ++nonce } as CameraRequest }),
  setLesion: (lesion) => set({ lesion }),
  setPanel: (side, open) => set(side === 'left' ? { leftOpen: open } : { rightOpen: open }),
  setShowConnections: (showConnections) => set({ showConnections }),
  updateSettings: (s) => {
    set(s)
    const { level, quality, theme, reducedMotion, colorMode, labelMode, showOrientation } = { ...get() }
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ level, quality, theme, reducedMotion, colorMode, labelMode, showOrientation }),
      )
    } catch {
      /* storage unavailable (private mode / sandbox) — settings stay in memory */
    }
  },
  resetView: () =>
    set({
      selectedId: null,
      hidden: {},
      opacity: {},
      locked: {},
      isolated: null,
      xray: false,
      highlight: {},
      highlightCaption: null,
      dimOthers: false,
      pulse: false,
      clip: { mode: 'none', offset: 0 },
      lesion: null,
      showConnections: false,
      mode: 'explore',
    }),
}))
