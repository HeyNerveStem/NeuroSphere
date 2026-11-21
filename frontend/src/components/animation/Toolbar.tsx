import {
  Camera, ChevronsLeftRight, Expand, Lock, Maximize, Minimize2, Move3d, Pause, Play, Redo2, RefreshCcw, Repeat,
  Rotate3d, RotateCcw, SkipBack, SkipForward, Undo2, Magnet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { LAYER_NAMES } from '@/lib/explode'
import { MESH_IDS, byId, meshesOf, structureName, STRUCTURES } from '@/lib/anatomy'
import { SPEEDS, useAnimation } from '@/stores/animationStore'
import { transforms, useTransformMeta } from '@/stores/transformStore'
import { useViewer } from '@/stores/viewerStore'
import { overlay } from '@/three/registry'
import type { CameraPreset, ExplodeMode } from '@/types'

const MODE_LABELS: Record<ExplodeMode, string> = {
  complete: 'A · Complete disassembly',
  layered: 'B · Layer by layer',
  selected: 'C · Selected region',
  guided: 'D · Guided (captioned)',
}
const GUIDED_CAMERA: CameraPreset[] = ['left-lateral', 'superior', 'anterior', 'anterior', 'left-lateral', 'posterior']
const GUIDED_TEXT = [
  'The cerebral cortex — folded grey matter of the frontal, parietal, temporal and occipital lobes — moves outward first.',
  'Deeper cortex (insula, cingulate, parahippocampal gyri), the white-matter envelope and corpus callosum follow.',
  'Subcortical nuclei (caudate, putamen, globus pallidus), hippocampus, amygdala and the lateral ventricles are revealed.',
  'The diencephalon — thalamus, hypothalamus, pituitary, pineal — and the anterior visual pathway separate.',
  'The brainstem — midbrain, pons and medulla — moves down, linking brain and spinal cord.',
  'Finally the cerebellum moves back, revealing the fourth ventricle in front of it.',
]

/** Region used by "selected region" disassembly: the selected group, or the parent group of a selected part. */
export function groupFor(id: string | null): string {
  if (!id) return 'left-cerebral-hemisphere'
  const s = byId.get(id)
  if (!s) return 'left-cerebral-hemisphere'
  return s.kind === 'group' ? id : (s.parentId ?? 'brain')
}

export function resetAll() {
  useAnimation.getState().reset()
  useViewer.getState().resetView()
  transforms.returnToOriginal(MESH_IDS)
}

export function screenshot() {
  const c = overlay.canvas
  if (!c) return
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `neurosphere-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
  a.click()
}

export function GuidedCaption() {
  const mode = useAnimation((s) => s.mode)
  const phase = useAnimation((s) => s.animationPhase)
  const progress = useAnimation((s) => s.progress)
  const playing = useAnimation((s) => s.playing)
  useEffect(() => {
    if (mode !== 'guided' || (!playing && progress === 0)) return
    const v = useViewer.getState()
    v.requestCamera({ kind: 'preset', preset: GUIDED_CAMERA[phase] })
    const hl: Record<string, 'tour'> = {}
    for (const id of MESH_IDS) if (byId.get(id)!.layer === phase) hl[id] = 'tour'
    v.setHighlight(hl, `Layer ${phase + 1}: ${LAYER_NAMES[phase]}`, false)
  }, [mode, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  if (mode !== 'guided' || progress === 0) return null
  return (
    <div className="glass absolute bottom-3 left-1/2 z-10 w-[min(36rem,92%)] -translate-x-1/2 rounded-xl p-3 text-sm" role="status" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Layer {phase + 1} of 6 · {LAYER_NAMES[phase]}</p>
      <p className="mt-1 leading-snug">{GUIDED_TEXT[phase]}</p>
    </div>
  )
}

export function Toolbar({ fullscreenTarget }: { fullscreenTarget?: () => HTMLElement | null }) {
  const a = useAnimation()
  const v = useViewer()
  const meta = useTransformMeta()
  const [cortexOpacity, setCortexOpacity] = useState(1)
  const [isFs, setFs] = useState(false)
  const [more, setMore] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024)
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const groupOptions = STRUCTURES.filter((s) => s.kind === 'group' && s.id !== 'brain')
  const selectedLocked = v.selectedId ? meshesOf(v.selectedId).every((m) => v.locked[m]) : false

  return (
    <div className="glass flex flex-col gap-2 rounded-xl p-2 text-xs" role="toolbar" aria-label="Disassembly and animation controls">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="btn py-1"
          value={a.mode}
          aria-label="Disassembly mode"
          onChange={(e) => {
            const m = e.target.value as ExplodeMode
            a.setMode(m, m === 'selected' ? groupFor(v.selectedId) : undefined)
            if (m !== 'guided') useViewer.getState().clearHighlight()
          }}
        >
          {(Object.keys(MODE_LABELS) as ExplodeMode[]).map((k) => <option key={k} value={k}>{MODE_LABELS[k]}</option>)}
        </select>
        {a.mode === 'selected' && (
          <select className="btn max-w-44 py-1" value={a.activeGroup ?? ''} onChange={(e) => a.setMode('selected', e.target.value)} aria-label="Region to disassemble">
            {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            if (a.mode !== 'selected') v.requestCamera({ kind: 'overview', scale: 1 + a.explosionDistance * 0.75 })
            else v.requestCamera({ kind: 'focus', id: a.activeGroup ?? 'brain' })
            a.disassemble()
          }}
          data-testid="disassemble"
        >
          <Expand size={14} /> Disassemble
        </button>
        <button className="btn" onClick={() => a.reassemble()} data-testid="assemble">
          <Minimize2 size={14} /> Assemble
        </button>
        <span className="mx-0.5 h-5 w-px bg-[var(--border)]" aria-hidden />
        <button className="btn lg:hidden" onClick={() => setMore(!more)} aria-expanded={more} aria-label="More controls">{more ? 'Less' : 'More'}</button>
        <button className="btn btn-icon" onClick={() => a.step(-1)} aria-label="Step backward"><SkipBack size={14} /></button>
        <button className="btn btn-icon" onClick={a.toggle} aria-label={a.playing ? 'Pause' : 'Play'} data-testid="play">
          {a.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="btn btn-icon" onClick={() => a.step(1)} aria-label="Step forward"><SkipForward size={14} /></button>
        <button className={`btn btn-icon ${a.direction < 0 ? 'btn-active' : ''}`} onClick={a.reverse} aria-label="Reverse direction" data-testid="reverse">
          <ChevronsLeftRight size={14} />
        </button>
        <button className="btn btn-icon" onClick={a.restart} aria-label="Restart animation"><Repeat size={14} /></button>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <input
            type="range" min={0} max={1} step={0.001} value={a.progress} className="w-full"
            aria-label="Animation timeline" data-testid="timeline"
            onChange={(e) => a.setProgress(+e.target.value)}
          />
          <span className="w-9 tabular-nums text-[var(--text-2)]">{Math.round(a.progress * 100)}%</span>
        </div>
        <select className="btn py-1" value={a.playbackSpeed} onChange={(e) => a.setSpeed(+e.target.value)} aria-label="Animation speed">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>
      <div className={`flex-wrap items-center gap-x-3 gap-y-1.5 ${more ? 'flex' : 'hidden'}`}>
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--text-2)]">Explosion</span>
          <input type="range" min={0.2} max={2} step={0.05} value={a.explosionDistance} onChange={(e) => a.setDistance(+e.target.value)} aria-label="Exploded-view distance" />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--text-2)]">Cortex opacity</span>
          <input
            type="range" min={0.05} max={1} step={0.05} value={cortexOpacity} aria-label="Cortex transparency"
            onChange={(e) => {
              const val = +e.target.value
              setCortexOpacity(val)
              for (const id of MESH_IDS) if (byId.get(id)!.groups.includes('cortex')) useViewer.getState().setOpacity(id, val)
            }}
          />
        </label>
        <span className="flex-1" />
        {v.mode === 'dissect' && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Manual dissection">
            <button className={`btn btn-icon ${v.gizmoMode === 'translate' ? 'btn-active' : ''}`} onClick={() => v.setGizmoMode('translate')} aria-label="Move tool"><Move3d size={14} /></button>
            <button className={`btn btn-icon ${v.gizmoMode === 'rotate' ? 'btn-active' : ''}`} onClick={() => v.setGizmoMode('rotate')} aria-label="Rotate tool"><Rotate3d size={14} /></button>
            <button className={`btn btn-icon ${v.snap ? 'btn-active' : ''}`} onClick={() => v.setSnap(!v.snap)} aria-label="Snap to grid" aria-pressed={v.snap}><Magnet size={14} /></button>
            <button className={`btn btn-icon ${selectedLocked ? 'btn-active' : ''}`} disabled={!v.selectedId} onClick={() => v.selectedId && v.toggleLocked(v.selectedId)} aria-label="Lock selected position" aria-pressed={selectedLocked}><Lock size={14} /></button>
            <button className="btn btn-icon" disabled={!meta.canUndo} onClick={transforms.undo} aria-label="Undo move"><Undo2 size={14} /></button>
            <button className="btn btn-icon" disabled={!meta.canRedo} onClick={transforms.redo} aria-label="Redo move"><Redo2 size={14} /></button>
            {!v.selectedId && <span className="text-[var(--text-2)]">Select a structure to drag it</span>}
            {v.selectedId && <span className="max-w-40 truncate text-[var(--text-2)]">Moving: {structureName(v.selectedId)}</span>}
          </div>
        )}
        <button className="btn" disabled={!meta.moved} onClick={() => transforms.returnToOriginal(MESH_IDS)} data-testid="reassemble-all">
          <RotateCcw size={14} /> Reassemble all {meta.moved ? `(${meta.moved})` : ''}
        </button>
        <button className="btn" onClick={resetAll} data-testid="reset-all"><RefreshCcw size={14} /> Reset all</button>
        <button className="btn btn-icon" onClick={screenshot} aria-label="Save screenshot"><Camera size={14} /></button>
        <button
          className="btn btn-icon"
          aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : fullscreenTarget?.()?.requestFullscreen?.())}
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  )
}
