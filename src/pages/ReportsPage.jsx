import { Fragment, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Download, FilterX, Layers, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { useFinance } from '../context/FinanceContext.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import { addMonths, formatCurrency, formatMonthLabel, formatMonthShort, getCurrentMonth, monthRange } from '../utils/format.js'
import { aggregateByCategory, computeTotals } from '../utils/analytics.js'

function EvolutionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold text-white">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

function SummaryPill({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-elevated/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={clsx(
          'mt-1 text-lg font-bold tabular-nums',
          tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-brand-redBright' : 'text-white',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * Converte uma conta a pagar em aberto (Pendente/Parcial) para o formato de
 * lancamento usado pelos relatorios.
 * - Usa apenas o SALDO (valor - valor_pago) para nao duplicar: as baixas ja
 *   geram lancamentos vinculados em `expenses`.
 * - Contas pagas/canceladas nao vem nessa lista (query do FinanceContext),
 *   entao o lancamento gerado na baixa e contado uma unica vez.
 */
function contaToReportItem(conta) {
  const saldo = Number(conta.saldo) || 0
  const vencimento = typeof conta.dataVencimento === 'string' ? conta.dataVencimento : ''
  return {
    id: `conta-${conta.id}`,
    description: conta.descricao,
    categoryId: conta.categoryId,
    subcategoryId: conta.subcategoryId ?? null,
    expenseType: 'variavel',
    plannedValue: saldo,
    actualValue: saldo,
    status: 'pendente',
    referenceMonth: vencimento.slice(0, 7),
  }
}

export default function ReportsPage() {
  const { categories, expenses, contasPendentes, loading, error, setError, getSubcategory } = useFinance()

  const current = getCurrentMonth()
  const [startMonth, setStartMonth] = useState(addMonths(current, -5))
  const [endMonth, setEndMonth] = useState(current)
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null

  const months = useMemo(() => monthRange(startMonth, endMonth), [startMonth, endMonth])

  const source = useMemo(
    () => [...expenses, ...contasPendentes.map(contaToReportItem)],
    [expenses, contasPendentes],
  )

  const filtered = useMemo(() => {
    const start = startMonth <= endMonth ? startMonth : endMonth
    const end = startMonth <= endMonth ? endMonth : startMonth
    return source.filter((expense) => {
      if (!expense.referenceMonth) return false
      if (expense.referenceMonth < start || expense.referenceMonth > end) return false
      if (categoryId && expense.categoryId !== categoryId) return false
      if (subcategoryId && expense.subcategoryId !== subcategoryId) return false
      if (type && expense.expenseType !== type) return false
      if (status && expense.status !== status) return false
      return true
    })
  }, [source, startMonth, endMonth, categoryId, subcategoryId, type, status])

  const totals = useMemo(() => computeTotals(filtered), [filtered])
  const breakdown = useMemo(
    () => aggregateByCategory(filtered, categories).filter((item) => item.count > 0),
    [filtered, categories],
  )

  const evolution = useMemo(
    () =>
      months.map((monthKey) => {
        const monthExpenses = filterCommon(filtered, monthKey)
        const monthTotals = computeTotals(monthExpenses)
        return {
          name: formatMonthShort(monthKey),
          Previsto: Number(monthTotals.planned.toFixed(2)),
          Real: Number(monthTotals.actual.toFixed(2)),
        }
      }),
    [months, filtered],
  )

  function subcategoryBreakdown(category) {
    const map = new Map()
    filtered
      .filter((expense) => expense.categoryId === category.categoryId)
      .forEach((expense) => {
        const key = expense.subcategoryId ?? '__none__'
        const sub = getSubcategory(category.categoryId, expense.subcategoryId)
        const entry = map.get(key) ?? {
          id: key,
          name: sub?.name ?? 'Sem subcategoria',
          real: 0,
          planned: 0,
          count: 0,
        }
        entry.real += Number(expense.actualValue) || 0
        entry.planned += Number(expense.plannedValue) || 0
        entry.count += 1
        map.set(key, entry)
      })
    return Array.from(map.values()).sort((a, b) => b.real - a.real)
  }

  function resetFilters() {
    setStartMonth(addMonths(current, -5))
    setEndMonth(current)
    setCategoryId('')
    setSubcategoryId('')
    setType('')
    setStatus('')
  }

  function exportCsv() {
    const header = ['Descrição', 'Categoria', 'Subcategoria', 'Tipo', 'Mês', 'Previsto', 'Real', 'Status']
    const rows = filtered.map((expense) => {
      const category = categories.find((item) => item.id === expense.categoryId)
      const sub = getSubcategory(expense.categoryId, expense.subcategoryId)
      return [
        expense.description,
        category?.name ?? '',
        sub?.name ?? '',
        expense.expenseType,
        expense.referenceMonth,
        String(expense.plannedValue).replace('.', ','),
        String(expense.actualValue).replace('.', ','),
        expense.status,
      ]
    })
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `terada-finance-relatorio-${startMonth}_${endMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Relatórios e Análises"
        description="Filtre por período, categoria, subcategoria e tipo de despesa para análises detalhadas."
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={resetFilters}>
              <FilterX size={16} /> Limpar filtros
            </button>
            <button type="button" className="btn-primary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download size={16} /> Exportar CSV
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="report-start">Mês inicial</label>
            <input
              id="report-start"
              type="month"
              className="input"
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="report-end">Mês final</label>
            <input
              id="report-end"
              type="month"
              className="input"
              value={endMonth}
              onChange={(event) => setEndMonth(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="report-category">Categoria</label>
            <select
              id="report-category"
              className="input"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                setSubcategoryId('')
              }}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="report-subcategory">Subcategoria</label>
            <select
              id="report-subcategory"
              className="input"
              value={subcategoryId}
              disabled={!selectedCategory || selectedCategory.subcategories.length === 0}
              onChange={(event) => setSubcategoryId(event.target.value)}
            >
              <option value="">Todas</option>
              {selectedCategory?.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="report-type">Tipo</label>
              <select
                id="report-type"
                className="input"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="fixa">Fixa</option>
                <option value="variavel">Variável</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="report-status">Status</label>
              <select
                id="report-status"
                className="input"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryPill label="Total Previsto" value={formatCurrency(totals.planned)} />
        <SummaryPill label="Total Real" value={formatCurrency(totals.actual)} />
        <SummaryPill label="Pago" value={formatCurrency(totals.paid)} tone="positive" />
        <SummaryPill label="Pendente" value={formatCurrency(totals.pending)} tone="negative" />
      </div>

      {loading ? (
        <LoadingBlock label="Carregando relatórios..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum lançamento no período"
          description="Ajuste os filtros acima para visualizar os dados."
        />
      ) : (
        <>
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-redBright" />
              <div>
                <h3 className="font-bold text-white">Evolução no Período</h3>
                <p className="text-xs text-slate-400">
                  {formatMonthLabel(months[0])} até {formatMonthLabel(months[months.length - 1])}
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="realFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="plannedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232f42" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#232f42' }} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip content={<EvolutionTooltip />} />
                  <Area type="monotone" dataKey="Previsto" stroke="#94a3b8" fill="url(#plannedFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Real" stroke="#ef4444" fill="url(#realFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-brand-border p-4">
              <Layers size={16} className="text-brand-redBright" />
              <h3 className="font-bold text-white">Detalhamento por Categoria</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Categoria / Subcategoria</th>
                    <th className="px-4 py-3 text-right font-semibold">Previsto</th>
                    <th className="px-4 py-3 text-right font-semibold">Real</th>
                    <th className="px-4 py-3 text-right font-semibold">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((item) => {
                    const share = totals.actual > 0 ? (item.actual / totals.actual) * 100 : 0
                    return (
                      <Fragment key={item.categoryId}>
                        <tr className="border-b border-brand-border/40 bg-brand-elevated/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.name}
                              <span className="text-xs font-normal text-slate-500">
                                ({item.count} lançamento{item.count === 1 ? '' : 's'})
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                            {formatCurrency(item.planned)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                            {formatCurrency(item.actual)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {share.toFixed(1).replace('.', ',')}%
                          </td>
                        </tr>
                        {subcategoryBreakdown(item).map((sub) => (
                          <tr key={sub.id} className="border-b border-brand-border/20 text-slate-400">
                            <td className="py-2 pl-10 pr-4">
                              <span className="text-xs sm:text-sm">{sub.name}</span>
                            </td>
                            <td className="px-4 py-2 text-right text-xs tabular-nums sm:text-sm">
                              {formatCurrency(sub.planned)}
                            </td>
                            <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-200 sm:text-sm">
                              {formatCurrency(sub.real)}
                            </td>
                            <td className="px-4 py-2" />
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-brand-border bg-brand-elevated/30">
                    <td className="px-4 py-3 font-bold text-white">Total</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-300">
                      {formatCurrency(totals.planned)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-white">
                      {formatCurrency(totals.actual)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-300">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function filterCommon(expenses, monthKey) {
  return expenses.filter((expense) => expense.referenceMonth === monthKey)
}
