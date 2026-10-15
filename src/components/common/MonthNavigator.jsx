import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { addMonths, formatMonthLabel, getCurrentMonth } from '../../utils/format.js'

export default function MonthNavigator({ value, onChange, allowFuture = true }) {
  const go = (amount) => {
    const next = addMonths(value, amount)
    if (!allowFuture && next > getCurrentMonth()) return
    onChange(next)
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-brand-border bg-brand-surface/70 p-1">
      <button
        type="button"
        onClick={() => go(-1)}
        className="rounded-lg p-2 text-slate-300 transition hover:bg-brand-elevated hover:text-white"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="flex min-w-[150px] items-center justify-center gap-2 px-2 text-sm font-semibold text-white">
        <CalendarDays size={15} className="text-brand-redBright" />
        {formatMonthLabel(value)}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        className="rounded-lg p-2 text-slate-300 transition hover:bg-brand-elevated hover:text-white"
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
