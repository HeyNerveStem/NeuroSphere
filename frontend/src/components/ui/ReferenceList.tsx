import { ExternalLink } from 'lucide-react'
import { REFERENCES } from '@/lib/anatomy'

export function ReferenceList({ ids }: { ids: string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px]">
      {ids.map((id) => {
        const r = REFERENCES[id]
        if (!r) return null
        return (
          <li key={id}>
            <a href={r.url} target="_blank" rel="noreferrer noopener" className="font-medium text-[var(--accent)] hover:underline">
              {r.title} <ExternalLink size={11} className="inline" aria-hidden />
            </a>
            <span className="text-[var(--text-2)]"> — {r.organization}. {r.type}.</span>
          </li>
        )
      })}
    </ol>
  )
}

export const DISCLAIMER =
  'NeuroSphere 3D is intended for anatomy and neuroscience education. It does not provide medical diagnosis, personalized treatment recommendations, or emergency medical services.'
