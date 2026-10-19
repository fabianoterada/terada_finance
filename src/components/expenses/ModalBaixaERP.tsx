import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CalendarDays, FileText, Plus, Trash2, X } from 'lucide-react'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import CurrencyInput from '../common/CurrencyInput.jsx'
import ErrorBanner from '../common/ErrorBanner.jsx'
import Spinner from '../common/Spinner.jsx'
import { supabase } from '../../lib/supabase.js'
import { BUCKET_COMPROVANTES } from '../../lib/ocr'
import { formatCurrency } from '../../utils/format.js'

type StatusConta = 'Pendente' | 'Parcial' | 'Pago' | 'Cancelada'

const SIGNED_URL_VALIDADE_S = 3600

interface ContaRow {
  id: string
  descricao: string
  valor: number | string
  valor_pago: number | string
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
  category_id: string | null
  subcategory_id: string | null
  metodo_pagamento: string | null
  categoria: string | null
  subcategoria: string | null
  documento_url: string | null
}

interface ContaBaixa {
  id: string
  descricao: string
  valor: number
  valorPago: number
  status: StatusConta
  dataVencimento: string | null
  dataPagamento: string | null
  categoryId: string | null
  subcategoryId: string | null
  metodoPagamento: string | null
  categoria: string | null
  subcategoria: string | null
  documentoUrl: string | null
}

interface AnexoRow {
  id: string
  nome_arquivo: string
  storage_path: string
}

interface AnexoViewer {
  id: string
  nome: string
  url: string
}

interface PagamentoRow {
  id: string
  description: string
  actual_value: number | string
  reference_month: string
  created_at: string
}

interface PagamentoItem {
  id: string
  description: string
  valor: number
  referenceMonth: string
  createdAt: string
}

export interface ModalBaixaERPProps {
  contaId: string | null
  onClose: () => void
  onAtualizada?: () => void
}

const SELECT_CONTA =
  'id, descricao, valor, valor_pago, status, data_vencimento, data_pagamento, category_id, subcategory_id, metodo_pagamento, categoria, subcategoria, documento_url'

const ROTULO_STATUS: Record<StatusConta, string> = {
  Pendente: 'Pendente',
  Parcial: 'Parcial',
  Pago: 'Pago',
  Cancelada: 'Cancelada',
}

const CLASSE_STATUS: Record<StatusConta, string> = {
  Pendente: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  Parcial: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  Pago: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Cancelada: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
}

function normalizarStatus(status: string): StatusConta {
  const valor = status.trim().toLowerCase()
  if (valor === 'pago') return 'Pago'
  if (valor === 'parcial') return 'Parcial'
  if (valor === 'cancelada') return 'Cancelada'
  return 'Pendente'
}

function normalizarConta(row: ContaRow): ContaBaixa {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor) || 0,
    valorPago: Number(row.valor_pago) || 0,
    status: normalizarStatus(row.status),
    dataVencimento: row.data_vencimento,
    dataPagamento: row.data_pagamento,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    metodoPagamento: row.metodo_pagamento,
    categoria: row.categoria ?? null,
    subcategoria: row.subcategoria ?? null,
    documentoUrl: row.documento_url ?? null,
  }
}

function saldoDaConta(conta: ContaBaixa): number {
  return Math.max(conta.valor - conta.valorPago, 0)
}

function hoje(): string {
  const data = new Date()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function formatarData(iso: string | null): string {
  if (!iso) return '-'
  const data = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('pt-BR')
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso
  return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function mensagemDeErro(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Erro inesperado. Tente novamente.'
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-elevated/25 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}

function LinhaResumo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-slate-400">{rotulo}</dt>
      <dd className="text-sm font-semibold text-slate-100">{children}</dd>
    </div>
  )
}

