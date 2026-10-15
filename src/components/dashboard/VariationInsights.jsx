import { ArrowDownRight, ArrowUpRight, Equal, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { formatCurrency, formatMonthShort, formatPercent } from '../../utils/format.js'

export default function VariationInsights({
  comparison,
  currentTotal,
  previousTotal,
  currentMonth,
  previousMonthKey,
}) {
  const overallDiff = currentTotal - previousTotal
  const movers = comparison.filter((item) => Math.abs(item.diff) > 0.005).slice(0, 6)

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/15 text-brand-redBright">
          <Sparkles size={17} />
        </span>
        <div>
          <h3 className="font-bold text-white">Análise de Variação</h3>
          <p className="text-xs text-slate-400">Comparação automática com o mês anterior</p>
        </div>
      </div>

      <div
        className={clsx(
          'mb-4 rounded-xl border p-4 text-sm',
          overallDiff > 0
            ? 'border-brand-redDark/50 bg-brand-redDark/15 text-brand-redBright'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
        )}
      >
        {overallDiff > 0 ? (
          <ArrowUpRight size={16} className="mb-1" />
        ) : (
          <ArrowDownRight size={16} className="mb-1" />
        )}
        <p className="font-semibold">
          Em {formatMonthShort(currentMonth)} você gastou{' '}
          {formatCurrency(Math.abs(overallDiff))} {overallDiff > 0 ? 'a mais' : 'a menos'} que em{' '}
          {formatMonthShort(previousMonthKey)}.
        </p>
      </div>

      {movers.length === 0 ? (
        <p className="text-sm text-slate-500">
          Sem variações relevantes entre os períodos comparados.
        </p>
      ) : (
        <ul className="space-y-2">
          {movers.map((item) => {
            const up = item.diff > 0
            const Icon = up ? ArrowUpRight : ArrowDownRight
            return (
              <li
                key={item.categoryId}
                className="flex items-center gap-3 rounded-xl border border-brand-border/70 bg-brand-elevated/40 px-3 py-2.5"
              >
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(item.previous)} → {formatCurrency(item.current)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={clsx(
                      'badge',
                      up ? 'bg-brand-redDark/25 text-brand-redBright' : 'bg-emerald-500/15 text-emerald-400',
                    )}
                  >
                    <Icon size={12} />
                    {formatPercent(item.percent)}
                  </span>
                  <p
                    className={clsx(
                      'mt-1 text-xs font-semibold tabular-nums',
                      up ? 'text-brand-redBright' : 'text-emerald-400',
                    )}
                  >
                    {up ? '+' : '-'}
                    {formatCurrency(Math.abs(item.diff))}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {comparison.every((item) => Math.abs(item.diff) <= 0.005) && comparison.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Equal size={13} /> Gastos estáveis em relação ao mês anterior.
        </p>
      )}
    </div>
  )
}
