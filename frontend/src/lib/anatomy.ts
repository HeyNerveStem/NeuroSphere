/**
 * Anatomical knowledge index. Pure functions over the bundled content so the
 * viewer works with no backend connection.
 */
import structuresJson from '@content/structures.json'
import anatomyJson from '@content/anatomy.json'
import referencesJson from '@content/references.json'
import diseasesJson from '@content/diseases.json'
import relationshipsJson from '@content/relationships.json'
import learningJson from '@content/learning.json'
import animationsJson from '@content/animations.json'
import manifestJson from '@/data/model-manifest.json'
import type {
  AnatomyEntry, Disease, DiseaseAnimation, LearningModule, ManifestMesh, ModelManifest,
  Reference, Relationship, StructureDef, UnavailableStructure,
} from '@/types'

export const STRUCTURES = structuresJson.structures as unknown as StructureDef[]
export const UNAVAILABLE = structuresJson.unavailable as unknown as UnavailableStructure[]
export const ANATOMY = anatomyJson.entries as unknown as Record<string, AnatomyEntry>
export const ANATOMY_META = anatomyJson._meta as { lastReviewed: string; reviewStatus: string }
export const REFERENCES = referencesJson.references as Record<string, Reference>
export const DISEASES = diseasesJson.diseases as unknown as Disease[]
export const RELATIONSHIPS = relationshipsJson.relationships as unknown as Relationship[]
export const MODULES = learningJson.modules as unknown as LearningModule[]
export const ANIMATIONS = animationsJson.animations as unknown as DiseaseAnimation[]
export const ANIMATION_DISCLAIMER = animationsJson._meta.disclaimer as string
export const MANIFEST = manifestJson as unknown as ModelManifest

export const byId = new Map(STRUCTURES.map((s) => [s.id, s]))
export const manifestById = new Map<string, ManifestMesh>(MANIFEST.meshes.map((m) => [m.meshName, m]))
export const diseaseById = new Map(DISEASES.map((d) => [d.id, d]))
export const MESH_IDS = STRUCTURES.filter((s) => s.kind === 'mesh').map((s) => s.id)

const childrenMap = new Map<string, string[]>()
for (const s of STRUCTURES) {
  if (s.parentId) {
    const arr = childrenMap.get(s.parentId) ?? []
    arr.push(s.id)
    childrenMap.set(s.parentId, arr)
  }
}
export const children = (id: string) => childrenMap.get(id) ?? []
export const ROOT_ID = 'brain'

const meshCache = new Map<string, string[]>()
/** All mesh ids beneath (or equal to) a structure id. */
export function meshesOf(id: string): string[] {
  const hit = meshCache.get(id)
  if (hit) return hit
  const s = byId.get(id)
  if (!s) return []
  const out = s.kind === 'mesh' ? [id] : children(id).flatMap(meshesOf)
  meshCache.set(id, out)
  return out
}

/** Resolve an id that may be a structure id, group id or contentId. */
export function resolveTarget(target: string): string[] {
  const out = new Set<string>()
  for (const s of STRUCTURES) {
    if (s.id === target || s.contentId === target) meshesOf(s.id).forEach((m) => out.add(m))
  }
  return [...out]
}

export function ancestors(id: string): StructureDef[] {
  const out: StructureDef[] = []
  let cur = byId.get(id)
  while (cur?.parentId) {
    const p = byId.get(cur.parentId)
    if (!p) break
    out.push(p)
    cur = p
  }
  return out
}

/** Region-level selection: a mesh resolves to its nearest "majorSelect" ancestor. */
export function selectionTarget(meshId: string, granularity: 'region' | 'detailed'): string {
  if (granularity === 'detailed') return meshId
  const major = ancestors(meshId).find((a) => a.majorSelect)
  return major ? major.id : meshId
}

export function anatomyFor(id: string): AnatomyEntry | undefined {
  const s = byId.get(id)
  return s ? ANATOMY[s.contentId] : undefined
}

export function structureName(id: string): string {
  return byId.get(id)?.name ?? UNAVAILABLE.find((u) => u.id === id)?.name ?? id
}

/** A human-friendly name for a resolver target (contentId or structure id). */
export function targetName(target: string): string {
  const s = byId.get(target)
  if (s) return s.name
  const first = STRUCTURES.find((x) => x.contentId === target)
  if (!first) return target
  const t = first.name.replace(/^(Left|Right) /, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Best structure to navigate to for a resolver target. */
export function targetStructureId(target: string): string | undefined {
  if (byId.has(target)) return target
  return STRUCTURES.find((s) => s.contentId === target)?.id
}

/** Broadest association scope still shown on a more specific structure (≈ one lobe, both sides). */
export const MAX_INHERITED_SCOPE = 12

/**
 * Relationships that apply to a structure: those targeting it or something more specific inside it,
 * plus regional ones (≤ lobe-sized) that overlap it. Hemisphere-wide or whole-cerebrum associations
 * are NOT pushed down onto small structures — that would imply unsupported specificity.
 */
export function relationshipsForStructure(id: string): Relationship[] {
  const meshes = new Set(meshesOf(id))
  const s = byId.get(id)
  return RELATIONSHIPS.filter((r) => {
    if (r.structureId === id || r.structureId === s?.contentId) return true
    const inside = r.resolvedMeshIds.every((m) => meshes.has(m))
    const overlaps = r.resolvedMeshIds.some((m) => meshes.has(m))
    return inside || (overlaps && r.resolvedMeshIds.length <= MAX_INHERITED_SCOPE)
  })
}

export function diseasesForStructure(id: string): { disease: Disease; rel: Relationship }[] {
  const seen = new Map<string, { disease: Disease; rel: Relationship }>()
  const rank = { primary: 0, secondary: 1, subtype: 2 }
  for (const rel of relationshipsForStructure(id)) {
    const d = diseaseById.get(rel.diseaseId)
    if (!d) continue
    const prev = seen.get(d.id)
    if (!prev || rank[rel.associationType] < rank[prev.rel.associationType]) seen.set(d.id, { disease: d, rel })
  }
  return [...seen.values()].sort((a, b) => rank[a.rel.associationType] - rank[b.rel.associationType])
}

export const CATEGORY_LABELS: Record<string, string> = {
  neurodegenerative: 'Neurodegenerative conditions',
  cerebrovascular: 'Cerebrovascular conditions',
  seizure: 'Seizure disorders',
  demyelinating: 'Demyelinating & inflammatory conditions',
  infectious: 'Infectious conditions',
  neoplastic: 'Neoplastic conditions',
  traumatic: 'Traumatic conditions',
  other: 'Other neurological conditions',
}

export const brainCenter: [number, number, number] = [0, 0, 0]
export const brainRadius = (() => {
  const [a, b] = MANIFEST.brainBounds
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2
})()
