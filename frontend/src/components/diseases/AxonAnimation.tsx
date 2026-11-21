import { useEffect, useRef } from 'react'

const damaged = [2, 3]

/**
 * 2D schematic of a myelinated axon showing saltatory conduction and a focal
 * demyelinated segment. `demyelinated` (0..1) controls how much of the middle
 * internode loses its myelin. Purely illustrative, not to scale.
 */
export function AxonAnimation({ demyelinated, running }: { demyelinated: number; running: boolean }) {
  const pulse = useRef<SVGCircleElement>(null)
  const raf = useRef(0)
  const segments = 6
  const width = 520
  const seg = width / segments

  useEffect(() => {
    const el = pulse.current
    if (!el) return
    let x = 20
    let last = performance.now()
    const step = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      const s = Math.floor((x - 20) / seg)
      const inDamaged = damaged.includes(s) && demyelinated > 0.05
      // saltatory: fast over myelinated internodes, slow and fading over the damaged segment
      const speed = inDamaged ? 120 * (1 - demyelinated * 0.85) : 420
      x += speed * dt
      if (x > width + 20) x = 20
      el.setAttribute('cx', `${x}`)
      el.setAttribute('opacity', inDamaged ? `${1 - demyelinated * 0.7}` : '1')
      if (running) raf.current = requestAnimationFrame(step)
    }
    if (running) raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [running, demyelinated, seg])

  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${width + 40} 120`} className="w-full" role="img" aria-label={`Schematic axon; ${Math.round(demyelinated * 100)}% of the middle segment demyelinated`}>
        <rect x={0} y={0} width={width + 40} height={120} rx={10} fill="var(--bg)" />
        <circle cx={14} cy={60} r={12} fill="#8B5CF6" opacity={0.8} />
        <line x1={20} y1={60} x2={width + 20} y2={60} stroke="#94a3b8" strokeWidth={6} strokeLinecap="round" />
        {Array.from({ length: segments }).map((_, i) => {
          const isDam = damaged.includes(i)
          const keep = isDam ? 1 - demyelinated : 1
          const x = 20 + i * seg + 6
          const w = seg - 12
          return (
            <g key={i}>
              <rect x={x + (w * (1 - keep)) / 2} y={44} width={Math.max(0, w * keep)} height={32} rx={14} fill="#f8e7c9" stroke="#e2c891" opacity={0.95} />
              {isDam && demyelinated > 0.05 && (
                <text x={x + w / 2} y={100} textAnchor="middle" fontSize={11} fill="var(--warn)">demyelinated</text>
              )}
            </g>
          )
        })}
        {Array.from({ length: segments + 1 }).map((_, i) => (
          <text key={i} x={20 + i * seg} y={30} fontSize={9} textAnchor="middle" fill="var(--text-2)">node</text>
        ))}
        <circle ref={pulse} cx={20} cy={60} r={6} fill="#22D3EE" />
      </svg>
      <figcaption className="text-[11px] text-[var(--text-2)]">Myelin (cream) lets impulses jump between nodes of Ranvier. Not to scale.</figcaption>
    </figure>
  )
}
