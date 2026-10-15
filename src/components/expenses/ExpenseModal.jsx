import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Repeat, HandCoins } from 'lucide-react'
import Modal from '../common/Modal.jsx'
import CurrencyInput from '../common/CurrencyInput.jsx'
import { getCurrentMonth } from '../../utils/format.js'

function emptyForm(month) {
  return {
    description: '',
    categoryId: '',
    subcategoryId: '',
    expenseType: 'variavel',
    valueType: 'manual',
    plannedValue: 0,
    actualValue: 0,
    status: 'pendente',
    referenceMonth: month || getCurrentMonth(),
    notes: '',
  }
}

function SegmentedOption({ active, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex flex-1 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
        active
          ? 'border-brand-red bg-brand-red/10 text-white'
          : 'border-brand-border bg-brand-elevated/40 text-slate-400 hover:border-brand-red/50',
      )}
    >
      {Icon && <Icon size={16} className={clsx('mt-0.5', active ? 'text-brand-redBright' : '')} />}
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {description && <span className="block text-[11px] text-slate-500">{description}</span>}
      </span>
    </button>
  )
}

export default function ExpenseModal({ open, onClose, onSubmit, initial, categories, defaultMonth }) {
  const [form, setForm] = useState(() => emptyForm(defaultMonth))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({ ...emptyForm(defaultMonth), ...initial })
    } else {
      setForm(emptyForm(defaultMonth))
    }
    setError('')
  }, [open, initial, defaultMonth])

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId) ?? null,
    [categories, form.categoryId],
  )

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }))
    setError('')
  }

  function handleCategoryChange(categoryId) {
    update({ categoryId, subcategoryId: '' })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.description.trim()) {
      setError('Informe uma descrição para o lançamento.')
      return
    }
    if (!form.categoryId) {
      setError('Selecione uma categoria.')
      return
    }
    if (!form.referenceMonth) {
      setError('Informe o mês de referência.')
      return
    }

    onSubmit({
      ...form,
      description: form.description.trim(),
      subcategoryId: form.subcategoryId || null,
      actualValue: form.valueType === 'fixo' ? form.plannedValue : form.actualValue,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Editar lançamento' : 'Novo lançamento'}
      subtitle="Despesas 100% personalizáveis: defina tipo, valores e mês de referência."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="expense-form" className="btn-primary">
            {initial ? 'Salvar alterações' : 'Adicionar lançamento'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="expense-description">
            Descrição
          </label>
          <input
            id="expense-description"
            className="input"
            placeholder="Ex: Conta de energia, Mercado do mês..."
            value={form.description}
            autoFocus
            onChange={(event) => update({ description: event.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="expense-category">
              Categoria
            </label>
            <select
              id="expense-category"
              className="input"
              value={form.categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
            >
              <option value="">Selecione...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="expense-subcategory">
              Subcategoria
            </label>
            <select
              id="expense-subcategory"
              className="input"
              value={form.subcategoryId ?? ''}
              disabled={!selectedCategory || selectedCategory.subcategories.length === 0}
              onChange={(event) => update({ subcategoryId: event.target.value })}
            >
              <option value="">
                {selectedCategory && selectedCategory.subcategories.length === 0
                  ? 'Sem subcategorias'
                  : 'Opcional...'}
              </option>
              {selectedCategory?.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Tipo de despesa</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SegmentedOption
              active={form.expenseType === 'fixa'}
              icon={Repeat}
              title="Fixa"
              description="Recorrente todos os meses"
              onClick={() => update({ expenseType: 'fixa' })}
            />
            <SegmentedOption
              active={form.expenseType === 'variavel'}
              icon={HandCoins}
              title="Variável"
              description="Muda a cada mês"
              onClick={() => update({ expenseType: 'variavel' })}
            />
          </div>
        </div>

        <div>
          <span className="label">Tipo de valor</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SegmentedOption
              active={form.valueType === 'fixo'}
              icon={Repeat}
              title="Valor padrão"
              description="Mesmo valor previsto e real"
              onClick={() => update({ valueType: 'fixo' })}
            />
            <SegmentedOption
              active={form.valueType === 'manual'}
              icon={HandCoins}
              title="Informar a cada mês"
              description="Preenche o valor real manualmente"
              onClick={() => update({ valueType: 'manual' })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="expense-planned">
              {form.valueType === 'fixo' ? 'Valor' : 'Valor previsto'}
            </label>
            <CurrencyInput
              id="expense-planned"
              value={form.plannedValue}
              onChange={(value) => update({ plannedValue: value })}
            />
          </div>
          {form.valueType === 'manual' && (
            <div>
              <label className="label" htmlFor="expense-actual">
                Valor real
              </label>
              <CurrencyInput
                id="expense-actual"
                value={form.actualValue}
                onChange={(value) => update({ actualValue: value })}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="expense-month">
              Mês de referência
            </label>
            <input
              id="expense-month"
              type="month"
              className="input"
              value={form.referenceMonth}
              onChange={(event) => update({ referenceMonth: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="expense-status">
              Status
            </label>
            <select
              id="expense-status"
              className="input"
              value={form.status}
              onChange={(event) => update({ status: event.target.value })}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="expense-notes">
            Observações (opcional)
          </label>
          <textarea
            id="expense-notes"
            rows={2}
            className="input resize-none"
            placeholder="Anotações sobre este lançamento..."
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-brand-redDark/50 bg-brand-redDark/20 px-3 py-2 text-sm font-medium text-brand-redBright">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
