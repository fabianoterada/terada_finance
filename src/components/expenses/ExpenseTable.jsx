import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  CopyPlus,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Filter,
} from 'lucide-react'
import clsx from 'clsx'
import { addMonths, formatCurrency, formatMonthLabel, formatMonthShort } from '../../utils/format.js'
import { useToast } from '../common/Toast.jsx'

function StatusToggle({ status, onToggle }) {
  const paid = status === 'pago'
  return (
    <button
      type="button"
      onClick={onToggle}
      title={paid ? 'Marcar como pendente' : 'Marcar como pago'}
      className={clsx(
        'badge border transition',
        paid
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
      )}
    >
      {paid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {paid ? 'Pago' : 'Pendente'}
    </button>
  )
}

export default function ExpenseTable({
  expenses,
  categories,
  getSubcategory,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [duplicatingId, setDuplicatingId] = useState(null)

  const categoryMap = useMemo(() => {
    const map = new Map()
    categories.forEach((category) => map.set(category.id, category))
    return map
  }, [categories])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses.filter((expense) => {
      if (term && !expense.description.toLowerCase().includes(term)) return false
      if (categoryId && expense.categoryId !== categoryId) return false
      if (type && expense.expenseType !== type) return false
      if (status && expense.status !== status) return false
      return true
    })
  }, [expenses, search, categoryId, type, status])

  const totalReal = filtered.reduce((sum, expense) => sum + (Number(expense.actualValue) || 0), 0)
  const isDuplicating = duplicatingId !== null

  function notifyMissingAction(actionLabel) {
    toast.info(`${actionLabel} indisponível no momento. Funcionalidade em desenvolvimento.`)
  }

  function handleToggle(expense) {
    if (typeof onToggle !== 'function') {
      notifyMissingAction('Alterar status')
      return
    }
    onToggle(expense.id)
  }

  function handleEdit(expense) {
    if (typeof onEdit !== 'function') {
      notifyMissingAction('Editar lançamento')
      return
    }
    onEdit(expense)
  }

  function handleDelete(expense) {
    if (typeof onDelete !== 'function') {
      notifyMissingAction('Excluir lançamento')
      return
    }
    onDelete(expense)
  }

  async function handleDuplicate(expense) {
    if (isDuplicating) return
    if (typeof onDuplicate !== 'function') {
      notifyMissingAction('Duplicar para o próximo mês')
      return
    }

    const targetMonth = addMonths(expense.referenceMonth, 1)
    setDuplicatingId(expense.id)
    try {
      await onDuplicate(expense.id, targetMonth)
      toast.success('Lançamento duplicado com sucesso.', {
        description: `${expense.description} · ${formatMonthLabel(targetMonth)}`,
      })
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível duplicar o lançamento. Tente novamente.'
      toast.error(message)
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-brand-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Filter size={16} className="text-brand-redBright" />
          Lançamentos
          <span className="text-slate-500">({filtered.length})</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <div className="relative col-span-2 sm:col-span-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input py-2 pl-9 text-sm"
              placeholder="Buscar descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="input py-2 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Todas categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="input py-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Fixa e variável</option>
            <option value="fixa">Fixa</option>
            <option value="variavel">Variável</option>
          </select>
          <select
            className="input py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Nenhum lançamento encontrado com os filtros atuais.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-right font-semibold">Previsto</th>
                  <th className="px-4 py-3 text-right font-semibold">Real</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => {
                  const category = categoryMap.get(expense.categoryId)
                  const sub = getSubcategory(expense.categoryId, expense.subcategoryId)
                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-brand-border/60 transition hover:bg-brand-elevated/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">{expense.description}</p>
                        <p className="text-xs text-slate-500">
                          {formatMonthShort(expense.referenceMonth)}
                          {sub ? ` · ${sub.name}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-slate-300">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: category?.color ?? '#64748b' }}
                          />
                          {category?.name ?? 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'badge',
                            expense.expenseType === 'fixa'
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'bg-purple-500/15 text-purple-300',
                          )}
                        >
                          {expense.expenseType === 'fixa' ? 'Fixa' : 'Variável'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {formatCurrency(expense.plannedValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                        {formatCurrency(expense.actualValue)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusToggle
                          status={expense.status}
                          onToggle={() => handleToggle(expense)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="Duplicar para o próximo mês"
                            onClick={() => handleDuplicate(expense)}
                            disabled={isDuplicating}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            {duplicatingId === expense.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <CopyPlus size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => handleEdit(expense)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            onClick={() => handleDelete(expense)}
                            className="rounded-lg p-2 text-brand-redBright transition hover:bg-brand-redDark/20"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="divide-y divide-brand-border/60 lg:hidden">
            {filtered.map((expense) => {
              const category = categoryMap.get(expense.categoryId)
              const sub = getSubcategory(expense.categoryId, expense.subcategoryId)
              return (
                <div key={expense.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100">{expense.description}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: category?.color ?? '#64748b' }}
                        />
                        {category?.name ?? 'Sem categoria'}
                        {sub ? ` › ${sub.name}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-white">
                      {formatCurrency(expense.actualValue)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusToggle
                      status={expense.status}
                      onToggle={() => handleToggle(expense)}
                    />
                    <span
                      className={clsx(
                        'badge',
                        expense.expenseType === 'fixa'
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'bg-purple-500/15 text-purple-300',
                      )}
                    >
                      {expense.expenseType === 'fixa' ? 'Fixa' : 'Variável'}
                    </span>
                    <span className="badge bg-brand-elevated text-slate-400">
                      {formatMonthShort(expense.referenceMonth)}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        title="Duplicar para o próximo mês"
                        onClick={() => handleDuplicate(expense)}
                        disabled={isDuplicating}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        aria-label="Duplicar"
                      >
                        {duplicatingId === expense.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CopyPlus size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-brand-elevated hover:text-white"
                        aria-label="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        className="rounded-lg p-2 text-brand-redBright hover:bg-brand-redDark/20"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-brand-border px-4 py-3 text-sm">
            <span className="text-slate-400">Total real (filtrado)</span>
            <span className="font-bold tabular-nums text-white">{formatCurrency(totalReal)}</span>
          </div>
        </>
      )}
    </div>
  )
}
