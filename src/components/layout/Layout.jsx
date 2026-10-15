import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import clsx from 'clsx'
import Sidebar, { NAV_ITEMS } from './Sidebar.jsx'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const current = NAV_ITEMS.slice().reverse().find(({ to, end }) =>
    end ? location.pathname === to : location.pathname.startsWith(to),
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-brand-border bg-brand-surface/60 backdrop-blur lg:block">
        <Sidebar />
      </aside>

      {/* Drawer mobile */}
      <div
        className={clsx(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={clsx(
            'absolute left-0 top-0 h-full w-72 border-r border-brand-border bg-brand-surface transition-transform duration-300',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-brand-elevated hover:text-white"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-border bg-brand-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-brand-border p-2 text-slate-300 hover:border-brand-red/60 hover:text-white"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-white">
            {current?.label ?? 'Terada Finance'}
          </span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
