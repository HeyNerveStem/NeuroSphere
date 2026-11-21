import { ChevronRight, Eye, EyeOff, Search, CircleSlash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { byId, children, meshesOf, ROOT_ID, STRUCTURES, UNAVAILABLE } from '@/lib/anatomy'
import { searchStructures } from '@/lib/search'
import { useViewer } from '@/stores/viewerStore'

const FILTERS: [string, string][] = [
  ['all', 'All'],
  ['cortex', 'Cortex'],
  ['basal-ganglia', 'Basal nuclei'],
  ['limbic', 'Limbic'],
  ['diencephalon', 'Diencephalon'],
  ['brainstem', 'Brainstem'],
  ['ventricular', 'Ventricles'],
  ['white-matter', 'White matter'],
  ['visual', 'Visual'],
  ['motor', 'Motor'],
]

function Node({ id, depth, filter }: { id: string; depth: number; filter: string }) {
  const s = byId.get(id)!
  const kids = children(id)
  const [open, setOpen] = useState(depth < 1)
  const selectedId = useViewer((st) => st.selectedId)
  const allHidden = useViewer((st) => meshesOf(id).every((m) => st.hidden[m]))
  const meshes = meshesOf(id)
  if (filter !== 'all' && !meshes.some((m) => byId.get(m)!.groups.includes(filter))) return null
  const isSel = selectedId === id
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={isSel}>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 ${isSel ? 'bg-[color-mix(in_srgb,var(--highlight)_18%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]'}`}
        style={{ paddingLeft: depth * 12 + 2 }}
      >
        {kids.length ? (
          <button
            className="rounded p-0.5 text-[var(--text-2)]"
            onClick={() => setOpen(!open)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${s.name}`}
          >
            <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="inline-block w-[17px]" />
        )}
        <button
          className={`min-w-0 flex-1 truncate py-1 text-left text-[12.5px] ${allHidden ? 'opacity-45' : ''} ${isSel ? 'font-semibold' : ''}`}
          onClick={() => useViewer.getState().select(id)}
          onDoubleClick={() => useViewer.getState().requestCamera({ kind: 'focus', id })}
          title={s.name}
        >
          {s.name}
        </button>
        <button
          className="rounded p-1 text-[var(--text-2)] opacity-60 hover:opacity-100 focus:opacity-100"
          onClick={() => useViewer.getState().toggleHidden(id)}
          aria-label={`${allHidden ? 'Show' : 'Hide'} ${s.name}`}
        >
          {allHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      {open && kids.length > 0 && (
        <ul role="group">
          {kids.map((k) => (
            <Node key={k} id={k} depth={depth + 1} filter={filter} />
          ))}
          {UNAVAILABLE.filter((u) => u.parentId === id).map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-1 py-0.5 text-[12px] text-[var(--text-2)]"
              style={{ paddingLeft: (depth + 1) * 12 + 19 }}
              title={`${u.reason} Required: ${u.requiredAsset}`}
            >
              <CircleSlash size={11} aria-hidden /> <span className="truncate italic">{u.name}</span>
              <span className="sr-only">— unavailable in this model: {u.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function StructureTree() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const results = useMemo(() => (q.trim() ? searchStructures(q) : []), [q])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-2.5 pb-1.5">
        <label className="relative block">
          <span className="sr-only">Search anatomical structures</span>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search structures, synonyms, functions…"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent py-1.5 pl-8 pr-2 text-[13px] outline-none focus:border-[var(--accent)]"
            data-testid="structure-search"
          />
        </label>
        {!q && (
          <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Filter by anatomical group">
            {FILTERS.map(([k, l]) => (
              <button
                key={k}
                className={`chip ${filter === k ? 'btn-active' : ''}`}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {q ? (
          <ul className="space-y-0.5" aria-label="Search results" data-testid="structure-results">
            {results.length === 0 && (
              <li className="px-2 py-3 text-sm text-[var(--text-2)]">No matching structures.</li>
            )}
            {results.map((r) => (
              <li key={r.id}>
                <button
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                  onClick={() => {
                    const v = useViewer.getState()
                    v.select(r.id)
                    v.requestCamera({ kind: 'focus', id: r.id })
                  }}
                >
                  <div className="text-[13px] font-medium">{r.name}</div>
                  <div className="truncate text-[11px] text-[var(--text-2)]">{r.match}</div>
                </button>
              </li>
            ))}
            {UNAVAILABLE.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())).map((u) => (
              <li key={u.id} className="px-2 py-1.5 text-[12px] text-[var(--text-2)]">
                <span className="italic">{u.name}</span> — not available in this model. {u.reason}
              </li>
            ))}
          </ul>
        ) : (
          <ul role="tree" aria-label="Anatomical structure hierarchy">
            <Node id={ROOT_ID} depth={0} filter={filter} />
          </ul>
        )}
      </div>
      <p className="border-t border-[var(--border)] px-3 py-2 text-[10.5px] leading-snug text-[var(--text-2)]">
        {STRUCTURES.filter((s) => s.kind === 'mesh').length} selectable meshes ·{' '}
        <CircleSlash size={10} className="inline" /> items are not in the source asset.
      </p>
    </div>
  )
}
