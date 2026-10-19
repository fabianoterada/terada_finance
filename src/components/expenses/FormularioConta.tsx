import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { ArrowLeftRight, Banknote, CreditCard, FileText, QrCode } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CurrencyInput from '../common/CurrencyInput.jsx'
import ErrorBanner from '../common/ErrorBanner.jsx'
import Spinner from '../common/Spinner.jsx'
import UploadBoleto, { type ArquivoEnviado } from './UploadBoleto'
import type { Conta } from './ListaContas'
import { useFinance } from '../../context/FinanceContext.jsx'
import { supabase } from '../../lib/supabase.js'

type MetodoPagamento = 'pix' | 'boleto' | 'dinheiro' | 'cartao' | 'transferencia'
type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export interface FormularioContaProps {
  onSaved?: (id: string) => void
  onCancel?: () => void
  contaInicial?: Conta | null
}

interface SubcategoriaRef {
  id: string
  name: string
}

interface CategoriaRef {
  id: string
  name: string
  color: string
  tipo?: string
  subcategories: SubcategoriaRef[]
}

interface ContaFormState {
  descricao: string
  valor: number
  dataVencimento: string
  metodoPagamento: MetodoPagamento | ''
  categoriaId: string
  subcategoriaId: string
  chavePix: string
  tipoChavePix: TipoChavePix
  codigoBarras: string
  observacoes: string
}

const METODOS: Array<{ valor: MetodoPagamento; rotulo: string; icon: LucideIcon }> = [
  { valor: 'pix', rotulo: 'PIX', icon: QrCode },
  { valor: 'boleto', rotulo: 'Boleto', icon: FileText },
  { valor: 'dinheiro', rotulo: 'Dinheiro', icon: Banknote },
  { valor: 'cartao', rotulo: 'Cartão', icon: CreditCard },
  { valor: 'transferencia', rotulo: 'Transferência', icon: ArrowLeftRight },
]

const TIPOS_CHAVE_PIX: Array<{ valor: TipoChavePix; rotulo: string }> = [
  { valor: 'cpf', rotulo: 'CPF' },
  { valor: 'cnpj', rotulo: 'CNPJ' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'aleatoria', rotulo: 'Chave aleatória' },
]

function formVazio(): ContaFormState {
  return {
    descricao: '',
    valor: 0,
    dataVencimento: '',
    metodoPagamento: '',
    categoriaId: '',
    subcategoriaId: '',
    chavePix: '',
    tipoChavePix: 'cpf',
    codigoBarras: '',
    observacoes: '',
  }
}

function formDaConta(conta: Conta | null | undefined): ContaFormState {
  if (!conta) return formVazio()
  const metodoValido = METODOS.some((metodo) => metodo.valor === conta.metodo_pagamento)
  const tipoChaveAtual: TipoChavePix =
    conta.tipo_chave_pix && TIPOS_CHAVE_PIX.some((tipo) => tipo.valor === conta.tipo_chave_pix)
      ? (conta.tipo_chave_pix as TipoChavePix)
      : 'cpf'
  return {
    descricao: conta.descricao,
    valor: conta.valor,
    dataVencimento: conta.data_vencimento ?? '',
    metodoPagamento: metodoValido && conta.metodo_pagamento ? conta.metodo_pagamento : '',
    categoriaId: conta.category_id ?? '',
    subcategoriaId: conta.subcategory_id ?? '',
    chavePix: conta.chave_pix ?? '',
    tipoChavePix: tipoChaveAtual,
    codigoBarras: conta.codigo_barras ?? '',
    observacoes: conta.observacoes ?? '',
  }
}

interface MetodoOptionProps {
  ativo: boolean
  icon: LucideIcon
  rotulo: string
  onClick: () => void
}

function MetodoOption({ ativo, icon: Icon, rotulo, onClick }: MetodoOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
        ativo
          ? 'border-brand-red bg-brand-red/10 text-white'
          : 'border-brand-border bg-brand-elevated/40 text-slate-400 hover:border-brand-red/50',
      )}
    >
      <Icon size={16} className={ativo ? 'text-brand-redBright' : ''} />
      {rotulo}
    </button>
  )
}

