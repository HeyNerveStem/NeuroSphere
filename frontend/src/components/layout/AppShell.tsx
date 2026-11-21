import { Brain, Menu, Moon, Search, Settings, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useViewer } from '@/stores/viewerStore'
import { GlobalSearch } from './GlobalSearch'
import { useApiStatus } from '@/services/api'

const LINKS = [
  { to: '/anatomy', label: 'Anatomy Lab' },
  { to: '/diseases', label: 'Disease Explorer' },
  { to: '/learn', label: 'Learning Modules' },
  { to: '/about', label: 'About' },
]

export function AppShell() {
  const theme = useViewer((s) => s.theme)
  const [menu, setMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const loc = useLocation()
  const api = useApiStatus()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  useEffect(() => {
    setMenu(false)
    setSearchOpen(false)
  }, [loc.pathname])

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${isActive ? 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--text)]' : 'text-[var(--text-2)] hover:text-[var(--text)]'}`

  return (
    <div className="flex h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--surface-solid)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-2)]/90 px-3 backdrop-blur md:px-4">
        <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="NeuroSphere 3D home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#8B5CF6] text-[#04121f]">
            <Brain size={18} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            NeuroSphere <span className="text-[var(--accent)]">3D</span>
          </span>
        </NavLink>
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden flex-1 justify-end md:flex">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button className="btn btn-icon md:hidden" aria-label="Search" onClick={() => setSearchOpen((x) => !x)}>
            <Search size={16} />
          </button>
          <button
            className="btn btn-icon"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => useViewer.getState().updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavLink to="/settings" className="btn btn-icon" aria-label="Settings">
            <Settings size={16} />
          </NavLink>
          <button
            className="btn btn-icon lg:hidden"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        {searchOpen && (
          <div className="absolute left-0 right-0 top-full border-b border-[var(--border)] bg-[var(--bg-2)] p-2 md:hidden">
            <GlobalSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}
        {menu && (
          <nav
            className="absolute left-0 right-0 top-full flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--bg-2)] p-2 lg:hidden"
            aria-label="Mobile"
          >
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/settings" className={linkCls}>
              Settings
            </NavLink>
          </nav>
        )}
      </header>
      <main id="main" className="relative min-h-0 flex-1">
        <Outlet />
      </main>
      <span className="sr-only" aria-live="polite">
        {api === 'online' ? 'Content API connected' : ''}
      </span>
    </div>
  )
}
