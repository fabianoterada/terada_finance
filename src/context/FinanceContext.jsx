import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { createId } from '../utils/id.js'
import { buildSeedData } from './seed.js'

const STORAGE_KEY = 'terada_finance_state_v1'

const FinanceContext = createContext(null)

const DEFAULT_CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
]

function normalizeExpense(expense) {
  const valueType = expense.valueType === 'fixo' ? 'fixo' : 'manual'
  const plannedValue = Number(expense.plannedValue) || 0
  const actualValue =
    valueType === 'fixo'
      ? plannedValue
      : Number(expense.actualValue ?? expense.plannedValue) || 0

  return {
    ...expense,
    valueType,
    plannedValue,
    actualValue,
  }
}

export function FinanceProvider({ children }) {
  const [state, setState] = useLocalStorage(STORAGE_KEY, () => buildSeedData())
  const categories = useMemo(() => state?.categories ?? [], [state])
  const expenses = useMemo(() => state?.expenses ?? [], [state])

  /* ----------------------------- Categorias ----------------------------- */

  const addCategory = useCallback(
    ({ name, color }) =>
      setState((prev) => {
        const category = {
          id: createId('cat'),
          name: name.trim(),
          color: color || DEFAULT_CATEGORY_COLORS[prev.categories.length % DEFAULT_CATEGORY_COLORS.length],
          subcategories: [],
        }
        return { ...prev, categories: [...prev.categories, category] }
      }),
    [setState],
  )

  const updateCategory = useCallback(
    (categoryId, { name, color }) =>
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((category) =>
          category.id === categoryId
            ? { ...category, name: name?.trim() ?? category.name, color: color ?? category.color }
            : category,
        ),
      })),
    [setState],
  )

  /** Remove a categoria e, em cascata, os lancamentos vinculados a ela. */
  const deleteCategory = useCallback(
    (categoryId) =>
      setState((prev) => ({
        ...prev,
        categories: prev.categories.filter((category) => category.id !== categoryId),
        expenses: prev.expenses.filter((expense) => expense.categoryId !== categoryId),
      })),
    [setState],
  )

  /* ---------------------------- Subcategorias ---------------------------- */

  const addSubcategory = useCallback(
    (categoryId, name) =>
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                subcategories: [
                  ...category.subcategories,
                  { id: createId('sub'), name: name.trim() },
                ],
              }
            : category,
        ),
      })),
    [setState],
  )

  const updateSubcategory = useCallback(
    (categoryId, subcategoryId, name) =>
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                subcategories: category.subcategories.map((sub) =>
                  sub.id === subcategoryId ? { ...sub, name: name.trim() } : sub,
                ),
              }
            : category,
        ),
      })),
    [setState],
  )

  /** Remove a subcategoria. Lancamentos vinculados passam a ficar sem subcategoria. */
  const deleteSubcategory = useCallback(
    (categoryId, subcategoryId) =>
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                subcategories: category.subcategories.filter((sub) => sub.id !== subcategoryId),
              }
            : category,
        ),
        expenses: prev.expenses.map((expense) =>
          expense.subcategoryId === subcategoryId
            ? { ...expense, subcategoryId: null }
            : expense,
        ),
      })),
    [setState],
  )

  /* ------------------------------ Lancamentos ---------------------------- */

  const addExpense = useCallback(
    (data) =>
      setState((prev) => {
        const now = new Date().toISOString()
        const expense = normalizeExpense({
          ...data,
          id: createId('exp'),
          createdAt: now,
          updatedAt: now,
        })
        return { ...prev, expenses: [expense, ...prev.expenses] }
      }),
    [setState],
  )

  const updateExpense = useCallback(
    (expenseId, data) =>
      setState((prev) => ({
        ...prev,
        expenses: prev.expenses.map((expense) =>
          expense.id === expenseId
            ? normalizeExpense({ ...expense, ...data, updatedAt: new Date().toISOString() })
            : expense,
        ),
      })),
    [setState],
  )

  const deleteExpense = useCallback(
    (expenseId) =>
      setState((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((expense) => expense.id !== expenseId),
      })),
    [setState],
  )

  const toggleExpenseStatus = useCallback(
    (expenseId) =>
      setState((prev) => ({
        ...prev,
        expenses: prev.expenses.map((expense) =>
          expense.id === expenseId
            ? {
                ...expense,
                status: expense.status === 'pago' ? 'pendente' : 'pago',
                updatedAt: new Date().toISOString(),
              }
            : expense,
        ),
      })),
    [setState],
  )

  /** Duplica um lancamento para outro mes de referencia. */
  const duplicateExpense = useCallback(
    (expenseId, targetMonth) =>
      setState((prev) => {
        const original = prev.expenses.find((expense) => expense.id === expenseId)
        if (!original) return prev
        const now = new Date().toISOString()
        const copy = normalizeExpense({
          ...original,
          id: createId('exp'),
          referenceMonth: targetMonth || original.referenceMonth,
          status: 'pendente',
          createdAt: now,
          updatedAt: now,
        })
        return { ...prev, expenses: [copy, ...prev.expenses] }
      }),
    [setState],
  )

  /* ------------------------- Reset / Limpeza total ------------------------ */

  const clearAll = useCallback(() => {
    setState({ categories: [], expenses: [] })
  }, [setState])

  const reloadExamples = useCallback(() => {
    setState(buildSeedData())
  }, [setState])

  /* ------------------------------- Lookups ------------------------------- */

  const categoryMap = useMemo(() => {
    const map = new Map()
    categories.forEach((category) => map.set(category.id, category))
    return map
  }, [categories])

  const getCategory = useCallback((categoryId) => categoryMap.get(categoryId) ?? null, [categoryMap])

  const getSubcategory = useCallback(
    (categoryId, subcategoryId) => {
      const category = categoryMap.get(categoryId)
      if (!category) return null
      return category.subcategories.find((sub) => sub.id === subcategoryId) ?? null
    },
    [categoryMap],
  )

  const value = useMemo(
    () => ({
      categories,
      expenses,
      addCategory,
      updateCategory,
      deleteCategory,
      addSubcategory,
      updateSubcategory,
      deleteSubcategory,
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpenseStatus,
      duplicateExpense,
      clearAll,
      reloadExamples,
      getCategory,
      getSubcategory,
      DEFAULT_CATEGORY_COLORS,
    }),
    [
      categories,
      expenses,
      addCategory,
      updateCategory,
      deleteCategory,
      addSubcategory,
      updateSubcategory,
      deleteSubcategory,
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpenseStatus,
      duplicateExpense,
      clearAll,
      reloadExamples,
      getCategory,
      getSubcategory,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const context = useContext(FinanceContext)
  if (!context) {
    throw new Error('useFinance deve ser usado dentro de <FinanceProvider>')
  }
  return context
}
