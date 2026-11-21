import { ArrowLeft, ChevronLeft, ChevronRight, Volume2, VolumeX, CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MODULES, diseaseById, resolveTarget } from '@/lib/anatomy'
import { Viewport } from '@/components/viewer/Viewport'
import { useViewer } from '@/stores/viewerStore'
import { useAnimation } from '@/stores/animationStore'
import { useWhenModelReady } from '@/hooks/useViewerHooks'
import { loadProgress, saveProgress } from '@/components/learning/progress'
import type { HighlightStyle, TourStep } from '@/types'

function applyTourStep(step: TourStep) {
  const v = useViewer.getState()
  const a = useAnimation.getState()
  v.select(null)
  v.setLesion(null)
  v.setClip({ mode: 'none' })
  const hidden: Record<string, true> = {}
  for (const t of step.hide ?? []) for (const m of resolveTarget(t)) hidden[m] = true
  useViewer.setState({ hidden, isolated: null })
  v.setXray(!!step.xray)
  const hl: Record<string, HighlightStyle> = {}
  for (const t of step.highlight) for (const m of resolveTarget(t)) hl[m] = 'tour'
  const caption = step.disease
    ? `${step.title} · schematic association (${diseaseById.get(step.disease)?.name})`
    : step.title
  if (Object.keys(hl).length) v.setHighlight(hl, caption, true)
  else v.clearHighlight()
  if (step.camera) v.requestCamera({ kind: 'preset', preset: step.camera })
  if (step.camera && ['sagittal', 'coronal', 'axial'].includes(step.camera)) {
    /* preset applies its own section plane */
  }
  a.setMode('complete')
  a.animateTo(step.explode ?? 0)
}

function speak(text: string, on: boolean) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  if (on) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export default function LearnModule() {
  const { moduleId = '' } = useParams()
  const mod = MODULES.find((m) => m.id === moduleId)
  const [i, setI] = useState(() => Math.min(loadProgress()[moduleId]?.step ?? 0, (mod?.steps.length ?? 1) - 1))
  const [quiz, setQuiz] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [narrate, setNarrate] = useState(false)
  const step = mod?.steps[i]

  useWhenModelReady(() => {
    if (step && !quiz) applyTourStep(step)
  }, [moduleId, i, quiz])
  useEffect(() => {
    if (step && !quiz) speak(`${step.title}. ${step.text}`, narrate)
    if (mod) saveProgress(mod.id, { step: i })
  }, [i, narrate, quiz]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      speak('', false)
      useViewer.getState().resetView()
      useAnimation.getState().reset()
    },
    [],
  )

  if (!mod || !step)
    return (
      <div className="p-8">
        Unknown module.{' '}
        <Link className="text-[var(--accent)]" to="/learn">
          Back
        </Link>
      </div>
    )
  const score = mod.quiz.reduce((n, q, k) => n + (answers[k] === q.answer ? 1 : 0), 0)
  const allAnswered = Object.keys(answers).length === mod.quiz.length

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="relative min-h-[45vh] flex-1">
        <Viewport />
      </div>
      <aside
        className="scrollbar-thin flex max-h-[55vh] w-full shrink-0 flex-col overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-solid)] lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0"
        aria-label="Lesson"
      >
        <div className="p-4">
          <Link to="/learn" className="btn mb-3">
            <ArrowLeft size={14} /> All modules
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            {mod.level} · ~{mod.minutes} min
          </p>
          <h1 className="text-xl font-semibold" data-testid="module-title">
            {mod.title}
          </h1>
          <div className="mt-3 flex gap-1" aria-label={`Progress: step ${i + 1} of ${mod.steps.length}`}>
            {mod.steps.map((_, k) => (
              <button
                key={k}
                className={`h-1.5 flex-1 rounded-full ${k <= i && !quiz ? 'bg-[var(--accent)]' : quiz ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                aria-label={`Go to step ${k + 1}`}
                onClick={() => {
                  setQuiz(false)
                  setI(k)
                }}
              />
            ))}
          </div>
        </div>
        {!quiz ? (
          <div className="flex-1 px-4 pb-4" aria-live="polite">
            <p className="text-xs text-[var(--text-2)]">
              Step {i + 1} of {mod.steps.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed">{step.text}</p>
            <div className="mt-5 flex items-center gap-2">
              <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
                <ChevronLeft size={14} /> Previous
              </button>
              {i < mod.steps.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setI(i + 1)} data-testid="tour-next">
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setQuiz(true)}>
                  Take the quiz <ChevronRight size={14} />
                </button>
              )}
              <button
                className={`btn btn-icon ml-auto ${narrate ? 'btn-active' : ''}`}
                aria-pressed={narrate}
                aria-label="Toggle narration"
                onClick={() => setNarrate(!narrate)}
                title="Optional narration (browser speech synthesis)"
              >
                {narrate ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 px-4 pb-4">
            <h2 className="text-lg font-semibold">Check your understanding</h2>
            {mod.quiz.map((q, k) => (
              <fieldset key={k} className="mt-4">
                <legend className="text-[14px] font-medium">
                  {k + 1}. {q.q}
                </legend>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((o, j) => {
                    const chosen = answers[k] === j
                    const answered = answers[k] !== undefined
                    const correct = j === q.answer
                    return (
                      <button
                        key={j}
                        disabled={answered}
                        className={`btn w-full justify-start text-left ${answered && correct ? 'border-emerald-500' : ''} ${chosen && !correct ? 'border-red-400' : ''}`}
                        onClick={() => setAnswers({ ...answers, [k]: j })}
                      >
                        {answered && correct && <CheckCircle2 size={14} className="text-emerald-400" />}
                        {chosen && !correct && <XCircle size={14} className="text-red-400" />}
                        <span className="whitespace-normal">{o}</span>
                      </button>
                    )
                  })}
                </div>
                {answers[k] !== undefined && <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">{q.explain}</p>}
              </fieldset>
            ))}
            {allAnswered && (
              <div className="mt-5 rounded-lg border border-[var(--border)] p-3">
                <p className="font-semibold">
                  Score: {score} / {mod.quiz.length}
                </p>
                <button
                  className="btn btn-primary mt-2"
                  onClick={() => saveProgress(mod.id, { completed: true, score })}
                >
                  Mark module complete
                </button>
              </div>
            )}
            <button className="btn mt-4" onClick={() => setQuiz(false)}>
              <ChevronLeft size={14} /> Back to lesson
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
