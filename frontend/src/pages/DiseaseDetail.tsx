import { ArrowLeft, Eye, EyeOff, AlertTriangle, ScanEye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ANIMATIONS, CATEGORY_LABELS, diseaseById, DISEASES, resolveTarget, targetName, targetStructureId } from '@/lib/anatomy'
import { diseaseHighlight, needsXray } from '@/lib/diseaseViz'
import { Viewport } from '@/components/viewer/Viewport'
import { DiseaseAnimationPlayer, clearDiseaseVisuals } from '@/components/diseases/DiseaseAnimationPlayer'
import { DISCLAIMER, ReferenceList } from '@/components/ui/ReferenceList'
import { useViewer } from '@/stores/viewerStore'
import { useAnimation } from '@/stores/animationStore'
import { useWhenModelReady } from '@/hooks/useViewerHooks'
import { fetchDisease } from '@/services/api'
import type { Disease } from '@/types'

const TYPE_STYLE = {
  primary: { label: 'Commonly involved', color: '#F97373', mark: '●' },
  secondary: { label: 'Secondary / possible', color: '#F5A524', mark: '◐' },
  subtype: { label: 'Specific subtypes / locations', color: '#A78BFA', mark: '◇' },
}
const DIST: Record<string, string> = {
  diffuse: 'diffuse within the structure', regional: 'regional', focal: 'focal — part of the structure', scattered: 'scattered lesions — not the whole structure', network: 'network / functional involvement',
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] py-4">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-2)]">{title}</h2>
      <div className="prose-neuro text-[14px]">{children}</div>
    </section>
  )
}
const List = ({ items }: { items: string[] }) => <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>

