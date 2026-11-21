import { Search, Brain, Stethoscope, GraduationCap, Lightbulb } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { unifiedSearch } from '@/lib/search'
import { diseaseById } from '@/lib/anatomy'
import { useViewer } from '@/stores/viewerStore'

export function GlobalSearch({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const res = useMemo(() => unifiedSearch(q), [q])
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const done = () => {
    setOpen(false)
    setQ('')
    onDone?.()
  }
  const goStructure = (id: string) => {
    useViewer.getState().select(id)
    nav(`/anatomy/${id}`)
    done()
  }
  const total = res.structures.length + res.diseases.length + res.modules.length + res.topics.length

  return (
    <div ref={box} className="relative w-full max-w-md" role="search">
      <label className="relative block">
        <span className="sr-only">Search anatomy, diseases, symptoms and lessons</span>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') done()
            if (e.key === 'Enter') {
              if (res.structures[0] && (!res.diseases[0] || res.structures[0].score >= res.diseases[0].score))
                goStructure(res.structures[0].id)
              else if (res.diseases[0]) {
                nav(`/diseases/${res.diseases[0].id}`)
                done()
              }
            }
          }}
          placeholder="Search: hippocampus, memory, stroke…"
          className="w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-1.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          data-testid="global-search"
        />
      </label>
      {open && q.trim() && (
        <div
          className="glass scrollbar-thin absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl p-2 shadow-2xl"
          data-testid="global-search-results"
        >
          {total === 0 && <p className="p-3 text-sm text-[var(--text-2)]">No results for “{q}”.</p>}
          {res.structures.length > 0 && (
            <Group icon={<Brain size={13} />} title="Anatomy">
              {res.structures.map((r) => (
                <Item key={r.id} title={r.name} sub={r.match} onClick={() => goStructure(r.id)} />
              ))}
            </Group>
          )}
          {res.diseases.length > 0 && (
            <Group icon={<Stethoscope size={13} />} title="Diseases & conditions">
              {res.diseases.map((r) => (
                <Item
                  key={r.id}
                  title={r.name}
                  sub={r.match}
                  onClick={() => {
                    nav(`/diseases/${r.id}`)
                    done()
                  }}
                />
              ))}
            </Group>
          )}
          {res.topics.length > 0 && (
            <Group icon={<Lightbulb size={13} />} title="Symptoms as learning topics">
              {res.topics.map((t) => (
                <Item
                  key={t.topic}
                  title={t.topic}
                  sub={`Seen in: ${t.diseaseIds.map((id) => diseaseById.get(id)?.name).join(', ')}`}
                  onClick={() => {
                    nav(`/diseases?symptom=${encodeURIComponent(t.topic)}`)
                    done()
                  }}
                />
              ))}
            </Group>
          )}
          {res.modules.length > 0 && (
            <Group icon={<GraduationCap size={13} />} title="Learning modules">
              {res.modules.map((r) => (
                <Item
                  key={r.id}
                  title={r.name}
                  sub={r.match}
                  onClick={() => {
                    nav(`/learn/${r.id}`)
                    done()
                  }}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <p className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
        {icon} {title}
      </p>
      <ul>{children}</ul>
    </div>
  )
}
function Item({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button
        className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
        onClick={onClick}
      >
        <div className="text-[13px] font-medium">{title}</div>
        <div className="truncate text-[11px] text-[var(--text-2)]">{sub}</div>
      </button>
    </li>
  )
}
