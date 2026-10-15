import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  BarChart3,
  Wallet,
} from 'lucide-react'
import clsx from 'clsx'
import Logo from '../common/Logo.jsx'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: Receipt },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
]

export default function Sidebar({ onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo />

      <nav className="flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition',
                isActive
                  ? 'bg-brand-red/15 text-white shadow-[inset_0_0_0_1px_rgba(220,38,38,0.45)]'
                  : 'text-slate-400 hover:bg-brand-elevated/70 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={19}
                  className={clsx(
                    'transition',
                    isActive ? 'text-brand-redBright' : 'text-slate-500 group-hover:text-brand-redBright',
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-2xl border border-brand-border bg-gradient-to-br from-brand-redDark/25 to-transparent p-4">
        <div className="flex items-center gap-2 text-brand-redBright">
          <Wallet size={18} />
          <span className="text-sm font-bold text-white">Terada Finance</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Gerencie suas despesas fixas e variáveis de forma 100% personalizada.
        </p>
      </div>
    </div>
  )
}
