import { useState } from 'react'
import { Banknote, Plus, X } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import { useToast } from '../components/common/Toast.jsx'
import FormularioConta from '../components/expenses/FormularioConta'
import ListaContas from '../components/expenses/ListaContas'

export default function ContasAPagarPage() {
  const [formVisivel, setFormVisivel] = useState(false)
  const [contaEmEdicao, setContaEmEdicao] = useState(null)
  const [recarregarKey, setRecarregarKey] = useState(0)
  const toast = useToast()

  function handleSaved() {
    const editando = Boolean(contaEmEdicao)
    setFormVisivel(false)
    setContaEmEdicao(null)
    setRecarregarKey((key) => key + 1)
    toast.success(editando ? 'Conta atualizada com sucesso.' : 'Conta salva com sucesso.')
  }

  function handleEditar(conta) {
    setContaEmEdicao(conta)
    setFormVisivel(true)
  }

  function handleCancel() {
    setFormVisivel(false)
    setContaEmEdicao(null)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Banknote}
        title="Contas a Pagar"
        description="Cadastre contas com boleto, PIX ou comprovante. O upload lê a linha digitável automaticamente."
        actions={
          <button
            type="button"
            className={formVisivel ? 'btn-ghost' : 'btn-primary'}
            onClick={() => {
              setFormVisivel((visible) => {
                if (visible) setContaEmEdicao(null)
                return !visible
              })
            }}
          >
            {formVisivel ? (
              <>
                <X size={16} /> Fechar formulário
              </>
            ) : (
              <>
                <Plus size={16} /> Nova conta
              </>
            )}
          </button>
        }
      />

      {formVisivel && (
        <div className="card p-5">
          {contaEmEdicao && (
            <p className="mb-4 rounded-xl border border-brand-border bg-brand-elevated/40 px-3 py-2 text-sm text-slate-300">
              Editando <span className="font-semibold text-white">{contaEmEdicao.descricao || '(sem descrição)'}</span>
            </p>
          )}
          <FormularioConta
            contaInicial={contaEmEdicao}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      <ListaContas recarregarKey={recarregarKey} onEditar={handleEditar} />
    </div>
  )
}
