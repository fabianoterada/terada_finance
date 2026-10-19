import { useState } from 'react'
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'

export default function CategoryCard({
  category,
  expenseCount,
  onEdit,
  onDelete,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
}) {
  const [newSub, setNewSub] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')

  function handleAddSub(event) {
    event.preventDefault()
    const value = newSub.trim()
    if (!value) return
    onAddSubcategory(category.id, value)
    setNewSub('')
  }

  function startEdit(sub) {
    setEditingId(sub.id)
    setDraft(sub.name)
  }

  function commitEdit() {
    const value = draft.trim()
    if (value && editingId) onUpdateSubcategory(category.id, editingId, value)
    setEditingId(null)
    setDraft('')
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-brand-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: category.color }}
          >
            <Tag size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-bold text-white">{category.name}</p>
              <span
                className={
                  category.tipo === 'receita'
                    ? 'badge bg-emerald-500/15 text-emerald-300'
                    : 'badge bg-brand-redDark/25 text-brand-redBright'
                }
              >
                {category.tipo === 'receita' ? 'Receita' : 'Despesa'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {category.subcategories.length} subcategoria
              {category.subcategories.length === 1 ? '' : 's'} · {expenseCount} lançamento
              {expenseCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-elevated hover:text-white"
            aria-label="Editar categoria"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="rounded-lg p-2 text-brand-redBright transition hover:bg-brand-redDark/20"
            aria-label="Excluir categoria"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {category.subcategories.length === 0 && (
          <p className="text-xs text-slate-500">Nenhuma subcategoria cadastrada.</p>
        )}

        {category.subcategories.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center gap-2 rounded-lg border border-brand-border/70 bg-brand-elevated/40 px-3 py-2"
          >
            {editingId === sub.id ? (
              <>
                <input
                  className="input py-1.5 text-sm"
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitEdit()
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                />
                <button
                  type="button"
                  onClick={commitEdit}
                  className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                  aria-label="Salvar"
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-brand-elevated"
                  aria-label="Cancelar"
                >
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate text-sm text-slate-200">{sub.name}</span>
                <button
                  type="button"
                  onClick={() => startEdit(sub)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:text-white"
                  aria-label="Editar subcategoria"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSubcategory(category.id, sub.id)}
                  className="rounded-md p-1.5 text-slate-500 transition hover:text-brand-redBright"
                  aria-label="Excluir subcategoria"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        <form onSubmit={handleAddSub} className="mt-auto flex gap-2 pt-2">
          <input
            className="input py-2 text-sm"
            placeholder="Nova subcategoria..."
            value={newSub}
            onChange={(event) => setNewSub(event.target.value)}
          />
          <button
            type="submit"
            className="btn-ghost px-3"
            aria-label="Adicionar subcategoria"
            disabled={!newSub.trim()}
          >
            <Plus size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
