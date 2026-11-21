import { Search, Database } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, diseaseById } from '@/lib/anatomy'
import { searchDiseases } from '@/lib/search'
import { useDiseaseCatalog } from '@/services/api'
import { DISCLAIMER } from '@/components/ui/ReferenceList'

const ORDER = ['neurodegenerative', 'cerebrovascular', 'seizure', 'demyelinating', 'infectious', 'neoplastic', 'traumatic', 'other']

export default function DiseaseCatalog() {
  const [params, setParams] = useSearchParams()
  const symptom = params.get('symptom')
  const [q, setQ] = useState(symptom ?? '')
  const [cat, setCat] = useState<string>('all')
  const { items, source } = useDiseaseCatalog()
  const filtered = useMemo(() => {
    let list = items
    if (q.trim()) {
      const ids = new Set(searchDiseases(q, 100).map((h) => h.id))
      list = list.filter((d) => ids.has(d.id))
    }
    if (cat !== 'all') list = list.filter((d) => d.category === cat)
    return list
  }, [items, q, cat])

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Neurological Disease Explorer</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-2)]">
            {items.length} conditions organised by clinical category. Each page explains pathophysiology, typical brain regions involved,
            symptoms, diagnosis and treatment — and links to the 3D model with a schematic, clearly-labelled regional association.
          </p>
          <p className="mt-2 text-xs text-[var(--text-2)]"><Database size={12} className="inline" /> Source: {source === 'api' ? 'NeuroSphere content API' : 'bundled offline content'} · {DISCLAIMER}</p>
        </header>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search conditions</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                if (symptom) setParams({})
              }}
              placeholder="Search by name, synonym or symptom (e.g. tremor, memory, headache)"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filter by category">
            <button className={`chip ${cat === 'all' ? 'btn-active' : ''}`} onClick={() => setCat('all')}>All</button>
            {ORDER.map((c) => (
              <button key={c} className={`chip ${cat === c ? 'btn-active' : ''}`} onClick={() => setCat(c)} aria-pressed={cat === c}>
                {CATEGORY_LABELS[c].replace(' conditions', '').replace('Other neurological', 'Other')}
              </button>
            ))}
          </div>
        </div>
        {ORDER.filter((c) => filtered.some((d) => d.category === c)).map((c) => (
          <section key={c} className="mb-8" aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-2)]">{CATEGORY_LABELS[c]}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.filter((d) => d.category === c).map((d) => {
                const full = diseaseById.get(d.id)
                return (
                  <li key={d.id}>
                    <Link to={`/diseases/${d.id}`} className="glass block h-full rounded-xl p-4 transition-colors hover:border-[var(--accent)]" data-testid={`disease-card-${d.id}`}>
                      <h3 className="font-semibold">{d.name}</h3>
                      <p className="mt-0.5 text-[11.5px] text-[var(--accent)]">{d.classification}</p>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-[var(--text-2)]">{d.overview}</p>
                      {full && <p className="mt-2 text-[11px] text-[var(--text-2)]">{full.associations.length} mapped brain-region associations</p>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {filtered.length === 0 && <p className="text-[var(--text-2)]">No conditions match.</p>}
      </div>
    </div>
  )
}
