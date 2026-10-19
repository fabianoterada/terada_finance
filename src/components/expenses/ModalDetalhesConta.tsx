import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Barcode, CalendarDays, FileText, QrCode, ScanLine, Tag } from 'lucide-react'
import Modal from '../common/Modal.jsx'
import ErrorBanner from '../common/ErrorBanner.jsx'
import Spinner from '../common/Spinner.jsx'
import { supabase } from '../../lib/supabase.js'
import { BUCKET_COMPROVANTES } from '../../lib/ocr'
import { formatCurrency } from '../../utils/format.js'

export type StatusConta = 'pendente' | 'pago' | 'cancelada'

const SIGNED_URL_VALIDADE_S = 3600

const OPCOES_STATUS: Array<{ valor: StatusConta; rotulo: string }> = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
]

interface CategoriaRef {
  id: string
  name: string
  color: string
}

interface SubcategoriaRef {
  id: string
  name: string
}

interface ContaRow {
  id: string
  descricao: string
  valor: number | string
  data_vencimento: string | null
  data_pagamento: string | null
  status: string
  metodo_pagamento: string | null
  codigo_barras: string | null
  chave_pix: string | null
  tipo_chave_pix: string | null
  documento_url: string | null
  observacoes: string | null
  categoria: CategoriaRef | null
  subcategoria: SubcategoriaRef | null
}

interface ContaDetalhada {
  id: string
  descricao: string
  valor: number
  dataVencimento: string | null
  dataPagamento: string | null
  status: StatusConta
  metodoPagamento: string | null
  codigoBarras: string | null
  chavePix: string | null
  tipoChavePix: string | null
  observacoes: string
  categoria: CategoriaRef | null
  subcategoria: SubcategoriaRef | null
}

interface AnexoRow {
  id: string
  arquivo_path: string
  nome: string
}

interface AnexoComUrl {
  id: string
  nome: string
  url: string
  tipo: 'imagem' | 'pdf' | 'arquivo'
}

export interface ModalDetalhesContaProps {
  contaId: string | null
  onClose: () => void
  onAtualizada?: () => void
}

const SELECT_CONTA =
  '*, categoria:categories!category_id(id, name, color), subcategoria:subcategories!subcategory_id(id, name)'

function normalizarStatus(status: string): StatusConta {
  if (status === 'pago' || status === 'cancelada') return status
  return 'pendente'
}

function normalizarConta(row: ContaRow): ContaDetalhada {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor) || 0,
    dataVencimento: row.data_vencimento,
    dataPagamento: row.data_pagamento,
    status: normalizarStatus(row.status),
    metodoPagamento: row.metodo_pagamento,
    codigoBarras: row.codigo_barras,
    chavePix: row.chave_pix,
    tipoChavePix: row.tipo_chave_pix,
    observacoes: row.observacoes ?? '',
    categoria: row.categoria ?? null,
    subcategoria: row.subcategoria ?? null,
  }
}

function classificarArquivo(path: string): AnexoComUrl['tipo'] {
  const lower = path.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'imagem'
  return 'arquivo'
}

function formatarData(iso: string | null): string {
  if (!iso) return '-'
  const data = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('pt-BR')
}

function mensagemDeErro(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Erro inesperado. Tente novamente.'
}

function LinhaDados({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-200">{children}</dd>
    </div>
  )
}