export default function FormularioConta({ onSaved, onCancel, contaInicial }: FormularioContaProps) {
  const { categories } = useFinance()
  const listaCategorias = useMemo(
    () =>
      (categories as CategoriaRef[]).filter(
        (categoria) => (categoria.tipo ?? 'despesa') === 'despesa',
      ),
    [categories],
  )
  const [form, setForm] = useState<ContaFormState>(() => formDaConta(contaInicial))
  const [arquivo, setArquivo] = useState<ArquivoEnviado | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setForm(formDaConta(contaInicial))
    setArquivo(null)
    setErro('')
  }, [contaInicial])

  const categoriaSelecionada = useMemo(
    () => listaCategorias.find((categoria) => categoria.id === form.categoriaId) ?? null,
    [listaCategorias, form.categoriaId],
  )

  const subcategoriaSelecionada = useMemo(
    () =>
      categoriaSelecionada?.subcategories.find((sub) => sub.id === form.subcategoriaId) ?? null,
    [categoriaSelecionada, form.subcategoriaId],
  )

  function atualizar(patch: Partial<ContaFormState>): void {
    setForm((prev) => ({ ...prev, ...patch }))
    setErro('')
  }

  function handleLinhaDigitavel(linha: string): void {
    setForm((prev) => ({
      ...prev,
      codigoBarras: linha,
      metodoPagamento:
        prev.metodoPagamento === '' || prev.metodoPagamento === 'boleto'
          ? 'boleto'
          : prev.metodoPagamento,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErro('')

    if (!form.descricao.trim()) {
      setErro('Informe uma descrição para a conta.')
      return
    }
    if (!form.valor || form.valor <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (!form.dataVencimento) {
      setErro('Informe a data de vencimento.')
      return
    }
    if (!form.metodoPagamento) {
      setErro('Selecione a forma de pagamento.')
      return
    }
    if (form.metodoPagamento === 'pix' && !form.chavePix.trim()) {
      setErro('Informe a chave PIX.')
      return
    }
    if (!supabase) {
      setErro('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        descricao: form.descricao.trim(),
        valor: form.valor,
        data_vencimento: form.dataVencimento,
        metodo_pagamento: form.metodoPagamento,
        category_id: form.categoriaId || null,
        subcategory_id: form.subcategoriaId || null,
        categoria: categoriaSelecionada?.name ?? null,
        subcategoria: subcategoriaSelecionada?.name ?? null,
        codigo_barras:
          form.metodoPagamento === 'boleto' && form.codigoBarras ? form.codigoBarras : null,
        chave_pix: form.metodoPagamento === 'pix' ? form.chavePix.trim() : null,
        tipo_chave_pix: form.metodoPagamento === 'pix' ? form.tipoChavePix : null,
        documento_url: arquivo?.storagePath ?? contaInicial?.documento_url ?? null,
        observacoes: form.observacoes.trim(),
      }

      let contaId: string

      if (contaInicial) {
        // Edicao: nao altera user_id nem status (status e gerido pelo trigger
        // de baixa por lancamentos vinculados no banco).
        const { error: updateError } = await supabase
          .from('contas_a_pagar')
          .update(payload)
          .eq('id', contaInicial.id)
        if (updateError) throw new Error(updateError.message)
        contaId = contaInicial.id
      } else {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw new Error(userError.message)
        if (!userData.user) throw new Error('Sessão expirada. Faça login novamente.')

        const { data: inserida, error: insertError } = await supabase
          .from('contas_a_pagar')
          .insert({
            user_id: userData.user.id,
            ...payload,
            status: 'Pendente',
          })
          .select('id')
          .single()
        if (insertError) throw new Error(insertError.message)
        contaId = String(inserida.id)
      }

      // Registra o arquivo enviado na tabela de anexos (formato v3 com metadados).
      if (arquivo) {
        const { error: anexoError } = await supabase.from('contas_anexos').insert({
          conta_id: contaId,
          nome_arquivo: arquivo.nomeArquivo,
          tipo_conteudo: arquivo.tipoConteudo,
          tamanho_bytes: arquivo.tamanhoBytes,
          storage_path: arquivo.storagePath,
        })
        if (anexoError) {
          console.warn('[FormularioConta] Falha ao registrar anexo:', anexoError.message)
        }
      }

      onSaved?.(contaId)
      setForm(formVazio())
      setArquivo(null)
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Erro ao salvar a conta.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label" htmlFor="conta-descricao">
          Descrição
        </label>
        <input
          id="conta-descricao"
          className="input"
          placeholder="Ex: Conta de luz, Aluguel, Internet..."
          value={form.descricao}
          autoFocus
          onChange={(event) => atualizar({ descricao: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="conta-valor">
            Valor
          </label>
          <CurrencyInput
            id="conta-valor"
            value={form.valor}
            onChange={(value: number) => atualizar({ valor: value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="conta-vencimento">
            Vencimento
          </label>
          <input
            id="conta-vencimento"
            type="date"
            className="input"
            value={form.dataVencimento}
            onChange={(event) => atualizar({ dataVencimento: event.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="conta-categoria">
            Categoria
          </label>
          <select
            id="conta-categoria"
            className="input"
            value={form.categoriaId}
            onChange={(event) =>
              atualizar({ categoriaId: event.target.value, subcategoriaId: '' })
            }
          >
            <option value="">Sem categoria</option>
            {listaCategorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="conta-subcategoria">
            Subcategoria
          </label>
          <select
            id="conta-subcategoria"
            className="input"
            value={form.subcategoriaId}
            disabled={!categoriaSelecionada || categoriaSelecionada.subcategories.length === 0}
            onChange={(event) => atualizar({ subcategoriaId: event.target.value })}
          >
            <option value="">
              {categoriaSelecionada && categoriaSelecionada.subcategories.length === 0
                ? 'Sem subcategorias'
                : 'Opcional...'}
            </option>
            {categoriaSelecionada?.subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="label">Forma de pagamento</span>
        <div className="flex flex-wrap gap-2">
          {METODOS.map((metodo) => (
            <MetodoOption
              key={metodo.valor}
              ativo={form.metodoPagamento === metodo.valor}
              icon={metodo.icon}
              rotulo={metodo.rotulo}
              onClick={() => atualizar({ metodoPagamento: metodo.valor })}
            />
          ))}
        </div>
      </div>

      {form.metodoPagamento === 'pix' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="conta-chave-pix">
              Chave PIX
            </label>
            <input
              id="conta-chave-pix"
              className="input"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              value={form.chavePix}
              onChange={(event) => atualizar({ chavePix: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="conta-tipo-chave-pix">
              Tipo da chave
            </label>
            <select
              id="conta-tipo-chave-pix"
              className="input"
              value={form.tipoChavePix}
              onChange={(event) =>
                atualizar({ tipoChavePix: event.target.value as TipoChavePix })
              }
            >
              {TIPOS_CHAVE_PIX.map((tipo) => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {form.metodoPagamento === 'boleto' && (
        <div>
          <label className="label" htmlFor="conta-codigo-barras">
            Código de barras / linha digitável (opcional)
          </label>
          <input
            id="conta-codigo-barras"
            className="input"
            placeholder="Preenchido automaticamente pelo upload do boleto"
            value={form.codigoBarras}
            onChange={(event) => atualizar({ codigoBarras: event.target.value })}
          />
        </div>
      )}

      <div>
        <span className="label">Boleto ou comprovante (opcional)</span>
        <UploadBoleto
          onUploadSuccess={(enviado) => {
            setArquivo(enviado)
            setErro('')
          }}
          onLinhaDigitavelEncontrada={handleLinhaDigitavel}
          onError={(mensagem) => setErro(mensagem)}
        />
        {arquivo && (
          <p className="mt-2 truncate text-xs text-emerald-300" title={arquivo.storagePath}>
            Comprovante anexado: {arquivo.nomeArquivo}
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="conta-observacoes">
          Observações (opcional)
        </label>
        <input
          id="conta-observacoes"
          className="input"
          placeholder="Anotações sobre esta conta..."
          value={form.observacoes}
          onChange={(event) => atualizar({ observacoes: event.target.value })}
        />
      </div>

      <ErrorBanner message={erro} onClose={() => setErro('')} />

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={salvando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? (
            <>
              <Spinner size={15} /> Salvando...
            </>
          ) : contaInicial ? (
            'Salvar alterações'
          ) : (
            'Salvar conta'
          )}
        </button>
      </div>
    </form>
  )
}
