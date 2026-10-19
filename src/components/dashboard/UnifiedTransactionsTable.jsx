import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  CheckCircle2,
  Clock,
  CopyPlus,
  ExternalLink,
  Loader2,
  Pencil,
  Receipt,
  Search,
  Trash2,
  Filter,
} from 'lucide-react'
import clsx from 'clsx'
import EmptyState from '../common/EmptyState.jsx'
import { formatCurrency } from '../../utils/format.js'

const FALLBACK_COLOR = '#64748b'

function BadgeStatus({ status }) {
  const pago = status === 'pago'
  return (
    <span
      className={clsx(
        'badge border',
        pago
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
          : 'border-amber-500/40 bg-amber-500/15 text-amber-400',
      )}
    >
      {pago ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {pago ? 'Pago' : 'Pendente'}
    </span>
  )
}

function BadgeOrigem({ origem }) {
  const conta = origem === 'conta_a_pagar'
  return (
    <span
      className={clsx(
        'badge',
        conta ? 'bg-sky-500/15 text-sky-200' : 'bg-purple-500/15 text-purple-300',
      )}
    >
      {conta ? <Banknote size={13} /> : <Receipt size={13} />}
      {conta ? 'Conta a pagar' : 'Lançamento'}
    </span>
  )
}

function formatarData(iso) {
  if (!iso) return '-'
  const data = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('pt-BR')
}

export default function UnifiedTransactionsTable({ rows, onEditar, onExcluir, onDuplicar }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [origem, setOrigem] = useState('')
  const [status, setStatus] = useState('')
  const [duplicatingKey, setDuplicatingKey] = useState(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (term && !row.descricao.toLowerCase().includes(term)) return false
      if (origem && row.origem !== origem) return false
      if (status && row.statusPagamento !== status) return false
      return true
    })
  }, [rows, search, origem, status])

  const total = filtered.reduce((sum, row) => sum + row.valor, 0)
  const isDuplicating = duplicatingKey !== null

  async function handleDuplicar(row) {
    if (isDuplicating || typeof onDuplicar !== 'function') return
    const key = `${row.origem}-${row.id}`
    setDuplicatingKey(key)
    try {
      await onDuplicar(row)
    } finally {
      setDuplicatingKey(null)
    }
  }

  function handleAcaoRow(event, action, row) {
    event.stopPropagation()
    action(row)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-brand-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Filter size={16} className="text-brand-redBright" />
          Transações recentes
          <span className="text-slate-500">({filtered.length})</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
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
            value={origem}
            onChange={(event) => setOrigem(event.target.value)}
          >
            <option value="">Todas origens</option>
            <option value="lancamento">Lançamentos</option>
            <option value="conta_a_pagar">Contas a pagar</option>
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
        rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Receipt}
              title="Nenhuma transação no mês"
              description="Lançamentos e contas a pagar do mês selecionado aparecerão aqui."
            />
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhuma transação encontrada com os filtros atuais.
          </div>
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const key = `${row.origem}-${row.id}`
                  const duplicating = duplicatingKey === key
                  const ehConta = row.origem === 'conta_a_pagar'
                  return (
                    <tr
                      key={key}
                      className="border-b border-brand-border/60 transition hover:bg-brand-elevated/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">
                          {row.descricao || '(sem descrição)'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-slate-300">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: row.categoriaCor ?? FALLBACK_COLOR }}
                          />
                          {row.categoriaNome ?? 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <BadgeOrigem origem={row.origem} />
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatarData(row.dataReferencia)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                        {formatCurrency(row.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <BadgeStatus status={row.statusPagamento} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {ehConta ? (
                            <button
                              type="button"
                              title="Ver na tela de Contas a Pagar"
                              onClick={() => navigate('/contas')}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white"
                            >
                              <ExternalLink size={15} />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Duplicar para o próximo mês"
                                onClick={(event) => handleAcaoRow(event, handleDuplicar, row)}
                                disabled={isDuplicating}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                              >
                                {duplicating ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <CopyPlus size={15} />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={(event) => handleAcaoRow(event, onEditar, row)}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={(event) => handleAcaoRow(event, onExcluir, row)}
                                className="rounded-lg p-2 text-brand-redBright transition hover:bg-brand-redDark/20"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
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
            {filtered.map((row) => {
              const key = `${row.origem}-${row.id}`
              const duplicating = duplicatingKey === key
              const ehConta = row.origem === 'conta_a_pagar'
              return (
                <div key={key} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100">
                        {row.descricao || '(sem descrição)'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: row.categoriaCor ?? FALLBACK_COLOR }}
                        />
                        {row.categoriaNome ?? 'Sem categoria'}
                        <span>· {formatarData(row.dataReferencia)}</span>
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-white">
                      {formatCurrency(row.valor)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <BadgeStatus status={row.statusPagamento} />
                    <BadgeOrigem origem={row.origem} />
                    <div className="ml-auto flex gap-1">
                      {ehConta ? (
                        <button
                          type="button"
                          title="Ver na tela de Contas a Pagar"
                          onClick={() => navigate('/contas')}
                          className="rounded-lg p-2 text-slate-400 hover:bg-brand-elevated hover:text-white"
                          aria-label="Ver conta"
                        >
                          <ExternalLink size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            title="Duplicar para o próximo mês"
                            onClick={(event) => handleAcaoRow(event, handleDuplicar, row)}
                            disabled={isDuplicating}
                            className="rounded-lg p-2 text-slate-400 hover:bg-brand-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Duplicar"
                          >
                            {duplicating ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CopyPlus size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => handleAcaoRow(event, onEditar, row)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-brand-elevated hover:text-white"
                            aria-label="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => handleAcaoRow(event, onExcluir, row)}
                            className="rounded-lg p-2 text-brand-redBright hover:bg-brand-redDark/20"
                            aria-label="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-brand-border px-4 py-3 text-sm">
            <span className="text-slate-400">Total (filtrado)</span>
            <span className="font-bold tabular-nums text-white">{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}
