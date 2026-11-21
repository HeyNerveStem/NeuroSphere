export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export type Hemisphere = 'left' | 'right' | 'bilateral' | 'midline'

/** One entry of content/structures.json */
export interface StructureDef {
  id: string
  name: string
  parentId: string | null
  kind: 'mesh' | 'group'
  hemisphere: Hemisphere
  groups: string[]
  contentId: string
  majorSelect: boolean
  synonyms: string[]
  fma?: string
  layer?: number
  labelPriority?: number
  sourceName?: string | null
  note?: string | null
}

export interface UnavailableStructure {
  id: string
  name: string
  parentId: string
  reason: string
  requiredAsset: string
}

/** One mesh entry of assets/model-manifest.json */
export interface ManifestMesh {
  meshName: string
  structureId: string
  fmaId: string
  sourceFile: string
  sourceSha1: string
  trianglesSource: number
  trianglesShipped: number
  originalPosition: Vec3
  originalQuaternion: Quat
  boundsLocal: [Vec3, Vec3]
  labelAnchorLocal: Vec3
  explodeDirection: Vec3
  explodeWeight: number
  layer: number
  watertight: boolean
}

export interface ModelManifest {
  model: string
  source: { name: string; mirror: string; license: string; attribution: string; citation: string }
  coordinateSystem: { x: string; y: string; z: string; unitsPerMm: number }
  brainBounds: [Vec3, Vec3]
  trianglesTotal: number
  meshes: ManifestMesh[]
}

export interface Reference {
  title: string
  organization: string
  url: string
  type: string
}

export interface Connection {
  to: string
  text: string
}

export interface AnatomyEntry {
  summary: string
  beginner: string
  location: string
  description: string
  functions: string[]
  connections: Connection[]
  clinical: string
  lateralization?: string
  references: string[]
}

export type DiseaseCategory =
  | 'neurodegenerative'
  | 'cerebrovascular'
  | 'seizure'
  | 'demyelinating'
  | 'infectious'
  | 'neoplastic'
  | 'traumatic'
  | 'other'

export type AssociationType = 'primary' | 'secondary' | 'subtype'
export type Distribution = 'diffuse' | 'regional' | 'focal' | 'scattered' | 'network'
export type EvidenceLevel = 'established' | 'variable' | 'emerging'

export interface Association {
  target: string
  type: AssociationType
  distribution: Distribution
  evidence: EvidenceLevel
  explanation: string
}

export interface Disease {
  id: string
  name: string
  category: DiseaseCategory
  classification: string
  synonyms: string[]
  overview: string
  pathophysiology: string
  causes: string
  riskFactors: string[]
  regionsSummary: string
  symptoms: string[]
  progression: string
  diagnosis: string[]
  imaging: string
  treatments: string[]
  rehabilitation: string
  complications: string[]
  prognosis: string
  prevention: string
  emergingResearch?: string
  faq: { q: string; a: string }[]
  associations: Association[]
  references: string[]
  lastReviewed: string
  reviewStatus: string
}

export interface Relationship {
  structureId: string
  diseaseId: string
  associationType: AssociationType
  distribution: Distribution
  explanation: string
  evidenceLevel: EvidenceLevel
  references: string[]
  resolvedMeshIds: string[]
}

export type CameraPreset =
  | 'anterior'
  | 'posterior'
  | 'superior'
  | 'inferior'
  | 'left-lateral'
  | 'right-lateral'
  | 'sagittal'
  | 'coronal'
  | 'axial'

export interface TourStep {
  title: string
  text: string
  camera?: CameraPreset
  highlight: string[]
  hide?: string[]
  xray?: boolean
  explode?: number
  disease?: string
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface LearningModule {
  id: string
  title: string
  level: 'beginner' | 'intermediate' | 'advanced'
  minutes: number
  summary: string
  steps: TourStep[]
  quiz: QuizQuestion[]
}

export type HighlightStyle = 'primary' | 'secondary' | 'subtype' | 'tour'

export interface AnimationStep {
  caption: string
  durationMs: number
  highlight?: { target: string; style: 'primary' | 'secondary' }[]
  camera?: CameraPreset
  explode?: number
  xray?: boolean
  pulse?: boolean
  lesion?: { near: string; inset: number; radius: number; massEffect?: number }
  demyelinated?: number
}

export interface DiseaseAnimation {
  diseaseId: string
  title: string
  kind: 'sequence' | 'axon'
  steps: AnimationStep[]
  note?: string
}

export type ExplodeMode = 'complete' | 'layered' | 'selected' | 'guided'
export type LabelMode = 'all' | 'major' | 'selected' | 'none'
export type SelectGranularity = 'region' | 'detailed'
export type LearningLevel = 'beginner' | 'intermediate' | 'advanced'
export type Quality = 'low' | 'medium' | 'high' | 'ultra'
export type ColorMode = 'realistic' | 'regions'
