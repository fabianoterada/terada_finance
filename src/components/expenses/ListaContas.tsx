import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Banknote, Barcode, CalendarDays, Check, Copy, CreditCard, FileText, QrCode, Receipt } from 'lucide-react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import EmptyState from '../common/EmptyState.jsx'
import ErrorBanner from '../common/ErrorBanner.jsx'
import LoadingBlock from '../common/LoadingBlock.jsx'
import ModalBaixaERP from './ModalBaixaERP'
import { useFinance } from '../../context/FinanceContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatCurrency } from '../../utils/format.js'

type MetodoPagamento = 'pix' | 'boleto' | 'dinheiro' | 'cartao' | 'transferencia'
type StatusConta = 'Pendente' | 'Parcial' | 'Pago' | 'Cancelada'

interface Conta {
  id: string
  descricao: string
  valor: number
  valor_pago: number
  data_vencimento: string | null
  data_pagamento: string | null
  status: StatusConta
  metodo_pagamento: MetodoPagamento | null
  codigo_barras: string | null
  chave_pix: string | null
  tipo_chave_pix: string | null
  documento_url: string | null
}

export interface ListaContasProps {
  recarregarKey?: number
}

const ROTULOS_METODO: Record<MetodoPagamento, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
}

const ICONES_METODO: Record<MetodoPagamento, LucideIcon> = {
  pix: QrCode,
  boleto: FileText,
  dinheiro: Banknote,
  cartao: CreditCard,
  transferencia: ArrowLeftRight,
}

function normalizarStatus(status: string): StatusConta {
  const valor = status.trim().toLowerCase()
  if (valor === 'pago') return 'Pago'
  if (valor === 'parcial') return 'Parcial'
  if (valor === 'cancelada') return 'Cancelada'
  return 'Pendente'
}

function formatarData(iso: string | null): string {
  if (!iso) return '-'
  const data = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('pt-BR')
}

