import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Banknote,
  Tags,
  BarChart3,
  Users,
  Wallet,
  LogOut,
  User,
} from 'lucide-react'
import clsx from 'clsx'
import Logo from '../common/Logo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: Receipt },
  { to: '/contas', label: 'Contas a Pagar', icon: Banknote },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
]

export default function Sidebar({ onNavigate }) {
  const { user, profile, isAdmin, signOut } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo />

      <nav className="flex flex-1 flex-col gap-1.5">
        {items.map(({ to, label, icon: Icon, end }) => (
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

      <div className="space-y-3 rounded-2xl border border-brand-border bg-gradient-to-br from-brand-redDark/25 to-transparent p-4">
        <div className="flex items-center gap-2 text-brand-redBright">
          <Wallet size={18} />
          <span className="text-sm font-bold text-white">Terada Finance</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-elevated/50 px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-brand-redBright">
            <User size={14} />
          </span>
          <span className="truncate text-xs text-slate-300" title={user?.email}>
            {profile?.full_name?.trim() || user?.email || 'Sessão ativa'}
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-redDark/50 bg-brand-redDark/15 px-3 py-2 text-sm font-semibold text-brand-redBright transition hover:bg-brand-redDark/30"
        >
          <LogOut size={15} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
