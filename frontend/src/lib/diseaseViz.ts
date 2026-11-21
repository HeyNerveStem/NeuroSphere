import type { Disease, HighlightStyle } from '@/types'
import { resolveTarget } from './anatomy'

const RANK: Record<string, number> = { primary: 0, secondary: 1, subtype: 2 }

/** Mesh → highlight style for a disease's validated associations (strongest association wins). */
export function diseaseHighlight(d: Disease): Record<string, HighlightStyle> {
  const out: Record<string, HighlightStyle> = {}
  const sorted = [...d.associations].sort((a, b) => RANK[a.type] - RANK[b.type])
  for (const a of sorted) for (const m of resolveTarget(a.target)) if (!out[m]) out[m] = a.type
  return out
}

export function needsXray(highlight: Record<string, HighlightStyle>): boolean {
  return Object.keys(highlight).some((id) => !/(gyrus|lobe|gyri|cerebellum|pons|medulla|optic-nerve)/.test(id))
}
