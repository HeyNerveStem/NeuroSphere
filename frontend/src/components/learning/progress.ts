const KEY = 'neurosphere.learning.v1'
export type ModuleProgress = { step?: number; completed?: boolean; score?: number }

export function loadProgress(): Record<string, ModuleProgress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ModuleProgress>
  } catch {
    return {}
  }
}

export function saveProgress(id: string, p: ModuleProgress) {
  try {
    const all = loadProgress()
    all[id] = { ...all[id], ...p }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: progress stays for this session only */
  }
}
