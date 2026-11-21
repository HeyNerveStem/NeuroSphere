import { ANATOMY_META, DISEASES, MANIFEST, REFERENCES, RELATIONSHIPS, STRUCTURES, UNAVAILABLE } from '@/lib/anatomy'
import { DISCLAIMER } from '@/components/ui/ReferenceList'
import { useApiStatus } from '@/services/api'

export default function About() {
  const api = useApiStatus()
  const meshCount = STRUCTURES.filter((s) => s.kind === 'mesh').length
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <article className="prose-neuro mx-auto max-w-3xl px-4 py-8 text-[14.5px]">
        <h1 className="text-3xl font-semibold tracking-tight">About NeuroSphere 3D</h1>
        <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--warn)_45%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] p-3 font-medium">{DISCLAIMER}</div>

        <h2 className="mt-6 text-lg font-semibold">Purpose</h2>
        <p>An educational virtual brain laboratory for students, educators and curious learners: explore real 3D anatomy, dissect it interactively, and connect structures to neurological conditions.</p>

        <h2 className="mt-6 text-lg font-semibold">3D anatomical model</h2>
        <ul>
          <li><strong>Source:</strong> {MANIFEST.source.name}, via the STL conversion at <a className="text-[var(--accent)]" href={MANIFEST.source.mirror} target="_blank" rel="noreferrer">{MANIFEST.source.mirror}</a>.</li>
          <li><strong>License:</strong> {MANIFEST.source.license}. <strong>Attribution:</strong> “{MANIFEST.source.attribution}”.</li>
          <li><strong>Citation:</strong> {MANIFEST.source.citation}</li>
          <li><strong>Processing:</strong> {meshCount} element meshes (one per FMA concept) were converted to an LSA coordinate frame, centred, quadric-decimated to {MANIFEST.trianglesTotal.toLocaleString()} triangles in total, re-centred on their own centroids and compressed with meshopt. The derived model is shared under the same CC BY-SA 2.1 JP license.</li>
          <li><strong>Limitations:</strong> BodyParts3D represents a single adult male and is a surface model, not an MRI atlas. Gyri are modelled individually where the database provides them; several requested structures are not available and are listed in the hierarchy as unavailable rather than faked:</li>
        </ul>
        <ul className="ml-5">
          {UNAVAILABLE.map((u) => <li key={u.id}><strong>{u.name}:</strong> {u.reason} <em>Required asset: {u.requiredAsset}</em></li>)}
        </ul>

        <h2 className="mt-6 text-lg font-semibold">Medical content methodology</h2>
        <ul>
          <li>{Object.keys(REFERENCES).length} references from NINDS, MedlinePlus, NCBI Bookshelf, OpenStax and other reputable organisations. Every URL was confirmed to exist before inclusion; none were constructed from patterns.</li>
          <li>{DISEASES.length} condition pages and {RELATIONSHIPS.length} structure–disease relationships, each with an association type (common, secondary, subtype), distribution pattern and evidence level.</li>
          <li>No prevalence figures, survival rates or treatment success rates are given unless explicitly sourced; an automated content check rejects unsourced numeric statistics.</li>
          <li>Disease visualisations are schematic regional associations and disease animations are educational schematics — not patient-specific simulations or diagnostic tools.</li>
          <li><strong>Review status:</strong> {ANATOMY_META.reviewStatus} Last updated {ANATOMY_META.lastReviewed}.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">Technology</h2>
        <p>React, TypeScript, Vite, Tailwind CSS, Three.js with React Three Fiber and drei, Zustand, three-mesh-bvh; Python FastAPI, Pydantic and SQLAlchemy backend. Content API status: <strong>{api}</strong>{api !== 'online' ? ' (the app is running fully from bundled content)' : ''}.</p>
      </article>
    </div>
  )
}
