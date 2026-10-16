import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Receipt, CalendarDays, AlertCircle } from 'lucide-react'
import { useFinance } from '../context/FinanceContext.jsx'
import ExpenseTable from '../components/expenses/ExpenseTable.jsx'
import ExpenseModal from '../components/expenses/ExpenseModal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import { formatMonthLabel, getCurrentMonth } from '../utils/format.js'
import { listMonths } from '../utils/analytics.js'

export default function ExpensesPage() {
  const {
    categories,
    expenses,
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

  const monthOptions = useMemo(() => {
    const months = new Set(listMonths(expenses))
    months.add(getCurrentMonth())
    months.add(month)
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [expenses, month])

  const visibleExpenses = useMemo(
    () =>
      month === 'all'
        ? expenses
        : expenses.filter((expense) => expense.referenceMonth === month),
    [expenses, month],
  )

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(expense) {
    setEditing(expense)
    setModalOpen(true)
  }

  function handleSubmit(data) {
    if (editing) updateExpense(editing.id, data)
    else addExpense(data)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={Receipt}
        title="Lançamentos"
        description="Cadastre despesas fixas ou variáveis, defina valores e associe categorias livremente."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate} disabled={categories.length === 0}>
            <Plus size={16} /> Novo lançamento
          </button>
        }
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingBlock label="Carregando lançamentos..." />
      ) : (
        <>
          {categories.length === 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>
                Você ainda não possui categorias. Crie ao menos uma categoria em{' '}
                <Link to="/categorias" className="font-semibold text-amber-100 underline">
                  Categorias
                </Link>{' '}
                para começar a lançar despesas.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface/70 px-3 py-2">
              <CalendarDays size={16} className="text-brand-redBright" />
              <select
                className="bg-transparent text-sm font-medium text-slate-200 outline-none"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                <option value="all" className="bg-brand-surface">
                  Todos os meses
                </option>
                {monthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey} className="bg-brand-surface">
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-slate-400">
              {month === 'all' ? 'Exibindo todos os meses' : `Exibindo ${formatMonthLabel(month)}`}
            </span>
          </div>

          <ExpenseTable
            expenses={visibleExpenses}
            categories={categories}
            getSubcategory={getSubcategory}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            onToggle={toggleExpenseStatus}
            onDuplicate={(id, targetMonth) => duplicateExpense(id, targetMonth)}
          />
        </>
      )}

      <ExpenseModal
        open={modalOpen}
        initial={editing}
        categories={categories}
        defaultMonth={month === 'all' ? getCurrentMonth() : month}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteExpense(pendingDelete.id)}
        title="Excluir lançamento"
        message={`Tem certeza que deseja excluir "${pendingDelete?.description}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}