export default function DiseaseDetail() {
  const { diseaseId = '' } = useParams()
  const nav = useNavigate()
  const bundled = diseaseById.get(diseaseId)
  const [d, setD] = useState<Disease | undefined>(bundled)
  const [shown, setShown] = useState(false)
  const anim = ANIMATIONS.find((a) => a.diseaseId === diseaseId)

  useEffect(() => {
    setD(bundled)
    let alive = true
    void fetchDisease(diseaseId).then((r) => alive && r && setD(r))
    return () => {
      alive = false
    }
  }, [diseaseId, bundled])

  const highlight = () => {
    if (!d) return
    const v = useViewer.getState()
    const hl = diseaseHighlight(d)
    v.setHighlight(hl, `${d.name} — schematic regional association`, true)
    v.setXray(needsXray(hl))
    v.select(null)
    v.requestCamera({ kind: 'preset', preset: 'left-lateral' })
    setShown(true)
  }
  const clear = () => {
    clearDiseaseVisuals()
    setShown(false)
  }

  useWhenModelReady(() => {
    useAnimation.getState().reset()
    useViewer.getState().resetView()
    useViewer.getState().requestCamera({ kind: 'preset', preset: 'left-lateral' })
  }, [diseaseId])
  useEffect(() => () => clearDiseaseVisuals(), [diseaseId])

  if (!d)
    return (
      <div className="p-8">
        <p>Unknown condition “{diseaseId}”.</p>
        <Link to="/diseases" className="text-[var(--accent)]">Back to Disease Explorer</Link>
      </div>
    )

  const related = DISEASES.filter((x) => x.category === d.category && x.id !== d.id).slice(0, 6)

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-3xl px-4 py-6 lg:px-8" data-testid="disease-page">
          <button className="btn mb-4" onClick={() => nav(-1)}><ArrowLeft size={14} /> Back</button>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{CATEGORY_LABELS[d.category]}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl" data-testid="disease-title">{d.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]"><strong>Classification:</strong> {d.classification}{d.synonyms.length ? ` · Also called: ${d.synonyms.join(', ')}` : ''}</p>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] p-2.5 text-[12.5px]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warn)]" />
            <span>{DISCLAIMER} If you think you or someone else may be experiencing a medical emergency, contact local emergency services.</span>
          </div>

          <Block title="Overview"><p>{d.overview}</p></Block>
          <Block title="Pathophysiology"><p>{d.pathophysiology}</p></Block>
          <Block title="Causes and risk factors"><p>{d.causes}</p><List items={d.riskFactors} /></Block>
          <section className="border-t border-[var(--border)] py-4" aria-labelledby="regions-h">
            <h2 id="regions-h" className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-2)]">Brain regions commonly involved</h2>
            <p className="text-[14px] leading-relaxed">{d.regionsSummary}</p>
            <ul className="mt-3 space-y-2" data-testid="association-list">
              {d.associations.map((a) => {
                const t = TYPE_STYLE[a.type]
                const sid = targetStructureId(a.target)
                return (
                  <li key={a.target + a.type} className="rounded-lg border border-[var(--border)] p-2.5 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span style={{ color: t.color }} aria-hidden>{t.mark}</span>
                      <button
                        className="font-semibold text-[var(--accent)] hover:underline"
                        onClick={() => {
                          const v = useViewer.getState()
                          const hl = Object.fromEntries(resolveTarget(a.target).map((m) => [m, a.type]))
                          v.setHighlight(hl, `${d.name}: ${targetName(a.target)}`, true)
                          v.setXray(needsXray(hl))
                          if (sid) v.requestCamera({ kind: 'focus', id: sid })
                        }}
                      >
                        {targetName(a.target)}
                      </button>
                      <span className="chip">{t.label}</span>
                      <span className="chip">{DIST[a.distribution]}</span>
                      <span className="chip">evidence: {a.evidence}</span>
                    </div>
                    <p className="mt-1 leading-snug">{a.explanation}</p>
                    {sid && <Link className="mt-1 inline-block text-[12px] text-[var(--accent)] hover:underline" to={`/anatomy/${sid}`}>Open in Anatomy Lab →</Link>}
                  </li>
                )
              })}
            </ul>
          </section>
          <Block title="Typical signs and symptoms"><List items={d.symptoms} /></Block>
          <Block title="Disease progression"><p>{d.progression}</p></Block>
          <Block title="Diagnostic evaluation"><List items={d.diagnosis} /></Block>
          <Block title="Common imaging findings"><p>{d.imaging}</p></Block>
          <Block title="Treatment approaches"><List items={d.treatments} /><p className="text-[12px] text-[var(--text-2)]">Treatment decisions are individual and made with qualified clinicians.</p></Block>
          <Block title="Rehabilitation and supportive care"><p>{d.rehabilitation}</p></Block>
          <Block title="Potential complications"><List items={d.complications} /></Block>
          <Block title="Prognosis and variability"><p>{d.prognosis}</p></Block>
          <Block title="Prevention and risk reduction"><p>{d.prevention}</p></Block>
          {d.emergingResearch && <Block title="Emerging research (not established practice)"><p>{d.emergingResearch}</p></Block>}
          <Block title="Frequently asked questions">
            {d.faq.map((f) => <details key={f.q} className="mb-2"><summary className="cursor-pointer font-medium">{f.q}</summary><p className="mt-1">{f.a}</p></details>)}
          </Block>
          <Block title="Medical references"><ReferenceList ids={d.references} /></Block>
          <p className="border-t border-[var(--border)] pt-3 text-[12px] text-[var(--text-2)]">Last medical review: {d.lastReviewed}. {d.reviewStatus}</p>
          {related.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold">Related conditions</h2>
              <div className="flex flex-wrap gap-2">{related.map((r) => <Link key={r.id} to={`/diseases/${r.id}`} className="chip hover:border-[var(--accent)]">{r.name}</Link>)}</div>
            </section>
          )}
        </article>
      </div>
      <aside className="flex h-[58vh] shrink-0 flex-col border-t border-[var(--border)] lg:h-auto lg:w-[46%] lg:border-l lg:border-t-0" aria-label="3D disease visualization">
        <div className="relative min-h-0 flex-1">
          <Viewport interactive />
        </div>
        <div className="scrollbar-thin max-h-[45%] overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-solid)] p-3">
          <div className="flex flex-wrap gap-2">
            {!shown ? (
              <button className="btn btn-primary" onClick={highlight} data-testid="highlight-affected"><Eye size={14} /> Highlight affected regions</button>
            ) : (
              <button className="btn" onClick={clear}><EyeOff size={14} /> Clear highlight</button>
            )}
            <button className="btn" onClick={() => useViewer.getState().setXray(!useViewer.getState().xray)}><ScanEye size={14} /> Toggle X-ray</button>
            <Link className="btn" to="/anatomy">Open full Anatomy Lab</Link>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-2)]">
            Generalised educational visualization of commonly reported regional involvement — not a patient-specific scan or diagnostic finding.
          </p>
          {anim && <div className="mt-3"><DiseaseAnimationPlayer key={anim.diseaseId} anim={anim} /></div>}
        </div>
      </aside>
    </div>
  )
}
