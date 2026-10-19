import { useEffect, useState } from 'react'
import clsx from 'clsx'
import Modal from '../common/Modal.jsx'

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#64748b',
]

export default function CategoryModal({ open, onClose, onSubmit, initial }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [tipo, setTipo] = useState('despesa')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setColor(initial?.color ?? PALETTE[0])
    setTipo(initial?.tipo === 'receita' ? 'receita' : 'despesa')
    setError('')
  }, [open, initial])

  function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Informe um nome para a categoria.')
      return
    }
    onSubmit({ name: name.trim(), color, tipo })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar categoria' : 'Nova categoria'}
      subtitle="Organize seus gastos em categorias personalizadas."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="category-form" className="btn-primary">
            {initial ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="category-name">
            Nome da categoria
          </label>
          <input
            id="category-name"
            className="input"
            value={name}
            autoFocus
            placeholder="Ex: Moradia, Educação, Lazer..."
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
          />
          {error && <p className="mt-1.5 text-xs font-medium text-brand-redBright">{error}</p>}
        </div>

        <div>
          <label className="label" htmlFor="category-tipo">
            Tipo
          </label>
          <select
            id="category-tipo"
            className="input"
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            Apenas categorias de despesa aparecem nos formulários de lançamento e contas a pagar.
          </p>
        </div>

        <div>
          <span className="label">Cor de destaque</span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className={clsx(
                  'h-8 w-8 rounded-full border-2 transition',
                  color === swatch
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: swatch }}
                aria-label={`Selecionar cor ${swatch}`}
              />
            ))}
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-brand-border text-[10px] font-bold text-slate-400 hover:border-brand-red">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="sr-only"
              />
              +
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-elevated/50 p-3">
          <span className="h-9 w-9 rounded-lg" style={{ backgroundColor: color }} />
          <div>
            <p className="text-sm font-semibold text-white">{name.trim() || 'Prévia da categoria'}</p>
            <p className="text-xs text-slate-400">Assim aparecerá nos lançamentos e gráficos.</p>
          </div>
        </div>
      </form>
    </Modal>
  )
}
