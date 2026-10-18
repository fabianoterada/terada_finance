import { useState } from 'react'
import { Banknote, Plus, X } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import { useToast } from '../components/common/Toast.jsx'
import FormularioConta from '../components/expenses/FormularioConta'
import ListaContas from '../components/expenses/ListaContas'

export default function ContasAPagarPage() {
  const [formVisivel, setFormVisivel] = useState(false)
  const [recarregarKey, setRecarregarKey] = useState(0)
  const toast = useToast()

  function handleSaved() {
    setFormVisivel(false)
    setRecarregarKey((key) => key + 1)
    toast.success('Conta salva com sucesso.')
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
            onClick={() => setFormVisivel((visible) => !visible)}
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
          <FormularioConta onSaved={handleSaved} onCancel={() => setFormVisivel(false)} />
        </div>
      )}

      <ListaContas recarregarKey={recarregarKey} />
    </div>
  )
}
