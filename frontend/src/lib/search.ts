import { ANATOMY, DISEASES, MODULES, STRUCTURES } from './anatomy'

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')

export interface StructureHit { id: string; name: string; score: number; match: string }
export interface DiseaseHit { id: string; name: string; score: number; match: string }
export interface ModuleHit { id: string; name: string; score: number; match: string }

function scoreText(q: string, text: string, weight: number): number {
  const t = norm(text)
  if (!t) return 0
  if (t === q) return weight * 2.5
  if (t.startsWith(q)) return weight * 1.8
  if (t.includes(q)) return weight * 1.2
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) return weight
  return 0
}

export function searchStructures(query: string, limit = 40): StructureHit[] {
  const q = norm(query.trim())
  if (!q) return []
  const hits: StructureHit[] = []
  for (const s of STRUCTURES) {
    const a = ANATOMY[s.contentId]
    let best = 0
    let match = ''
    const consider = (score: number, why: string) => {
      if (score > best) {
        best = score
        match = why
      }
    }
    consider(scoreText(q, s.name, 50), s.kind === 'group' ? 'Region' : 'Structure')
    for (const syn of s.synonyms) consider(scoreText(q, syn, 38), `Synonym: ${syn}`)
    for (const g of s.groups) consider(scoreText(q, g.replace('-', ' '), 18), `Group: ${g.replace('-', ' ')}`)
    if (a) {
      for (const f of a.functions) consider(scoreText(q, f, 16), `Function: ${f}`)
      consider(scoreText(q, a.summary, 8), 'Mentioned in description')
    }
    if (best > 0) {
      // prefer regions and left-side duplicates first for stable ordering
      const bias = (s.kind === 'group' ? 2 : 0) + (s.hemisphere === 'right' ? -0.5 : 0)
      hits.push({ id: s.id, name: s.name, score: best + bias, match })
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit)
}

export function searchDiseases(query: string, limit = 20): DiseaseHit[] {
  const q = norm(query.trim())
  if (!q) return []
  const hits: DiseaseHit[] = []
  for (const d of DISEASES) {
    let best = 0
    let match = ''
    const consider = (score: number, why: string) => {
      if (score > best) {
        best = score
        match = why
      }
    }
    consider(scoreText(q, d.name, 50), d.classification)
    for (const syn of d.synonyms) consider(scoreText(q, syn, 40), `Also called ${syn}`)
    for (const sym of d.symptoms) consider(scoreText(q, sym, 18), `Symptom: ${sym}`)
    consider(scoreText(q, d.category, 15), d.classification)
    consider(scoreText(q, d.regionsSummary, 10), 'Brain regions involved')
    consider(scoreText(q, d.overview, 8), 'Mentioned in overview')
    if (best > 0) hits.push({ id: d.id, name: d.name, score: best, match })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function searchModules(query: string): ModuleHit[] {
  const q = norm(query.trim())
  if (!q) return []
  return MODULES.map((m) => ({
    id: m.id,
    name: m.title,
    score: Math.max(scoreText(q, m.title, 40), scoreText(q, m.summary, 15), ...m.steps.map((s) => scoreText(q, s.text, 6))),
    match: m.summary,
  }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** Symptom / functional topics that are educational entry points rather than diagnoses. */
export function searchTopics(query: string) {
  const q = norm(query.trim())
  if (q.length < 3) return []
  const seen = new Map<string, Set<string>>()
  for (const d of DISEASES)
    for (const s of d.symptoms)
      if (norm(s).includes(q)) {
        const set = seen.get(s) ?? new Set<string>()
        set.add(d.id)
        seen.set(s, set)
      }
  return [...seen.entries()].slice(0, 8).map(([topic, ids]) => ({ topic, diseaseIds: [...ids] }))
}

export function unifiedSearch(query: string) {
  return {
    structures: searchStructures(query, 12),
    diseases: searchDiseases(query, 10),
    modules: searchModules(query).slice(0, 5),
    topics: searchTopics(query),
  }
}
