import { X } from 'lucide-react'
import { useViewer } from '@/stores/viewerStore'

const ITEMS = [
  { key: 'primary', label: 'Commonly involved', color: '#F97373', pattern: '●' },
  { key: 'secondary', label: 'Possible / secondary involvement', color: '#F5A524', pattern: '◐' },
  { key: 'subtype', label: 'Specific subtypes or locations', color: '#A78BFA', pattern: '◇' },
  { key: 'tour', label: 'Highlighted', color: '#2DD4BF', pattern: '■' },
] as const

export function HighlightLegend() {
  const highlight = useViewer((s) => s.highlight)
  const caption = useViewer((s) => s.highlightCaption)
  const styles = new Set(Object.values(highlight))
  if (!styles.size) return null
  return (
    <div className="glass absolute left-3 top-3 max-w-[min(22rem,70vw)] rounded-xl p-3 text-xs" role="region" aria-label="Highlight legend">
      <div className="flex items-start justify-between gap-2">
        {caption && <p className="font-semibold leading-snug">{caption}</p>}
        <button className="btn btn-icon -mr-1 -mt-1" aria-label="Clear highlight" onClick={() => useViewer.getState().clearHighlight()}>
          <X size={14} />
        </button>
      </div>
      <ul className="mt-1.5 space-y-1">
        {ITEMS.filter((i) => styles.has(i.key)).map((i) => (
          <li key={i.key} className="flex items-center gap-2">
            <span aria-hidden style={{ color: i.color }} className="text-sm leading-none">{i.pattern}</span>
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
      {(styles.has('primary') || styles.has('secondary') || styles.has('subtype')) && (
        <p className="mt-2 text-[10.5px] leading-snug text-[var(--text-2)]">
          Schematic regional association for education. Whole structures are coloured even when pathology is typically
          focal, scattered or microscopic. Not a patient scan or diagnosis.
        </p>
      )}
    </div>
  )
}
