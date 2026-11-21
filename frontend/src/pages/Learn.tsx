import { CheckCircle2, Clock, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MODULES } from '@/lib/anatomy'
import { loadProgress } from '@/components/learning/progress'

const LEVEL_COLOR = { beginner: '#34d399', intermediate: '#38bdf8', advanced: '#a78bfa' }

export default function Learn() {
  const progress = loadProgress()
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <GraduationCap /> Learning Modules
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--text-2)]">
          Guided tours drive the same 3D model used in the Anatomy Lab: the camera moves, structures highlight, and
          short quizzes check understanding. Progress is saved in this browser.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {MODULES.map((m, i) => {
            const p = progress[m.id]
            return (
              <li key={m.id}>
                <Link
                  to={`/learn/${m.id}`}
                  className="glass block h-full rounded-xl p-4 hover:border-[var(--accent)]"
                  data-testid={`module-${m.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-2)]">Module {i + 1}</span>
                    <span className="chip" style={{ color: LEVEL_COLOR[m.level] }}>
                      {m.level}
                    </span>
                  </div>
                  <h2 className="mt-1 font-semibold">{m.title}</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-2)]">{m.summary}</p>
                  <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--text-2)]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> ~{m.minutes} min · {m.steps.length} steps · {m.quiz.length} quiz
                    </span>
                    {p?.completed && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={12} /> Completed
                        {typeof p.score === 'number' ? ` · ${p.score}/${m.quiz.length}` : ''}
                      </span>
                    )}
                    {!p?.completed && p?.step !== undefined && (
                      <span>
                        Step {p.step + 1}/{m.steps.length}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
