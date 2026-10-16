import { useMemo, useState } from 'react'
import { Plus, Tags, RefreshCw, Trash2 } from 'lucide-react'
import { useFinance } from '../context/FinanceContext.jsx'
import CategoryModal from '../components/categories/CategoryModal.jsx'
import CategoryCard from '../components/categories/CategoryCard.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ErrorBanner from '../components/common/ErrorBanner.jsx'
import LoadingBlock from '../components/common/LoadingBlock.jsx'
import PageHeader from '../components/common/PageHeader.jsx'

export default function CategoriesPage() {
  const {
    categories,
    expenses,
    loading,
    error,
    setError,
    refresh,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    clearAll,
  } = useFinance()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const counts = useMemo(() => {
    const map = new Map()
    expenses.forEach((expense) => {
      map.set(expense.categoryId, (map.get(expense.categoryId) ?? 0) + 1)
    })
    return map
  }, [expenses])

  function openCreate() {
    setEditingCategory(null)
    setModalOpen(true)
  }

  function openEdit(category) {
    setEditingCategory(category)
    setModalOpen(true)
  }

  function handleSubmit(data) {
    if (editingCategory) updateCategory(editingCategory.id, data)
    else addCategory(data)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Tags}
        title="Categorias e Subcategorias"
        description="Crie e organize livremente a estrutura de gastos. Nada é fixo: você controla tudo."
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw size={16} /> Recarregar
            </button>
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Nova categoria
            </button>
          </>
        }
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {loading ? (
        <LoadingBlock />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria cadastrada"
          description="Comece criando categorias como Moradia, Alimentação ou Lazer."
          action={
            <button type="button" className="btn-primary mt-2" onClick={openCreate}>
              <Plus size={16} /> Criar primeira categoria
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              expenseCount={counts.get(category.id) ?? 0}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              onAddSubcategory={addSubcategory}
              onUpdateSubcategory={updateSubcategory}
              onDeleteSubcategory={deleteSubcategory}
            />
          ))}
        </div>
      )}

      <div className="card flex flex-col gap-3 border-brand-redDark/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Zona de gerenciamento de dados</p>
          <p className="text-sm text-slate-400">
            Apague permanentemente todas as categorias, subcategorias e lançamentos da sua conta.
          </p>
        </div>
        <button type="button" className="btn-danger" onClick={() => setConfirmClear(true)}>
          <Trash2 size={16} /> Apagar todos os dados
        </button>
      </div>

      <CategoryModal
        open={modalOpen}
        initial={editingCategory}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteCategory(pendingDelete.id)}
        title="Excluir categoria"
        message={`Ao excluir "${pendingDelete?.name}", todos os lançamentos vinculados a ela também serão removidos. Deseja continuar?`}
        confirmLabel="Excluir categoria"
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Apagar todos os dados"
        message="Isso removerá permanentemente todas as suas categorias, subcategorias e lançamentos no banco de dados. Deseja continuar?"
        confirmLabel="Apagar tudo"
      />
    </div>
  )
}
