import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { BrainScene, LoadingProgress } from '@/three/BrainScene'
import { computeLabelEntries } from '@/three/LabelManager'
import { overlay } from '@/three/registry'
import { useViewer } from '@/stores/viewerStore'
import { HighlightLegend } from './HighlightLegend'

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[NeuroSphere] 3D viewer error:', error)
  }
  render() {
    if (this.state.error)
      return (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="glass max-w-md rounded-xl p-5">
            <p className="font-semibold">The 3D viewer could not start.</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{this.state.error.message}</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              WebGL may be disabled or unsupported on this device. You can still explore every structure using the
              searchable hierarchy and information panels.
            </p>
          </div>
        </div>
      )
    return this.props.children
  }
}

function LabelLayer() {
  const labelMode = useViewer((s) => s.labelMode)
  const selectedId = useViewer((s) => s.selectedId)
  const level = useViewer((s) => s.level)
  const entries = useMemo(() => computeLabelEntries(labelMode, selectedId, level), [labelMode, selectedId, level])
  const ref = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    overlay.labelLayer = ref.current
    overlay.leaderSvg = svg.current
    return () => {
      overlay.labelLayer = null
      overlay.leaderSvg = null
    }
  }, [])
  return (
    <>
      <svg ref={svg} className="pointer-events-none absolute inset-0 h-full w-full" style={{ display: 'none' }} aria-hidden>
        <line stroke="#22D3EE" strokeWidth={1.5} />
        <circle r={3.5} fill="#22D3EE" />
      </svg>
      <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {entries.map((e) => (
          <button
            key={e.id}
            data-label-id={e.id}
            tabIndex={-1}
            className={`label-3d ${e.priority === 0 ? 'selected' : ''}`}
            onClick={() => useViewer.getState().select(e.id)}
            onDoubleClick={() => useViewer.getState().requestCamera({ kind: 'focus', id: e.id })}
          >
            {e.text}
          </button>
        ))}
      </div>
    </>
  )
}

function OrientationWidget() {
  const show = useViewer((s) => s.showOrientation)
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    overlay.orientation = ref.current
    return () => {
      overlay.orientation = null
    }
  }, [show])
  if (!show) return null
  const colors = ['#f87171', '#4ade80', '#60a5fa']
  return (
    <div className="glass pointer-events-none absolute bottom-3 left-3 rounded-full p-1" aria-label="Orientation indicator">
      <svg ref={ref} viewBox="-44 -44 88 88" width={84} height={84} role="img">
        <title>Anatomical orientation: L left, R right, S superior, I inferior, A anterior, P posterior</title>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line data-axis={i} x1={0} y1={0} x2={0} y2={0} stroke={colors[i]} strokeWidth={2.5} strokeLinecap="round" />
            <text data-label={`${i}p`} fontSize={10} fontWeight={700} fill={colors[i]} textAnchor="middle">
              {['L', 'S', 'A'][i]}
            </text>
            <text data-label={`${i}n`} fontSize={9} fontWeight={600} fill={colors[i]} textAnchor="middle" opacity={0.7}>
              {['R', 'I', 'P'][i]}
            </text>
          </g>
        ))}
        <circle r={2.5} fill="var(--text-2)" />
      </svg>
    </div>
  )
}

export function Viewport({ interactive = true, autoRotate = false, children }: { interactive?: boolean; autoRotate?: boolean; children?: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="viewport">
      <ViewerErrorBoundary>
        <BrainScene interactive={interactive} autoRotate={autoRotate} />
        <LabelLayer />
        <OrientationWidget />
        <LoadingProgress />
        <HighlightLegend />
      </ViewerErrorBoundary>
      {children}
    </div>
  )
}
