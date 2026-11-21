import { useViewer } from '@/stores/viewerStore'
import { useApiStatus } from '@/services/api'
import type { LabelMode, LearningLevel, Quality } from '@/types'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-[12.5px] text-[var(--text-2)]">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} className={`btn ${value === v ? 'btn-active' : ''}`} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export default function Settings() {
  const s = useViewer()
  const api = useApiStatus()
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">Saved in this browser.</p>
        <Row label="Learning level" hint="Adjusts explanation depth and which sections appear. Anatomical facts never change.">
          <Seg<LearningLevel> label="Learning level" value={s.level} onChange={(level) => s.updateSettings({ level })} options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
        </Row>
        <Row label="Rendering quality" hint="Lower quality limits pixel ratio and disables antialiasing for lower-powered devices.">
          <Seg<Quality> label="Rendering quality" value={s.quality} onChange={(quality) => s.updateSettings({ quality })} options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']]} />
        </Row>
        <Row label="Theme">
          <Seg label="Theme" value={s.theme} onChange={(theme) => s.updateSettings({ theme })} options={[['dark', 'Dark'], ['light', 'Light']]} />
        </Row>
        <Row label="Default labels">
          <Seg<LabelMode> label="Labels" value={s.labelMode} onChange={(labelMode) => s.updateSettings({ labelMode })} options={[['all', 'All'], ['major', 'Major'], ['selected', 'Selected'], ['none', 'None']]} />
        </Row>
        <Row label="Colour mode">
          <Seg label="Colour mode" value={s.colorMode} onChange={(colorMode) => s.updateSettings({ colorMode })} options={[['realistic', 'Realistic'], ['regions', 'Region colours']]} />
        </Row>
        <Row label="Reduced motion" hint="Instant camera moves and faster returns. Defaults to your system preference.">
          <Seg label="Reduced motion" value={s.reducedMotion ? 'on' : 'off'} onChange={(v) => s.updateSettings({ reducedMotion: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
        </Row>
        <Row label="Orientation widget">
          <Seg label="Orientation widget" value={s.showOrientation ? 'on' : 'off'} onChange={(v) => s.updateSettings({ showOrientation: v === 'on' })} options={[['on', 'Shown'], ['off', 'Hidden']]} />
        </Row>
        <Row label="Content API" hint="The viewer and all content work offline; the API adds server-side search and catalog delivery.">
          <span className="chip">{api}</span>
        </Row>
      </div>
    </div>
  )
}
