import { Box, Eye, Hand, Layers, MousePointer2, Scissors, Tag, Palette, ScanEye } from 'lucide-react'
import { useViewer, type ClipMode } from '@/stores/viewerStore'
import type { CameraPreset, LabelMode } from '@/types'

const PRESET_LABELS: [CameraPreset, string][] = [
  ['anterior', 'Anterior'], ['posterior', 'Posterior'], ['superior', 'Superior'], ['inferior', 'Inferior'],
  ['left-lateral', 'Left lateral'], ['right-lateral', 'Right lateral'],
  ['sagittal', 'Sagittal section'], ['coronal', 'Coronal section'], ['axial', 'Axial section'],
]

export function ViewControls() {
  const s = useViewer()
  return (
    <div className="glass absolute right-3 top-3 z-10 flex w-56 flex-col gap-2 rounded-xl p-2.5 text-xs max-md:hidden" role="toolbar" aria-label="View controls">
      <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Interaction mode">
        <button className={`btn ${s.mode === 'explore' ? 'btn-active' : ''}`} aria-pressed={s.mode === 'explore'} onClick={() => s.setMode('explore')}>
          <MousePointer2 size={14} /> Explore
        </button>
        <button
          className={`btn ${s.mode === 'dissect' ? 'btn-active' : ''}`}
          aria-pressed={s.mode === 'dissect'}
          onClick={() => s.setMode('dissect')}
          title="Manual Dissection Mode: select a structure and drag the gizmo"
        >
          <Hand size={14} /> Dissect
        </button>
      </div>
      <label className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[var(--text-2)]"><Box size={13} /> Select</span>
        <select className="btn py-1" value={s.granularity} onChange={(e) => s.setGranularity(e.target.value as 'region' | 'detailed')} aria-label="Selection granularity">
          <option value="region">Lobes & regions</option>
          <option value="detailed">Detailed parts</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[var(--text-2)]"><Eye size={13} /> View</span>
        <select
          className="btn py-1"
          defaultValue=""
          aria-label="Camera preset"
          onChange={(e) => {
            if (e.target.value) s.requestCamera({ kind: 'preset', preset: e.target.value as CameraPreset })
            e.target.value = ''
          }}
        >
          <option value="" disabled>Camera preset…</option>
          {PRESET_LABELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[var(--text-2)]"><Tag size={13} /> Labels</span>
        <select className="btn py-1" value={s.labelMode} onChange={(e) => s.updateSettings({ labelMode: e.target.value as LabelMode })} aria-label="Label mode">
          <option value="all">All labels</option>
          <option value="major">Major structures</option>
          <option value="selected">Selected only</option>
          <option value="none">No labels</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[var(--text-2)]"><Palette size={13} /> Colour</span>
        <select className="btn py-1" value={s.colorMode} onChange={(e) => s.updateSettings({ colorMode: e.target.value as 'realistic' | 'regions' })} aria-label="Colour mode">
          <option value="realistic">Realistic tissue</option>
          <option value="regions">Region colours</option>
        </select>
      </label>
      <button className={`btn ${s.xray ? 'btn-active' : ''}`} aria-pressed={s.xray} onClick={() => s.setXray(!s.xray)} title="Make cortex and white matter transparent to reveal internal structures">
        <ScanEye size={14} /> X-ray cortex {s.xray ? 'on' : 'off'}
      </button>
      <div className="flex flex-col gap-1">
        <label className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[var(--text-2)]"><Scissors size={13} /> Section</span>
          <select className="btn py-1" value={s.clip.mode} onChange={(e) => s.setClip({ mode: e.target.value as ClipMode })} aria-label="Section plane">
            <option value="none">None</option>
            <option value="sagittal">Sagittal</option>
            <option value="coronal">Coronal</option>
            <option value="axial">Axial</option>
          </select>
        </label>
        {s.clip.mode !== 'none' && (
          <input type="range" min={-0.8} max={0.8} step={0.01} value={s.clip.offset} aria-label="Section plane position" onChange={(e) => s.setClip({ offset: +e.target.value })} />
        )}
      </div>
      <button className="btn" onClick={() => s.requestCamera({ kind: 'reset' })}>
        <Layers size={14} /> Reset camera
      </button>
    </div>
  )
}

export { PRESET_LABELS }