export default function ListaContas({ recarregarKey = 0 }: ListaContasProps) {
  const { refresh } = useFinance()
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [contaSelecionada, setContaSelecionada] = useState<string | null>(null)
  const montadoRef = useRef(false)
  const timerCopiarRef = useRef(0)

  const carregar = useCallback(async (): Promise<void> => {
    if (!supabase) {
      setErro('Supabase não configurado. Verifique as variáveis de ambiente.')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const { data, error: selectError } = await supabase
        .from('contas_a_pagar')
        .select('*')
        .order('data_vencimento', { ascending: true })
        .order('created_at', { ascending: false })
      if (selectError) throw new Error(selectError.message)
      if (montadoRef.current) {
        setContas(
          ((data as Conta[] | null) ?? []).map((conta) => ({
            ...conta,
            valor: Number(conta.valor) || 0,
            valor_pago: Number(conta.valor_pago) || 0,
            status: normalizarStatus(conta.status),
          })),
        )
      }
    } catch (err) {
      if (montadoRef.current) {
        setErro(err instanceof Error && err.message ? err.message : 'Erro ao carregar as contas.')
      }
    } finally {
      if (montadoRef.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    montadoRef.current = true
    void carregar()
    return () => {
      montadoRef.current = false
      window.clearTimeout(timerCopiarRef.current)
    }
  }, [carregar, recarregarKey])

  function handleContaAtualizada(): void {
    void carregar()
    void (refresh as any)()
  }

  async function copiar(texto: string, idItem: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto)
      if (!montadoRef.current) return
      setCopiado(idItem)
      window.clearTimeout(timerCopiarRef.current)
      timerCopiarRef.current = window.setTimeout(() => setCopiado(null), 2000)
    } catch {
      if (montadoRef.current) {
        setErro('Não foi possível copiar para a área de transferência.')
      }
    }
  }

  if (carregando) return <LoadingBlock label="Carregando contas..." />

  return (
    <div className="space-y-4">
      <ErrorBanner message={erro} onClose={() => setErro('')} />

      {contas.length === 0 && !erro ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma conta cadastrada"
          description="Use o formulário acima para registrar contas com boleto, PIX ou comprovante."
        />
      ) : (
        <ul className="space-y-3">
          {contas.map((conta) => {
            const IconeMetodo = conta.metodo_pagamento ? ICONES_METODO[conta.metodo_pagamento] : FileText
            const rotuloMetodo = conta.metodo_pagamento ? ROTULOS_METODO[conta.metodo_pagamento] : '-'
            const pago = conta.status === 'Pago'
            const parcial = conta.status === 'Parcial'
            const cancelada = conta.status === 'Cancelada'
            const saldo = Math.max(conta.valor - conta.valor_pago, 0)
            return (
              <li
                key={conta.id}
                role="button"
                tabIndex={0}
                aria-label={`Ver detalhes de ${conta.descricao || 'conta'}`}
                onClick={() => setContaSelecionada(conta.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setContaSelecionada(conta.id)
                  }
                }}
                className={clsx(
                  'cursor-pointer rounded-2xl border border-brand-border bg-brand-surface/70 p-4 transition',
                  'hover:border-brand-red/50 hover:bg-brand-elevated/50 focus:outline-none focus:ring-1 focus:ring-brand-red/60',
                  cancelada && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-elevated text-brand-redBright">
                      <IconeMetodo size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white" title={conta.descricao}>
                        {conta.descricao || '(sem descrição)'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 font-semibold',
                            pago
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : parcial
                                ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                                : cancelada
                                  ? 'border-slate-500/40 bg-slate-500/10 text-slate-400'
                                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                          )}
                        >
                          {conta.status}
                        </span>
                        <span className="text-slate-400">{rotuloMetodo}</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <CalendarDays size={12} />
                          Vence {formatarData(conta.data_vencimento)}
                        </span>
                        {pago && conta.data_pagamento && (
                          <span className="text-slate-500">
                            Pago em {formatarData(conta.data_pagamento)}
                          </span>
                        )}
                        {parcial && (
                          <span className="text-sky-300">
                            Pago {formatCurrency(conta.valor_pago)} de {formatCurrency(conta.valor)}
                          </span>
                        )}
                        {conta.documento_url && (
                          <span className="text-emerald-300">Comprovante anexado</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-base font-bold tabular-nums text-white">
                      {formatCurrency(conta.valor)}
                    </span>
                    {parcial && (
                      <span className="block text-xs font-semibold tabular-nums text-amber-200">
                        Saldo: {formatCurrency(saldo)}
                      </span>
                    )}
                  </div>
                </div>

                {(conta.codigo_barras || conta.chave_pix) && (
                  <div
                    className="mt-3 space-y-2 border-t border-brand-border/60 pt-3"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {conta.codigo_barras && (
                      <div className="flex items-center gap-2">
                        <Barcode size={14} className="shrink-0 text-slate-500" />
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                          {conta.codigo_barras}
                        </code>
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => void copiar(conta.codigo_barras ?? '', `barra-${conta.id}`)}
                          title="Copiar código de barras"
                        >
                          {copiado === `barra-${conta.id}` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                    {conta.chave_pix && (
                      <div className="flex items-center gap-2">
                        <QrCode size={14} className="shrink-0 text-slate-500" />
                        <span className="shrink-0 text-xs text-slate-500">
                          {conta.tipo_chave_pix ? conta.tipo_chave_pix.toUpperCase() : 'PIX'}
                        </span>
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                          {conta.chave_pix}
                        </code>
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => void copiar(conta.chave_pix ?? '', `pix-${conta.id}`)}
                          title="Copiar chave PIX"
                        >
                          {copiado === `pix-${conta.id}` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ModalBaixaERP
        contaId={contaSelecionada}
        onClose={() => setContaSelecionada(null)}
        onAtualizada={handleContaAtualizada}
      />
    </div>
  )
}