export default function ModalBaixaERP({ contaId, onClose, onAtualizada }: ModalBaixaERPProps) {
  const [conta, setConta] = useState<ContaBaixa | null>(null)
  const [anexos, setAnexos] = useState<AnexoViewer[]>([])
  const [anexoAtivo, setAnexoAtivo] = useState<string | null>(null)
  const [historico, setHistorico] = useState<PagamentoItem[]>([])
  const [valorPagamento, setValorPagamento] = useState(0)
  const [dataPagamento, setDataPagamento] = useState(hoje())
  const [isLoading, setIsLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState('')
  const [pagamentoExcluir, setPagamentoExcluir] = useState<PagamentoItem | null>(null)
  const confirmAbertoRef = useRef(false)

  useEffect(() => {
    confirmAbertoRef.current = pagamentoExcluir !== null
  }, [pagamentoExcluir])

  useEffect(() => {
    if (!contaId) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [contaId])

  useEffect(() => {
    if (!contaId) return undefined
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // Com o dialogo de confirmacao aberto, o Escape fecha apenas ele.
      if (confirmAbertoRef.current) return
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [contaId, onClose])

  const carregar = useCallback(async (): Promise<void> => {
    if (!contaId) return
    setIsLoading(true)
    setErro('')
    setConta(null)
    setAnexos([])
    setAnexoAtivo(null)
    setHistorico([])
    try {
      if (!supabase) throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.')

      const { data, error: selectError } = await supabase
        .from('contas_a_pagar')
        .select(SELECT_CONTA)
        .eq('id', contaId)
        .single()
      if (selectError) throw new Error(selectError.message)

      const contaCarregada = normalizarConta(data as ContaRow)
      setConta(contaCarregada)
      setValorPagamento(saldoDaConta(contaCarregada))

      // Anexos e historico: melhor esforco — falha aqui nao impede exibir a conta.
      const [anexosResult, historicoResult] = await Promise.all([
        supabase
          .from('contas_anexos')
          .select('id, nome_arquivo, storage_path')
          .eq('conta_id', contaId)
          .order('criado_em', { ascending: true }),
        supabase
          .from('expenses')
          .select('id, description, actual_value, reference_month, created_at')
          .eq('conta_origem_id', contaId)
          .order('created_at', { ascending: false }),
      ])

      if (anexosResult.error || !anexosResult.data) {
        if (anexosResult.error) console.warn('[ModalBaixaERP] anexos:', anexosResult.error.message)
      } else {
        // Fallback: contas antigas podem ter documento_url sem linha em contas_anexos.
        const linhas: AnexoRow[] =
          anexosResult.data.length > 0
            ? anexosResult.data
            : contaCarregada.documentoUrl
              ? [
                  {
                    id: 'documento',
                    nome_arquivo:
                      contaCarregada.documentoUrl.split('/').pop() || 'comprovante',
                    storage_path: contaCarregada.documentoUrl,
                  },
                ]
              : []

        const urls = await Promise.allSettled(
          linhas.map(async (linha: AnexoRow) => {
            const { data: signed, error: signedError } = await supabase!.storage
              .from(BUCKET_COMPROVANTES)
              .createSignedUrl(linha.storage_path, SIGNED_URL_VALIDADE_S)
            if (signedError || !signed?.signedUrl) throw new Error(signedError?.message ?? 'Sem URL')
            return {
              id: linha.id,
              nome: linha.nome_arquivo || linha.storage_path.split('/').pop() || 'Anexo',
              url: signed.signedUrl,
            } as AnexoViewer
          }),
        )
        const lista = urls
          .filter(
            (resultado): resultado is PromiseFulfilledResult<AnexoViewer> =>
              resultado.status === 'fulfilled',
          )
          .map((resultado) => resultado.value)
        setAnexos(lista)
        setAnexoAtivo(lista[0]?.id ?? null)
      }

      if (historicoResult.error || !historicoResult.data) {
        if (historicoResult.error) {
          console.warn('[ModalBaixaERP] historico:', historicoResult.error.message)
        }
      } else {
        setHistorico(
          historicoResult.data.map((linha: PagamentoRow) => ({
            id: linha.id,
            description: linha.description,
            valor: Number(linha.actual_value) || 0,
            referenceMonth: linha.reference_month,
            createdAt: linha.created_at,
          })),
        )
      }
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setIsLoading(false)
    }
  }, [contaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function registrarPagamento(): Promise<void> {
    if (!supabase || !conta || salvando) return
    const saldo = saldoDaConta(conta)
    if (conta.status === 'Cancelada') {
      setErro('Conta cancelada. A baixa não está disponível.')
      return
    }
    if (saldo <= 0) {
      setErro('Esta conta já está quitada.')
      return
    }
    if (!valorPagamento || valorPagamento <= 0) {
      setErro('Informe o valor pago.')
      return
    }
    if (valorPagamento > saldo + 0.001) {
      setErro(`O valor não pode ser maior que o saldo em aberto (${formatCurrency(saldo)}).`)
      return
    }
    if (!dataPagamento) {
      setErro('Informe a data do pagamento.')
      return
    }

    setSalvando(true)
    setErro('')
    try {
      // Unico INSERT: o trigger trg_fn_atualiza_conta_parcial recalcula
      // valor_pago/status/data_pagamento da conta. O frontend nunca altera status.
      const { error: insertError } = await supabase.from('expenses').insert({
        description: `Pagamento: ${conta.descricao}`.trim(),
        category_id: conta.categoryId,
        subcategory_id: conta.subcategoryId,
        expense_type: 'variavel',
        value_type: 'manual',
        planned_value: 0,
        actual_value: valorPagamento,
        status: 'pago',
        reference_month: dataPagamento.slice(0, 7),
        notes: `Baixa de conta a pagar${conta.metodoPagamento ? ` (${conta.metodoPagamento})` : ''}`,
        conta_origem_id: conta.id,
      })
      if (insertError) throw new Error(insertError.message)

      await carregar()
      onAtualizada?.()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function excluirPagamento(): Promise<void> {
    if (!supabase || !pagamentoExcluir || removendo) return
    setRemovendo(true)
    setErro('')
    try {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', pagamentoExcluir.id)
      if (deleteError) throw new Error(deleteError.message)
      await carregar()
      onAtualizada?.()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setRemovendo(false)
      setPagamentoExcluir(null)
    }
  }

  if (!contaId) return null

  const quitada = conta ? conta.status === 'Pago' || saldoDaConta(conta) <= 0 : false
  const cancelada = conta?.status === 'Cancelada'
  const percentual =
    conta && conta.valor > 0
      ? Math.min((conta.valorPago / conta.valor) * 100, 100)
      : conta?.status === 'Pago'
        ? 100
        : 0
  const anexoSelecionado = anexos.find((anexo) => anexo.id === anexoAtivo) ?? null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={conta?.descricao || 'Baixa de conta'}
        className="relative z-10 flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface md:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Coluna esquerda (60%): visualizacao do boleto/comprovante */}
        <div className="flex h-[38vh] min-h-0 flex-col bg-black md:h-auto md:w-[60%]">
          {anexos.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
              {anexos.map((anexo) => (
                <button
                  key={anexo.id}
                  type="button"
                  onClick={() => setAnexoAtivo(anexo.id)}
                  className={clsx(
                    'max-w-48 truncate rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                    anexo.id === anexoAtivo
                      ? 'border-brand-red bg-brand-red/20 text-white'
                      : 'border-white/15 bg-white/5 text-slate-400 hover:text-white',
                  )}
                  title={anexo.nome}
                >
                  {anexo.nome}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Spinner size={24} />
                <p className="text-sm text-slate-500">Carregando conta...</p>
              </div>
            ) : anexoSelecionado ? (
              <iframe
                src={anexoSelecionado.url}
                title={anexoSelecionado.nome}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <FileText size={40} className="text-slate-700" />
                <p className="text-sm text-slate-500">
                  Nenhum boleto ou comprovante anexado a esta conta.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita (40%): resumo, novo pagamento e historico */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-brand-border bg-brand-surface md:w-[40%] md:border-l md:border-t-0">
          <header className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-white">
                  {conta?.descricao || 'Baixa de conta'}
                </h2>
                {conta && (
                  <span
                    className={clsx(
                      'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      CLASSE_STATUS[conta.status],
                    )}
                  >
                    {ROTULO_STATUS[conta.status]}
                  </span>
                )}
              </div>
              {conta && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
                  <CalendarDays size={13} className="text-slate-500" />
                  Vence {formatarData(conta.dataVencimento)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-elevated hover:text-white"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <ErrorBanner message={erro} onClose={() => setErro('')} />

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size={22} />
              </div>
            ) : conta ? (
              <>
                <Secao titulo="Resumo">
                  <dl className="space-y-2.5">
                    <LinhaResumo rotulo="Vencimento">{formatarData(conta.dataVencimento)}</LinhaResumo>
                    <LinhaResumo rotulo="Valor total">
                      <span className="text-base font-bold tabular-nums text-white">
                        {formatCurrency(conta.valor)}
                      </span>
                    </LinhaResumo>
                    <LinhaResumo rotulo="Pago até agora">
                      <span className="tabular-nums text-emerald-300">
                        {formatCurrency(conta.valorPago)}
                      </span>
                    </LinhaResumo>
                    <LinhaResumo rotulo="Saldo em aberto">
                      <span
                        className={clsx(
                          'tabular-nums',
                          saldoDaConta(conta) > 0 ? 'text-amber-200' : 'text-emerald-300',
                        )}
                      >
                        {formatCurrency(saldoDaConta(conta))}
                      </span>
                    </LinhaResumo>
                    {conta.categoria && (
                      <LinhaResumo rotulo="Categoria">
                        <span className="normal-case">{conta.categoria}</span>
                      </LinhaResumo>
                    )}
                    {conta.subcategoria && (
                      <LinhaResumo rotulo="Subcategoria">
                        <span className="normal-case">{conta.subcategoria}</span>
                      </LinhaResumo>
                    )}
                  </dl>
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-elevated">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          quitada ? 'bg-emerald-500' : 'bg-amber-400',
                        )}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-right text-xs font-semibold tabular-nums text-slate-500">
                      {percentual.toFixed(0)}% quitado
                    </p>
                  </div>
                </Secao>

                <Secao titulo="Novo pagamento">
                  {cancelada ? (
                    <p className="rounded-xl border border-dashed border-brand-border px-3 py-4 text-center text-sm text-slate-500">
                      Conta cancelada — baixa indisponível.
                    </p>
                  ) : quitada ? (
                    <p className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-4 text-center text-sm text-emerald-300">
                      Conta quitada — nenhum saldo pendente.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="label" htmlFor="baixa-valor">
                          Valor a pagar
                        </label>
                        <CurrencyInput
                          id="baixa-valor"
                          value={valorPagamento}
                          onChange={setValorPagamento}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="baixa-data">
                          Data do pagamento
                        </label>
                        <input
                          id="baixa-data"
                          type="date"
                          className="input"
                          value={dataPagamento}
                          onChange={(event) => setDataPagamento(event.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={salvando || isLoading}
                        onClick={() => void registrarPagamento()}
                      >
                        {salvando ? (
                          <>
                            <Spinner size={15} /> Registrando...
                          </>
                        ) : (
                          <>
                            <Plus size={15} /> Registrar pagamento
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </Secao>

                <Secao titulo={`Histórico de pagamentos (${historico.length})`}>
                  {historico.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-brand-border px-3 py-4 text-center text-sm text-slate-500">
                      Nenhum pagamento registrado para esta conta.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {historico.map((pagamento) => (
                        <li
                          key={pagamento.id}
                          className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-elevated/20 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-200" title={pagamento.description}>
                              {pagamento.description || '(sem descrição)'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatarDataHora(pagamento.createdAt)}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-emerald-300">
                            {formatCurrency(pagamento.valor)}
                          </span>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-brand-redDark/30 hover:text-brand-redBright disabled:opacity-50"
                            aria-label="Excluir pagamento"
                            title="Excluir pagamento"
                            disabled={removendo}
                            onClick={() => setPagamentoExcluir(pagamento)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Secao>
              </>
            ) : erro ? null : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pagamentoExcluir)}
        onClose={() => setPagamentoExcluir(null)}
        onConfirm={() => void excluirPagamento()}
        title="Excluir pagamento"
        message={`Excluir o pagamento de ${formatCurrency(
          pagamentoExcluir?.valor ?? 0,
        )}? O saldo da conta será recalculado automaticamente.`}
        confirmLabel={removendo ? 'Excluindo...' : 'Excluir'}
      />
    </div>,
    document.body,
  )
}
