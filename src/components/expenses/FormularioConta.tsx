import { useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { ArrowLeftRight, Banknote, CreditCard, FileText, QrCode } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CurrencyInput from '../common/CurrencyInput.jsx'
import ErrorBanner from '../common/ErrorBanner.jsx'
import Spinner from '../common/Spinner.jsx'
import UploadBoleto from './UploadBoleto'
import { supabase } from '../../lib/supabase.js'

type MetodoPagamento = 'pix' | 'boleto' | 'dinheiro' | 'cartao' | 'transferencia'
type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
type StatusConta = 'pendente' | 'pago'

export interface FormularioContaProps {
  onSaved?: (id: string) => void
  onCancel?: () => void
}

interface ContaFormState {
  descricao: string
  valor: number
  dataVencimento: string
  dataPagamento: string
  status: StatusConta
  metodoPagamento: MetodoPagamento | ''
  chavePix: string
  tipoChavePix: TipoChavePix
  codigoBarras: string
  documentoUrl: string
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
    dataPagamento: '',
    status: 'pendente',
    metodoPagamento: '',
    chavePix: '',
    tipoChavePix: 'cpf',
    codigoBarras: '',
    documentoUrl: '',
    observacoes: '',
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

export default function FormularioConta({ onSaved, onCancel }: FormularioContaProps) {
  const [form, setForm] = useState<ContaFormState>(formVazio)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

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
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error(userError.message)
      if (!userData.user) throw new Error('Sessão expirada. Faça login novamente.')

      const { data: inserida, error: insertError } = await supabase
        .from('contas_a_pagar')
        .insert({
          user_id: userData.user.id,
          descricao: form.descricao.trim(),
          valor: form.valor,
          data_vencimento: form.dataVencimento,
          data_pagamento: form.dataPagamento || null,
          status: form.status,
          metodo_pagamento: form.metodoPagamento,
          codigo_barras:
            form.metodoPagamento === 'boleto' && form.codigoBarras ? form.codigoBarras : null,
          chave_pix: form.metodoPagamento === 'pix' ? form.chavePix.trim() : null,
          tipo_chave_pix: form.metodoPagamento === 'pix' ? form.tipoChavePix : null,
          documento_url: form.documentoUrl || null,
          observacoes: form.observacoes.trim(),
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)
      onSaved?.(String(inserida.id))
      setForm(formVazio())
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <div>
          <label className="label" htmlFor="conta-pagamento">
            Data de pagamento
          </label>
          <input
            id="conta-pagamento"
            type="date"
            className="input"
            value={form.dataPagamento}
            onChange={(event) => atualizar({ dataPagamento: event.target.value })}
          />
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
          onUploadSuccess={(path) => atualizar({ documentoUrl: path })}
          onLinhaDigitavelEncontrada={handleLinhaDigitavel}
          onError={(mensagem) => setErro(mensagem)}
        />
        {form.documentoUrl && (
          <p className="mt-2 truncate text-xs text-emerald-300" title={form.documentoUrl}>
            Comprovante anexado: {form.documentoUrl}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="conta-status">
            Status
          </label>
          <select
            id="conta-status"
            className="input"
            value={form.status}
            onChange={(event) => atualizar({ status: event.target.value as StatusConta })}
          >
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
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
          ) : (
            'Salvar conta'
          )}
        </button>
      </div>
    </form>
  )
}
