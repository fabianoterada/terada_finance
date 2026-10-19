import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Plus, Tags } from 'lucide-react'
import { useFinance } from '../context/FinanceContext.jsx'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import AnalyticsCharts from '../components/dashboard/AnalyticsCharts.jsx'
import VariationInsights from '../components/dashboard/VariationInsights.jsx'
import ExpenseTable from '../components/expenses/ExpenseTable.jsx'
import ExpenseModal from '../components/expenses/ExpenseModal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import MonthNavigator from '../components/common/MonthNavigator.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import { getCurrentMonth, previousMonth } from '../utils/format.js'
import {
  aggregateByCategory,
  compareByCategory,
  computeTotals,
  filterByMonth,
  percentChange,
} from '../utils/analytics.js'

export default function DashboardPage() {
  const {
    categories,
    expenses,
    contasPendentes,
    loading,
    error,
    setError,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseStatus,
    duplicateExpense,
    getSubcategory,
  } = useFinance()

  const [month, setMonth] = useState(getCurrentMonth())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const previousMonthKey = useMemo(() => previousMonth(month), [month])

  const currentExpenses = useMemo(() => filterByMonth(expenses, month), [expenses, month])
  const previousExpenses = useMemo(
    () => filterByMonth(expenses, previousMonthKey),
    [expenses, previousMonthKey],
  )

  const totals = useMemo(() => computeTotals(currentExpenses), [currentExpenses])
  const previousTotals = useMemo(() => computeTotals(previousExpenses), [previousExpenses])
  const variation = useMemo(
    () => percentChange(totals.actual, previousTotals.actual),
    [totals.actual, previousTotals.actual],
  )
  const comparison = useMemo(
    () => compareByCategory(currentExpenses, previousExpenses, categories),
    [currentExpenses, previousExpenses, categories],
  )
  const distribution = useMemo(
    () => aggregateByCategory(currentExpenses, categories),
    [currentExpenses, categories],
  )

  // Contas a Pagar com status "pendente" — previsao do mes selecionado
  // (vencimento dentro do mes) e total geral.
  const contasDoMes = useMemo(
    () => contasPendentes.filter((conta) => (conta.dataVencimento ?? '').startsWith(month)),
    [contasPendentes, month],
  )
  const totalAPagarMes = useMemo(
    () => contasDoMes.reduce((total, conta) => total + conta.valor, 0),
    [contasDoMes],
  )
  const totalAPagarGeral = useMemo(
    () => contasPendentes.reduce((total, conta) => total + conta.valor, 0),
    [contasPendentes],
  )
  const previsaoPorCategoria = useMemo(() => {
    const valoresPorCategoria = new Map()
    contasDoMes.forEach((conta) => {
      if (!conta.categoryId) return
      valoresPorCategoria.set(
        conta.categoryId,
        (valoresPorCategoria.get(conta.categoryId) ?? 0) + conta.valor,
      )
    })
    return categories
      .map((category) => ({
        name: category.name,
        color: category.color,
        valor: Number((valoresPorCategoria.get(category.id) ?? 0).toFixed(2)),
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)
  }, [contasDoMes, categories])

  function handleSubmit(data) {
    if (editing) updateExpense(editing.id, data)
    else addExpense(data)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Visão Geral"
        description="Acompanhe o desempenho das suas despesas e compare a evolução mês a mês."
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
            totals={totals}
            previousTotals={previousTotals}
            variation={variation}
            totalAPagar={totalAPagarMes}
            contasAPagarCount={contasDoMes.length}
            totalAPagarGeral={totalAPagarGeral}
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
              <ExpenseTable
                expenses={currentExpenses}
                categories={categories}
                getSubcategory={getSubcategory}
                onEdit={(expense) => {
                  setEditing(expense)
                  setModalOpen(true)
                }}
                onDelete={setPendingDelete}
                onToggle={toggleExpenseStatus}
                onDuplicate={(id, targetMonth) => duplicateExpense(id, targetMonth)}
              />
            </div>
            <VariationInsights
              comparison={comparison}
              currentTotal={totals.actual}
              previousTotal={previousTotals.actual}
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
        message={`Tem certeza que deseja excluir "${pendingDelete?.description}"?`}
        confirmLabel="Excluir"
      />
    </div>
  )
}
