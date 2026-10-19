import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Plus, Tags } from 'lucide-react'
import { useFinance } from '../context/FinanceContext.jsx'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import AnalyticsCharts from '../components/dashboard/AnalyticsCharts.jsx'
import VariationInsights from '../components/dashboard/VariationInsights.jsx'
import UnifiedTransactionsTable from '../components/dashboard/UnifiedTransactionsTable.jsx'
import ExpenseModal from '../components/expenses/ExpenseModal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import MonthNavigator from '../components/common/MonthNavigator.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import { useToast } from '../components/common/Toast.jsx'
import { addMonths, getCurrentMonth, previousMonth } from '../utils/format.js'
import { percentChange } from '../utils/analytics.js'

/** Filtra linhas da view por mes ("YYYY-MM"), usando dataReferencia (ISO date). */
function filterViewRowsByMonth(rows, monthKey) {
  const start = `${monthKey}-01`
  const end = `${addMonths(monthKey, 1)}-01`
  return rows.filter(
    (row) => typeof row.dataReferencia === 'string' && row.dataReferencia >= start && row.dataReferencia < end,
  )
}

function sumValor(rows) {
  return rows.reduce((total, row) => total + row.valor, 0)
}

/** Agrupa linhas da view por categoria_nome usando a categoria_cor nativa. */
function groupByCategoria(rows) {
  const map = new Map()
  rows.forEach((row) => {
    const nome = row.categoriaNome?.trim() || 'Sem categoria'
    const entry = map.get(nome) ?? { name: nome, color: row.categoriaCor ?? '#64748b', valor: 0, count: 0 }
    entry.valor += row.valor
    entry.count += 1
    if (row.categoriaCor) entry.color = row.categoriaCor
    map.set(nome, entry)
  })
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor)
}

export default function DashboardPage() {
  const {
    categories,
    expenses,
    viewRows,
    loading,
    error,
    setError,
    addExpense,
    updateExpense,
    deleteExpense,
    duplicateExpense,
  } = useFinance()
  const toast = useToast()

  const [month, setMonth] = useState(getCurrentMonth())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const previousMonthKey = useMemo(() => previousMonth(month), [month])

  const rowsMes = useMemo(() => filterViewRowsByMonth(viewRows, month), [viewRows, month])
  const rowsAnteriores = useMemo(
    () => filterViewRowsByMonth(viewRows, previousMonthKey),
    [viewRows, previousMonthKey],
  )

  const gastoMes = useMemo(() => sumValor(rowsMes), [rowsMes])
  const gastoAnterior = useMemo(() => sumValor(rowsAnteriores), [rowsAnteriores])
  const variation = useMemo(() => percentChange(gastoMes, gastoAnterior), [gastoMes, gastoAnterior])

  const pagoMes = useMemo(
    () => sumValor(rowsMes.filter((row) => row.statusPagamento === 'pago')),
    [rowsMes],
  )
  const pendenteMes = gastoMes - pagoMes

  const contasDoMes = useMemo(
    () => rowsMes.filter((row) => row.origem === 'conta_a_pagar'),
    [rowsMes],
  )
  const contasAbertas = useMemo(() => sumValor(contasDoMes), [contasDoMes])

  const distribution = useMemo(
    () => groupByCategoria(rowsMes).map((entry) => ({ ...entry, actual: entry.valor })),
    [rowsMes],
  )

  const comparison = useMemo(() => {
    const atual = new Map(groupByCategoria(rowsMes).map((entry) => [entry.name, entry]))
    const anterior = new Map(groupByCategoria(rowsAnteriores).map((entry) => [entry.name, entry]))
    const names = new Set([...atual.keys(), ...anterior.keys()])
    return Array.from(names)
      .map((name) => {
        const current = atual.get(name)?.valor ?? 0
        const previous = anterior.get(name)?.valor ?? 0
        const diff = current - previous
        const percent = previous > 0 ? (diff / previous) * 100 : current > 0 ? 100 : 0
        return {
          categoryId: name,
          name,
          color: atual.get(name)?.color ?? anterior.get(name)?.color ?? '#64748b',
          previous,
          current,
          diff,
          percent,
        }
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [rowsMes, rowsAnteriores])

  const previsaoPorCategoria = useMemo(
    () =>
      groupByCategoria(contasDoMes)
        .map((entry) => ({ name: entry.name, color: entry.color, valor: Number(entry.valor.toFixed(2)) }))
        .filter((entry) => entry.valor > 0),
    [contasDoMes],
  )

  function handleSubmit(data) {
    if (editing) updateExpense(editing.id, data)
    else addExpense(data)
  }

  function encontrarLancamento(row) {
    return expenses.find((expense) => expense.id === row.id) ?? null
  }

  function handleEditarGasto(row) {
    const expense = encontrarLancamento(row)
    if (!expense) {
      toast.error('Lançamento não encontrado para edição.')
      return
    }
    setEditing(expense)
    setModalOpen(true)
  }

  async function handleDuplicarGasto(row) {
    const expense = encontrarLancamento(row)
    if (!expense) {
      toast.error('Lançamento não encontrado para duplicação.')
      return
    }
    const targetMonth = addMonths(expense.referenceMonth, 1)
    try {
      await duplicateExpense(expense.id, targetMonth)
      toast.success('Lançamento duplicado com sucesso.', {
        description: `${expense.description} · ${targetMonth}`,
      })
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível duplicar o lançamento.',
      )
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Visão Geral"
        description="Lançamentos e contas a pagar unificados: acompanhe o gasto real do mês e a variação vs. período anterior."
        actions={
          <>
            <MonthNavigator value={month} onChange={setMonth} />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              disabled={categories.length === 0}
            >
              <Plus size={16} /> Novo lançamento
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingBlock label="Carregando seu painel..." />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Comece configurando suas categorias"
          description="O Terada Finance não possui despesas fixas. Crie categorias para começar a lançar seus gastos."
          action={
            <Link to="/categorias" className="btn-primary mt-2">
              <Tags size={16} /> Configurar categorias
            </Link>
          }
        />
      ) : (
        <>
          <DashboardMetrics
            gastoMes={gastoMes}
            registrosMes={rowsMes.length}
            pagoMes={pagoMes}
            pendenteMes={pendenteMes}
            contasAbertas={contasAbertas}
            contasAbertasCount={contasDoMes.length}
            variation={variation}
            gastoAnterior={gastoAnterior}
          />

          <AnalyticsCharts
            comparison={comparison}
            distribution={distribution}
            previsao={previsaoPorCategoria}
            currentMonth={month}
            previousMonthKey={previousMonthKey}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <UnifiedTransactionsTable
                rows={rowsMes}
                onEditar={handleEditarGasto}
                onExcluir={setPendingDelete}
                onDuplicar={handleDuplicarGasto}
              />
            </div>
            <VariationInsights
              comparison={comparison}
              currentTotal={gastoMes}
              previousTotal={gastoAnterior}
              currentMonth={month}
              previousMonthKey={previousMonthKey}
            />
          </div>
        </>
      )}

      <ExpenseModal
        open={modalOpen}
        initial={editing}
        categories={categories}
        defaultMonth={month}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteExpense(pendingDelete.id)}
        title="Excluir lançamento"
        message={`Tem certeza que deseja excluir "${pendingDelete?.descricao}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}
