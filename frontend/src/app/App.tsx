import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Link, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

const Home = lazy(() => import('@/pages/Home'))
const AnatomyLab = lazy(() => import('@/pages/AnatomyLab'))
const DiseaseCatalog = lazy(() => import('@/pages/DiseaseCatalog'))
const DiseaseDetail = lazy(() => import('@/pages/DiseaseDetail'))
const Learn = lazy(() => import('@/pages/Learn'))
const LearnModule = lazy(() => import('@/pages/LearnModule'))
const About = lazy(() => import('@/pages/About'))
const Settings = lazy(() => import('@/pages/Settings'))

const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="text-[var(--accent)]">
        Go home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="p-8 text-sm text-[var(--text-2)]">Loading…</div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="anatomy" element={<AnatomyLab />} />
            <Route path="anatomy/:structureId" element={<AnatomyLab />} />
            <Route path="diseases" element={<DiseaseCatalog />} />
            <Route path="diseases/:diseaseId" element={<DiseaseDetail />} />
            <Route path="learn" element={<Learn />} />
            <Route path="learn/:moduleId" element={<LearnModule />} />
            <Route path="about" element={<About />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}
