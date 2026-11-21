import { Color } from 'three'
import type { StructureDef } from '@/types'

/** Realistic-mode tissue colours (fixed-tissue look, not photographic). */
export function realisticColor(s: StructureDef): string {
  const g = new Set(s.groups)
  if (s.id === 'cerebral-white-matter') return '#efe5d9'
  if (s.id === 'corpus-callosum' || s.id.includes('fornix') || s.id.includes('internal-capsule')) return '#f2eadf'
  if (s.id.includes('choroid')) return '#b9646f'
  if (g.has('ventricular')) return '#79acd9'
  if (s.id === 'pituitary-gland') return '#c98476'
  if (s.id === 'pineal-gland') return '#caa27c'
  if (g.has('visual-pathway') && !s.id.includes('geniculate')) return '#ece0c6'
  if (g.has('cortex')) return '#e2b2a8'
  if (g.has('cerebellum')) return '#d59b92'
  if (g.has('brainstem')) return '#dcb2a6'
  return '#c99a92' // deep grey matter
}

const REGION: Record<string, string> = {
  frontal: '#5b9cf6',
  parietal: '#34d399',
  temporal: '#f5b83d',
  occipital: '#f472b6',
  insula: '#a78bfa',
  cingulate: '#fb7185',
  orbital: '#93c5fd',
  basal: '#fb923c',
  limbic: '#e879f9',
  diencephalon: '#facc15',
  brainstem: '#a3e635',
  cerebellum: '#2dd4bf',
  ventricular: '#38bdf8',
  white: '#e2e8f0',
  visual: '#fde68a',
  endocrine: '#fca5a5',
}

export function regionColor(s: StructureDef, parentIds: string[]): string {
  const p = parentIds.join(' ')
  const g = new Set(s.groups)
  if (p.includes('frontal-lobe')) return REGION.frontal
  if (p.includes('parietal-lobe')) return REGION.parietal
  if (p.includes('temporal-lobe')) return s.id.includes('parahippocampal') ? REGION.limbic : REGION.temporal
  if (s.id.includes('occipital')) return REGION.occipital
  if (p.includes('insular')) return REGION.insula
  if (s.id.includes('cingulate')) return REGION.cingulate
  if (s.id === 'orbital-and-straight-gyri') return REGION.orbital
  if (g.has('basal-ganglia')) return REGION.basal
  if (g.has('limbic') && !g.has('white-matter')) return REGION.limbic
  if (g.has('ventricular')) return REGION.ventricular
  if (g.has('endocrine')) return REGION.endocrine
  if (g.has('visual-pathway') && !s.id.includes('geniculate')) return REGION.visual
  if (g.has('diencephalon')) return REGION.diencephalon
  if (g.has('brainstem')) return REGION.brainstem
  if (g.has('cerebellum')) return REGION.cerebellum
  return REGION.white
}

export const HIGHLIGHT_COLORS = {
  selected: new Color('#22D3EE'),
  hover: new Color('#7dd3fc'),
  primary: new Color('#F97373'),
  secondary: new Color('#F5A524'),
  subtype: new Color('#A78BFA'),
  tour: new Color('#2DD4BF'),
}
