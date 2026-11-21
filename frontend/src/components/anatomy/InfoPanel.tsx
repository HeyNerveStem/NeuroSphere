import { Crosshair, EyeOff, Focus, Link2, RotateCcw, Stethoscope, X, Eye, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ANATOMY_META, ancestors, anatomyFor, byId, diseasesForStructure, manifestById, meshesOf, resolveTarget,
  targetName, targetStructureId,
} from '@/lib/anatomy'
import { transforms, useTransformMeta } from '@/stores/transformStore'
import { useViewer } from '@/stores/viewerStore'
import { ReferenceList } from '@/components/ui/ReferenceList'
import type { HighlightStyle } from '@/types'

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="border-t border-[var(--border)] px-4 py-3" aria-labelledby={id}>
      <h3 id={id} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-2)]">{title}</h3>
      <div className="prose-neuro text-[13px]">{children}</div>
    </section>
  )
}

const HEM: Record<string, string> = { left: 'Left', right: 'Right', bilateral: 'Both hemispheres', midline: 'Midline' }
const ASSOC_LABEL = { primary: 'Commonly involved', secondary: 'Secondary / possible involvement', subtype: 'Specific subtypes or locations' }

export function InfoPanel({ onClose }: { onClose?: () => void }) {
  const selectedId = useViewer((s) => s.selectedId)
  const level = useViewer((s) => s.level)
  const hiddenAll = useViewer((s) => (selectedId ? meshesOf(selectedId).every((m) => s.hidden[m]) : false))
  const opacity = useViewer((s) => (selectedId ? (s.opacity[meshesOf(selectedId)[0]] ?? 1) : 1))
  useTransformMeta((m) => m.version) // re-render when transforms change
  if (!selectedId)
    return (
      <div className="p-5 text-sm text-[var(--text-2)]">
        <Info size={18} className="mb-2" />
        <p className="font-medium text-[var(--text)]">Select a structure</p>
        <p className="mt-1">Click any part of the brain, a label, or an item in the hierarchy to see its anatomy, functions, connections and related conditions.</p>
        <p className="mt-3 text-xs">Tip: switch “Select” to <em>Detailed parts</em> to pick individual gyri instead of whole lobes. Use X-ray or sections to reach internal structures.</p>
      </div>
    )
  const s = byId.get(selectedId)!
  const a = anatomyFor(selectedId)
  const parents = ancestors(selectedId)
  const meshes = meshesOf(selectedId)
  const moved = meshes.some((m) => transforms.isMoved(m))
  const diseases = diseasesForStructure(selectedId)
  const v = useViewer.getState()
  const isInternal = meshes.every((m) => (manifestById.get(m)?.layer ?? 0) >= 2)

  const showConnected = () => {
    if (!a) return
    const hl: Record<string, HighlightStyle> = {}
    for (const c of a.connections) for (const m of resolveTarget(c.to)) hl[m] = 'tour'
    for (const m of meshes) delete hl[m]
    v.setHighlight(hl, `Regions connected with ${s.name}`, true)
    v.setXray(true)
  }

  return (
    <article className="pb-6" aria-labelledby="info-title" data-testid="info-panel">
      <header className="sticky top-0 z-10 bg-[var(--surface-solid)] px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-[var(--text-2)]">{parents.slice(0, 2).reverse().map((p) => p.name).join(' › ') || 'Brain'}</p>
            <h2 id="info-title" className="text-lg font-semibold leading-tight" data-testid="info-title">{s.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="chip">{HEM[s.hemisphere]}</span>
              {s.kind === 'group' && <span className="chip">{meshes.length} parts</span>}
              {isInternal && <span className="chip" title="Hidden beneath other anatomy — use X-ray, sections or disassembly">Internal</span>}
              {moved && <span className="chip text-[var(--accent)]">Moved</span>}
            </div>
          </div>
          {onClose && (
            <button className="btn btn-icon" onClick={onClose} aria-label="Close information panel"><X size={15} /></button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button className="btn" onClick={() => v.requestCamera({ kind: 'focus', id: selectedId })}><Focus size={13} /> Focus</button>
          <button className="btn" onClick={() => (v.isolated ? v.isolate(null) : v.isolate(selectedId))}><Crosshair size={13} /> {v.isolated ? 'Show all' : 'Isolate'}</button>
          <button className="btn" onClick={() => v.toggleHidden(selectedId)}>{hiddenAll ? <Eye size={13} /> : <EyeOff size={13} />} {hiddenAll ? 'Show' : 'Hide'}</button>
          <button className="btn" disabled={!moved} onClick={() => transforms.returnToOriginal(meshes)} data-testid="return-original">
            <RotateCcw size={13} /> Return
          </button>
          <button className="btn" disabled={!a?.connections.length} onClick={showConnected}><Link2 size={13} /> Connected</button>
          <a className="btn" href="#related-diseases"><Stethoscope size={13} /> Diseases</a>
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-xs">
          <span className="text-[var(--text-2)]">Opacity</span>
          <input type="range" min={0.05} max={1} step={0.05} value={opacity} className="flex-1" aria-label={`Opacity of ${s.name}`} onChange={(e) => v.setOpacity(selectedId, +e.target.value)} />
        </label>
      </header>

      {a ? (
        <>
          <Section title="Overview" id="sec-overview">
            {level === 'beginner' ? <p>{a.beginner}</p> : <p>{a.summary}</p>}
            {s.synonyms.length > 0 && level !== 'beginner' && <p className="text-[var(--text-2)]"><strong>Also called:</strong> {s.synonyms.join(', ')}</p>}
            <p><strong>Location:</strong> {a.location}</p>
          </Section>
          {level !== 'beginner' && (
            <Section title="Anatomical description" id="sec-desc"><p>{a.description}</p>{a.lateralization && <p className="text-[var(--text-2)]">{a.lateralization}</p>}</Section>
          )}
          <Section title="Primary functions" id="sec-func">
            <ul>{a.functions.map((f) => <li key={f}>{f}</li>)}</ul>
            <p className="text-[11.5px] text-[var(--text-2)]">Functions emerge from networks; no complex ability is controlled by a single region alone.</p>
          </Section>
          {level !== 'beginner' && a.connections.length > 0 && (
            <Section title="Neural connections" id="sec-conn">
              <ul>
                {a.connections.map((c) => {
                  const tid = targetStructureId(c.to)
                  return (
                    <li key={c.to + c.text}>
                      <button className="font-medium text-[var(--accent)] hover:underline" onClick={() => tid && v.select(tid)}>{targetName(c.to)}</button> — {c.text}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
          <Section title="Clinical significance" id="sec-clin"><p>{a.clinical}</p></Section>
        </>
      ) : (
        <Section title="Overview"><p>No content entry yet for this structure.</p></Section>
      )}

      <section id="related-diseases" className="border-t border-[var(--border)] px-4 py-3" aria-labelledby="sec-dis">
        <h3 id="sec-dis" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-2)]">Related conditions</h3>
        {diseases.length === 0 && <p className="text-[13px] text-[var(--text-2)]">No validated associations recorded for this structure.</p>}
        <ul className="space-y-2">
          {diseases.slice(0, level === 'beginner' ? 4 : 12).map(({ disease, rel }) => (
            <li key={disease.id} className="rounded-lg border border-[var(--border)] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/diseases/${disease.id}`} className="text-[13px] font-semibold hover:underline">{disease.name}</Link>
                <span className="chip shrink-0" style={{ color: rel.associationType === 'primary' ? 'var(--warn)' : undefined }}>{ASSOC_LABEL[rel.associationType]}</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[var(--text-2)]">{disease.overview.split('. ')[0]}.</p>
              <p className="mt-1 text-[12px] leading-snug"><strong>Association:</strong> {rel.explanation}</p>
              {level !== 'beginner' && (
                <p className="mt-1 text-[11.5px] text-[var(--text-2)]"><strong>Common symptoms:</strong> {disease.symptoms.slice(0, 3).join('; ')}</p>
              )}
              {level === 'advanced' && <p className="mt-1 text-[11px] text-[var(--text-2)]">Evidence: {rel.evidenceLevel} · pattern: {rel.distribution}</p>}
            </li>
          ))}
        </ul>
        {diseases.length > 1 && <p className="mt-2 text-[11.5px] text-[var(--text-2)]">These conditions differ in mechanism; involvement of this structure does not mean every case affects it in the same way.</p>}
      </section>

      {s.note && <Section title="Model note"><p>{s.note}</p></Section>}
      {level === 'advanced' && s.kind === 'mesh' && (
        <Section title="Geometry provenance">
          <p className="text-[12px]">BodyParts3D element <code>{s.fma}</code>{s.sourceName ? ` (“${s.sourceName}”)` : ''}. {manifestById.get(s.id)!.trianglesShipped.toLocaleString()} triangles shipped (decimated from {manifestById.get(s.id)!.trianglesSource.toLocaleString()}).</p>
        </Section>
      )}
      {a && level !== 'beginner' && (
        <Section title="References"><ReferenceList ids={a.references} /></Section>
      )}
      <p className="px-4 pt-2 text-[10.5px] text-[var(--text-2)]">Content reviewed {ANATOMY_META.lastReviewed}. {ANATOMY_META.reviewStatus}</p>
    </article>
  )
}
