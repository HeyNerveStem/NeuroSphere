import { ArrowRight, Boxes, Brain, GraduationCap, Layers3, Search, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Viewport } from '@/components/viewer/Viewport'
import { DISEASES, MANIFEST, MODULES, STRUCTURES } from '@/lib/anatomy'
import { DISCLAIMER } from '@/components/ui/ReferenceList'
import { useWhenModelReady } from '@/hooks/useViewerHooks'
import { useViewer } from '@/stores/viewerStore'
import { useAnimation } from '@/stores/animationStore'

const FEATURES = [
  { icon: Boxes, title: 'Real segmented anatomy', text: `${STRUCTURES.filter((s) => s.kind === 'mesh').length} independently selectable structures from the peer-reviewed BodyParts3D database — no invented geometry.` },
  { icon: Layers3, title: 'Virtual dissection', text: 'Drag structures apart with a 3D gizmo, or watch deterministic layer-by-layer disassembly with a scrubbable timeline.' },
  { icon: Stethoscope, title: 'Disease explorer', text: `${DISEASES.length} neurological conditions with pathophysiology, diagnosis, treatment and schematic regional associations.` },
  { icon: GraduationCap, title: 'Guided learning', text: `${MODULES.length} interactive tours with camera moves, highlights and quizzes on the same 3D model.` },
]

export default function Home() {
  useWhenModelReady(() => {
    useViewer.getState().resetView()
    useViewer.getState().updateSettings({ labelMode: useViewer.getState().labelMode })
    useAnimation.getState().reset()
  }, [])
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <section className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-6 pt-8 lg:grid-cols-[1fr_1.15fr] lg:pt-14">
        <div>
          <p className="chip mb-4 text-[var(--accent)]"><Brain size={12} /> Interactive neuroanatomy laboratory</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
            Explore the human brain <span className="bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] bg-clip-text text-transparent">in three dimensions</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--text-2)]">
            Rotate, section and dissect a real segmented brain model. Select any structure to learn its anatomy, functions and
            connections, then see how neurological diseases relate to it.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/anatomy" className="btn btn-primary px-4 py-2 text-sm" data-testid="enter-lab">Enter the Anatomy Lab <ArrowRight size={15} /></Link>
            <Link to="/diseases" className="btn px-4 py-2 text-sm">Disease Explorer</Link>
            <Link to="/learn" className="btn px-4 py-2 text-sm">Start a guided tour</Link>
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--text-2)]"><Search size={12} /> Try searching “hippocampus”, “memory” or “stroke” in the top bar.</p>
        </div>
        <div className="glass relative h-[52vh] min-h-[340px] overflow-hidden rounded-2xl lg:h-[62vh]">
          <Viewport interactive={false} autoRotate />
          <p className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-[var(--text-2)]">Drag to rotate · {MANIFEST.trianglesTotal.toLocaleString()} triangles</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-3 px-4 pb-10 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass rounded-xl p-4">
            <f.icon size={18} className="text-[var(--accent)]" />
            <h2 className="mt-2 font-semibold">{f.title}</h2>
            <p className="mt-1 text-[13px] leading-snug text-[var(--text-2)]">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-[var(--border)] px-4 py-5 text-center text-[11.5px] text-[var(--text-2)]">
        <p>{DISCLAIMER}</p>
        <p className="mt-1">3D anatomy: {MANIFEST.source.attribution}. <Link to="/about" className="underline">Sources & licenses</Link></p>
      </footer>
    </div>
  )
}