export default function ModalDetalhesConta({ contaId, onClose, onAtualizada }: ModalDetalhesContaProps) {
  const [conta, setConta] = useState<ContaDetalhada | null>(null)
  const [anexos, setAnexos] = useState<AnexoComUrl[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSalvando, setIsSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (): Promise<void> => {
    if (!contaId) return
    setIsLoading(true)
    setErro('')
    setConta(null)
    setAnexos([])
    try {
      if (!supabase) throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.')

      const { data, error: selectError } = await supabase
        .from('contas_a_pagar')
        .select(SELECT_CONTA)
        .eq('id', contaId)
        .single()
      if (selectError) throw new Error(selectError.message)
      setConta(normalizarConta(data as ContaRow))

      // Anexos: melhor esforço — falha aqui nao impede exibir os dados da conta.
      const { data: linhas, error: anexosError } = await supabase
        .from('contas_anexos')
        .select('*')
        .eq('conta_id', contaId)
        .order('created_at', { ascending: true })
      if (anexosError || !linhas) {
        if (anexosError) console.warn('[ModalDetalhesConta] anexos:', anexosError.message)
        return
      }

      const urls = await Promise.allSettled(
        linhas.map(async (linha: AnexoRow) => {
          const { data: signed, error: signedError } = await supabase!.storage
            .from(BUCKET_COMPROVANTES)
            .createSignedUrl(linha.arquivo_path, SIGNED_URL_VALIDADE_S)
          if (signedError || !signed?.signedUrl) throw new Error(signedError?.message ?? 'Sem URL')
          return {
            id: linha.id,
            nome: linha.nome || linha.arquivo_path.split('/').pop() || 'Anexo',
            url: signed.signedUrl,
            tipo: classificarArquivo(linha.arquivo_path),
          } as AnexoComUrl
        }),
      )

      setAnexos(
        urls
          .filter((resultado): resultado is PromiseFulfilledResult<AnexoComUrl> => resultado.status === 'fulfilled')
          .map((resultado) => resultado.value),
      )
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setIsLoading(false)
    }
  }, [contaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function alterarStatus(novoStatus: StatusConta): Promise<void> {
    if (!supabase || !conta || novoStatus === conta.status || isSalvando) return
    setIsSalvando(true)
    setErro('')
    try {
      const patch: { status: StatusConta; data_pagamento?: string | null } = { status: novoStatus }
      if (novoStatus === 'pago' && !conta.dataPagamento) {
        patch.data_pagamento = new Date().toISOString().slice(0, 10)
      }
      const { data, error: updateError } = await supabase
        .from('contas_a_pagar')
        .update(patch)
        .eq('id', conta.id)
        .select(SELECT_CONTA)
        .single()
      if (updateError) throw new Error(updateError.message)
      setConta(normalizarConta(data as ContaRow))
      onAtualizada?.()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setIsSalvando(false)
    }
  }

  return (
    <Modal
      open={Boolean(contaId)}
      onClose={onClose}
      size="lg"
      title={conta?.descricao || 'Detalhes da conta'}
      subtitle="Confira os dados, anexos e atualize o status de pagamento."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled
            title="Recurso previsto para uma próxima versão"
          >
            <ScanLine size={15} /> Ler Código de Barras (OCR)
          </button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14">
          <Spinner size={24} />
          <p className="text-sm text-slate-400">Carregando detalhes da conta...</p>
        </div>
      ) : erro && !conta ? (
        <ErrorBanner message={erro} onClose={() => setErro('')} />
      ) : conta ? (
        <div className="space-y-5">
          <ErrorBanner message={erro} onClose={() => setErro('')} />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <LinhaDados rotulo="Valor">
              <span className="text-base font-bold tabular-nums text-white">
                {formatCurrency(conta.valor)}
              </span>
            </LinhaDados>
            <LinhaDados rotulo="Vencimento">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} className="text-slate-500" />
                {formatarData(conta.dataVencimento)}
              </span>
            </LinhaDados>
            <LinhaDados rotulo="Pagamento">{formatarData(conta.dataPagamento)}</LinhaDados>
            <LinhaDados rotulo="Categoria">
              {conta.categoria ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: conta.categoria.color }}
                  />
                  {conta.categoria.name}
                </span>
              ) : (
                <span className="text-slate-500">Sem categoria</span>
              )}
            </LinhaDados>
            <LinhaDados rotulo="Subcategoria">
              {conta.subcategoria ? (
                <span className="inline-flex items-center gap-1.5">
                  <Tag size={12} className="text-slate-500" />
                  {conta.subcategoria.name}
                </span>
              ) : (
                <span className="text-slate-500">Sem subcategoria</span>
              )}
            </LinhaDados>
            <LinhaDados rotulo="Forma de pagamento">
              {conta.metodoPagamento ? (
                <span className="uppercase">{conta.metodoPagamento}</span>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </LinhaDados>
            {conta.codigoBarras && (
              <LinhaDados rotulo="Código de barras">
                <span className="inline-flex items-center gap-1.5">
                  <Barcode size={13} className="shrink-0 text-slate-500" />
                  <code className="truncate font-mono text-xs">{conta.codigoBarras}</code>
                </span>
              </LinhaDados>
            )}
            {conta.chavePix && (
              <LinhaDados rotulo={`Chave PIX${conta.tipoChavePix ? ` (${conta.tipoChavePix})` : ''}`}>
                <span className="inline-flex items-center gap-1.5">
                  <QrCode size={13} className="shrink-0 text-slate-500" />
                  <code className="truncate font-mono text-xs">{conta.chavePix}</code>
                </span>
              </LinhaDados>
            )}
            {conta.observacoes && <LinhaDados rotulo="Observações">{conta.observacoes}</LinhaDados>}
          </dl>

          <div>
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-2">
              {OPCOES_STATUS.map((opcao) => {
                const ativo = conta.status === opcao.valor
                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    disabled={isSalvando}
                    onClick={() => void alterarStatus(opcao.valor)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60',
                      ativo
                        ? 'border-brand-red bg-brand-red/10 text-white'
                        : 'border-brand-border bg-brand-elevated/40 text-slate-400 hover:border-brand-red/50',
                    )}
                  >
                    {isSalvando && ativo && <Spinner size={12} />}
                    {opcao.rotulo}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="label">Anexos</span>
            {isLoading ? null : anexos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-brand-border bg-brand-elevated/20 px-3 py-4 text-center text-sm text-slate-500">
                Nenhum anexo enviado para esta conta.
              </p>
            ) : (
              <ul className="space-y-3">
                {anexos.map((anexo) => (
                  <li
                    key={anexo.id}
                    className="rounded-xl border border-brand-border bg-brand-elevated/20 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <FileText size={14} className="shrink-0 text-brand-redBright" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">
                        {anexo.nome}
                      </span>
                      <a
                        href={anexo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand-redBright hover:underline"
                      >
                        Abrir
                      </a>
                    </div>
                    {anexo.tipo === 'imagem' ? (
                      <img
                        src={anexo.url}
                        alt={anexo.nome}
                        className="max-h-80 w-full rounded-lg object-contain"
                      />
                    ) : anexo.tipo === 'pdf' ? (
                      <iframe
                        src={anexo.url}
                        title={anexo.nome}
                        className="h-96 w-full rounded-lg border border-brand-border"
                      />
                    ) : (
                      <a
                        href={anexo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-brand-border px-3 py-2 text-center text-xs text-slate-300 hover:text-white"
                      >
                        Baixar anexo
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
