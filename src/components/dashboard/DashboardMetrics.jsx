import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, Wallet, CalendarClock, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import { formatCurrency, formatPercent } from '../../utils/format.js'

function TrendBadge({ value, invert = false }) {
  const isFlat = Math.abs(value) < 0.05
  const isUp = value > 0
  // Para despesas, subir e ruim (vermelho) e descer e bom (verde).
  const positive = invert ? isUp : !isUp
  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={clsx(
        'badge',
        isFlat
          ? 'bg-slate-500/15 text-slate-400'
          : positive
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-brand-redDark/25 text-brand-redBright',
      )}
    >
      <Icon size={13} />
      {formatPercent(value)}
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'default', footer, progress }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-brand-elevated text-brand-redBright">
          <Icon size={18} />
        </span>
        {footer}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={clsx(
            'mt-1 text-2xl font-extrabold tabular-nums tracking-tight',
            tone === 'positive' && 'text-emerald-400',
            tone === 'negative' && 'text-brand-redBright',
            tone === 'default' && 'text-white',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      {typeof progress === 'number' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-elevated">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-red to-brand-redBright transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function DashboardMetrics({ totals, previousTotals, variation }) {
  const paidPercent = totals.actual > 0 ? (totals.paid / totals.actual) * 100 : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={Wallet}
        label="Saldo Atual do Mês"
        value={formatCurrency(totals.balance)}
        tone={totals.balance >= 0 ? 'positive' : 'negative'}
        hint={
          totals.balance >= 0
            ? 'Dentro do orçamento previsto'
            : 'Orçamento previsto excedido'
        }
      />
      <MetricCard
        icon={CalendarClock}
        label="Despesas Previstas"
        value={formatCurrency(totals.planned)}
        hint={`${totals.count} lançamento${totals.count === 1 ? '' : 's'} no mês`}
      />
      <MetricCard
        icon={CheckCircle2}
        label="Despesas Pagas"
        value={formatCurrency(totals.paid)}
        hint={`${formatCurrency(totals.pending)} ainda pendente`}
        progress={paidPercent}
      />
      <MetricCard
        icon={TrendingUp}
        label="Variação vs. mês anterior"
        value={formatPercent(variation)}
        tone={variation > 0 ? 'negative' : 'positive'}
        hint={`Mês anterior: ${formatCurrency(previousTotals.actual)}`}
        footer={<TrendBadge value={variation} invert />}
      />
    </div>
  )
}
