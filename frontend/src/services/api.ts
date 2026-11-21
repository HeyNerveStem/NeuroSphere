/**
 * Optional connection to the FastAPI content service. The viewer and all
 * content work offline from the bundled JSON; when the API is reachable the
 * Disease Explorer reads from it and the UI shows "API connected".
 */
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { Disease } from '@/types'
import { DISEASES } from '@/lib/anatomy'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
const OFFLINE = import.meta.env.VITE_OFFLINE === '1'

type Status = 'checking' | 'online' | 'offline'
const useStatus = create<{ status: Status }>(() => ({ status: OFFLINE ? 'offline' : 'checking' }))
let checked = false

async function check() {
  if (checked || OFFLINE) return
  checked = true
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const r = await fetch(`${BASE}/health`, { signal: ctrl.signal })
    clearTimeout(t)
    const j = r.ok ? await r.json() : null
    useStatus.setState({ status: j?.status === 'ok' ? 'online' : 'offline' })
  } catch {
    useStatus.setState({ status: 'offline' })
  }
}

export function useApiStatus(): Status {
  const s = useStatus((x) => x.status)
  useEffect(() => {
    void check()
  }, [])
  return s
}

export interface DiseaseSummary {
  id: string
  name: string
  category: string
  classification: string
  overview: string
}

/** Disease catalog: API when available, bundled content otherwise. */
export function useDiseaseCatalog(): { items: DiseaseSummary[]; source: 'api' | 'bundled' } {
  const status = useApiStatus()
  const [state, setState] = useState<{ items: DiseaseSummary[]; source: 'api' | 'bundled' }>({
    items: DISEASES,
    source: 'bundled',
  })
  useEffect(() => {
    if (status !== 'online') return
    let cancelled = false
    fetch(`${BASE}/diseases?limit=200`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { items: DiseaseSummary[] }) => !cancelled && setState({ items: j.items, source: 'api' }))
      .catch(() => {
        /* keep bundled content */
      })
    return () => {
      cancelled = true
    }
  }, [status])
  return state
}

export async function fetchDisease(id: string): Promise<Disease | null> {
  if (useStatus.getState().status !== 'online') return null
  try {
    const r = await fetch(`${BASE}/diseases/${encodeURIComponent(id)}`)
    return r.ok ? ((await r.json()) as Disease) : null
  } catch {
    return null
  }
}
