import { ChevronLeft, ChevronRight, Pause, Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ANIMATION_DISCLAIMER, manifestById, resolveTarget } from '@/lib/anatomy'
import { useAnimation } from '@/stores/animationStore'
import { useViewer } from '@/stores/viewerStore'
import type { AnimationStep, DiseaseAnimation, HighlightStyle, Vec3 } from '@/types'
import { AxonAnimation } from './AxonAnimation'

function lesionFor(step: AnimationStep) {
  if (!step.lesion) return null
  const m = manifestById.get(step.lesion.near)
  if (!m) return null
  const p = m.originalPosition
  const k = 1 - step.lesion.inset // move toward (inset>0) or away from (inset<0) the brain centre
  const position: Vec3 = [p[0] * k, p[1] * k, p[2] * k]
  return { position, radius: step.lesion.radius, massEffect: step.lesion.massEffect ?? 0 }
}

export function applyStep(step: AnimationStep, title: string) {
  const v = useViewer.getState()
  const hl: Record<string, HighlightStyle> = {}
  for (const h of step.highlight ?? [])
    for (const m of resolveTarget(h.target)) if (!hl[m] || h.style === 'primary') hl[m] = h.style
  v.setHighlight(hl, title, Object.keys(hl).length > 0)
  v.setPulse(!!step.pulse)
  v.setXray(!!step.xray)
  v.setLesion(lesionFor(step))
  if (step.camera) v.requestCamera({ kind: 'preset', preset: step.camera })
  if (step.camera && !['sagittal', 'coronal', 'axial'].includes(step.camera)) v.setClip({ mode: 'none' })
  const a = useAnimation.getState()
  a.setMode('complete')
  if (typeof step.explode === 'number') a.animateTo(step.explode)
}

export function clearDiseaseVisuals() {
  const v = useViewer.getState()
  v.clearHighlight()
  v.setLesion(null)
  v.setXray(false)
}

export function DiseaseAnimationPlayer({ anim }: { anim: DiseaseAnimation }) {
  const [i, setI] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number>(0)
  const step = i >= 0 ? anim.steps[i] : null

  useEffect(() => {
    if (!step || anim.kind === 'axon') return
    applyStep(step, anim.title)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!playing || !step) return
    timer.current = window.setTimeout(
      () => {
        if (i < anim.steps.length - 1) setI(i + 1)
        else setPlaying(false)
      },
      step.durationMs / (useViewer.getState().reducedMotion ? 0.5 : 1),
    )
    return () => window.clearTimeout(timer.current)
  }, [playing, i, step, anim.steps.length])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (anim.kind !== 'axon') clearDiseaseVisuals()
    },
    [anim.kind],
  )

  const stop = () => {
    setPlaying(false)
    setI(-1)
    if (anim.kind !== 'axon') {
      clearDiseaseVisuals()
      useAnimation.getState().setProgress(0)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] p-3" data-testid="disease-animation">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{anim.title}</p>
        <span className="chip text-[var(--warn)]">Educational schematic</span>
      </div>
      {anim.kind === 'axon' && <AxonAnimation demyelinated={step?.demyelinated ?? 0} running={playing || i >= 0} />}
      <p className="mt-2 min-h-[2.6rem] text-[13px] leading-snug" aria-live="polite">
        {step ? (
          <>
            <strong>
              Step {i + 1}/{anim.steps.length}.
            </strong>{' '}
            {step.caption}
          </>
        ) : (
          <span className="text-[var(--text-2)]">
            Press play to start the {anim.steps.length}-step sequence
            {anim.kind === 'sequence' ? ' in the 3D viewer' : ''}.
          </span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          className="btn btn-icon"
          aria-label="Previous step"
          disabled={i <= 0}
          onClick={() => {
            setPlaying(false)
            setI(Math.max(0, i - 1))
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (playing) setPlaying(false)
            else {
              if (i < 0 || i >= anim.steps.length - 1) setI(0)
              setPlaying(true)
            }
          }}
        >
          {playing ? (
            <>
              <Pause size={14} /> Pause
            </>
          ) : (
            <>
              <Play size={14} /> Play
            </>
          )}
        </button>
        <button
          className="btn btn-icon"
          aria-label="Next step"
          disabled={i >= anim.steps.length - 1}
          onClick={() => {
            setPlaying(false)
            setI(i + 1)
          }}
        >
          <ChevronRight size={14} />
        </button>
        <button className="btn btn-icon" aria-label="Stop and clear" onClick={stop}>
          <Square size={13} />
        </button>
        <div className="ml-2 flex flex-1 gap-1" aria-hidden>
          {anim.steps.map((_, k) => (
            <span
              key={k}
              className={`h-1.5 flex-1 rounded-full ${k <= i ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>
      </div>
      {anim.note && <p className="mt-2 text-[11.5px] text-[var(--text-2)]">{anim.note}</p>}
      <p className="mt-2 text-[10.5px] leading-snug text-[var(--text-2)]">{ANIMATION_DISCLAIMER}</p>
    </div>
  )
}
