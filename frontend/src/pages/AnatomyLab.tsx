import { Keyboard, ListTree, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, SlidersHorizontal, Info } from 'lucide-react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Viewport } from '@/components/viewer/Viewport'
import { ViewControls, PRESET_LABELS } from '@/components/viewer/ViewControls'
import { GuidedCaption, Toolbar } from '@/components/animation/Toolbar'
import { StructureTree } from '@/components/anatomy/StructureTree'
import { InfoPanel } from '@/components/anatomy/InfoPanel'
import { useKeyboardShortcuts, useWhenModelReady } from '@/hooks/useViewerHooks'
import { useViewer } from '@/stores/viewerStore'
import { byId } from '@/lib/anatomy'
import { DISCLAIMER } from '@/components/ui/ReferenceList'

function MobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface-solid)] shadow-2xl lg:hidden" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="mx-auto h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden />
      </div>
      <div className="flex items-center justify-between px-4 pb-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows = [
    ['Click / tap', 'Select structure'], ['Double-click', 'Focus camera on structure'], ['Drag', 'Rotate'], ['Right-drag / two fingers', 'Pan'],
    ['Wheel / pinch', 'Zoom'], ['Space', 'Play / pause animation'], ['← / →', 'Step animation'], ['F', 'Focus selected'], ['H', 'Hide / show selected'],
    ['I', 'Isolate selected'], ['X', 'Toggle X-ray'], ['D', 'Toggle manual dissection mode'], ['R', 'Return selected to original position'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / redo moves'], ['1–6', 'Camera presets'], ['Esc', 'Clear selection'],
  ]
  return (
    <div className="glass absolute left-1/2 top-1/2 z-30 w-[min(26rem,92%)] -translate-x-1/2 -translate-y-1/2 rounded-xl p-4 text-sm" role="dialog" aria-label="Keyboard shortcuts">
      <h2 className="mb-2 font-semibold">Controls & keyboard shortcuts</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        {rows.map(([k, d]) => (
          <div key={k} className="contents"><dt className="font-mono text-[var(--accent)]">{k}</dt><dd>{d}</dd></div>
        ))}
      </dl>
      <button className="btn mt-3 w-full" onClick={onClose}>Close</button>
    </div>
  )
}

export default function AnatomyLab() {
  const { structureId } = useParams()
  const leftOpen = useViewer((s) => s.leftOpen)
  const rightOpen = useViewer((s) => s.rightOpen)
  const selectedId = useViewer((s) => s.selectedId)
  const [sheet, setSheet] = useState<'tree' | 'info' | 'controls' | null>(null)
  const [help, setHelp] = useState(false)
  const centerRef = useRef<HTMLDivElement>(null)
  useKeyboardShortcuts()

  useWhenModelReady(() => {
    if (structureId && byId.has(structureId)) {
      const v = useViewer.getState()
      v.select(structureId)
      v.requestCamera({ kind: 'focus', id: structureId })
    }
  }, [structureId])

  const setPanel = useViewer.getState().setPanel
  return (
    <div className="flex h-full min-h-0">
      {leftOpen && (
        <aside className="hidden w-72 shrink-0 border-r border-[var(--border)] bg-[var(--bg-2)] lg:block" aria-label="Anatomical structures">
          <StructureTree />
        </aside>
      )}
      <div ref={centerRef} className="relative min-w-0 flex-1 bg-[var(--bg)]">
        <Viewport>
          <ViewControls />
          <GuidedCaption />
        </Viewport>
        <div className="absolute left-3 top-3 z-10 hidden gap-1 lg:flex">
          <button className="btn btn-icon glass" onClick={() => setPanel('left', !leftOpen)} aria-label={leftOpen ? 'Collapse structure panel' : 'Expand structure panel'}>
            {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <button className="btn btn-icon glass" onClick={() => setHelp(!help)} aria-label="Show controls and keyboard shortcuts"><Keyboard size={15} /></button>
        </div>
        <div className="absolute right-[15.5rem] top-3 z-10 hidden lg:block">
          <button className="btn btn-icon glass" onClick={() => setPanel('right', !rightOpen)} aria-label={rightOpen ? 'Collapse information panel' : 'Expand information panel'}>
            {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
        {help && <ShortcutHelp onClose={() => setHelp(false)} />}
        <div className="absolute inset-x-2 bottom-2 z-10 max-lg:bottom-14 lg:inset-x-3 lg:bottom-3 lg:left-28">
          <Toolbar fullscreenTarget={() => centerRef.current} />
        </div>
        {/* mobile bottom bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-1 border-t border-[var(--border)] bg-[var(--surface-solid)] p-1.5 lg:hidden">
          <button className="btn" onClick={() => setSheet('tree')}><ListTree size={15} /> Structures</button>
          <button className="btn" onClick={() => setSheet('controls')}><SlidersHorizontal size={15} /> View</button>
          <button className={`btn ${selectedId ? 'btn-active' : ''}`} onClick={() => setSheet('info')}><Info size={15} /> Info</button>
        </div>
      </div>
      {rightOpen && (
        <aside className="scrollbar-thin hidden w-96 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface-solid)] lg:block" aria-label="Structure information" aria-live="polite">
          <InfoPanel />
        </aside>
      )}
      {sheet === 'tree' && <MobileSheet title="Structures" onClose={() => setSheet(null)}><div className="h-[60vh]"><StructureTree /></div></MobileSheet>}
      {sheet === 'info' && <MobileSheet title="Structure information" onClose={() => setSheet(null)}><InfoPanel /></MobileSheet>}
      {sheet === 'controls' && (
        <MobileSheet title="View controls" onClose={() => setSheet(null)}>
          <MobileControls />
        </MobileSheet>
      )}
      <p className="sr-only">{DISCLAIMER}</p>
    </div>
  )
}

function MobileControls() {
  const s = useViewer()
  return (
    <div className="grid grid-cols-2 gap-2 p-3 text-sm">
      <button className={`btn ${s.mode === 'dissect' ? 'btn-active' : ''}`} onClick={() => s.setMode(s.mode === 'dissect' ? 'explore' : 'dissect')}>
        {s.mode === 'dissect' ? 'Dissect mode: on' : 'Dissect mode: off'}
      </button>
      <button className={`btn ${s.xray ? 'btn-active' : ''}`} onClick={() => s.setXray(!s.xray)}>X-ray {s.xray ? 'on' : 'off'}</button>
      <select className="btn" value={s.granularity} onChange={(e) => s.setGranularity(e.target.value as 'region' | 'detailed')} aria-label="Selection granularity">
        <option value="region">Select lobes</option>
        <option value="detailed">Select parts</option>
      </select>
      <select className="btn" value={s.labelMode} onChange={(e) => s.updateSettings({ labelMode: e.target.value as 'all' })} aria-label="Labels">
        <option value="all">All labels</option><option value="major">Major labels</option><option value="selected">Selected label</option><option value="none">No labels</option>
      </select>
      {PRESET_LABELS.map(([k, l]) => (
        <button key={k} className="btn" onClick={() => s.requestCamera({ kind: 'preset', preset: k })}>{l}</button>
      ))}
      <button className="btn col-span-2" onClick={() => s.setClip({ mode: 'none' })}>Clear section plane</button>
    </div>
  )
}
