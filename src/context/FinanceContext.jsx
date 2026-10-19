import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'
import { addMonths } from '../utils/format.js'

const FinanceContext = createContext(null)

const EXPENSE_COLUMNS =
  'id, description, category_id, subcategory_id, expense_type, value_type, planned_value, actual_value, status, reference_month, notes, created_at, updated_at'

/* ------------------------------- Mapeadores ------------------------------- */

function mapSubcategory(row) {
  return { id: row.id, name: row.name }
}

function mapCategory(row, subcategories) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    tipo: row.tipo === 'receita' ? 'receita' : 'despesa',
    subcategories,
  }
}

function mapExpense(row) {
  return {
    id: row.id,
    description: row.description,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    expenseType: row.expense_type,
    valueType: row.value_type,
    plannedValue: Number(row.planned_value) || 0,
    actualValue: Number(row.actual_value) || 0,
    status: row.status,
    referenceMonth: row.reference_month,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapContaPendente(row) {
  const valor = Number(row.valor) || 0
  const valorPago = Number(row.valor_pago) || 0
  return {
    id: row.id,
    descricao: row.descricao,
    valor,
    valorPago,
    saldo: Math.max(valor - valorPago, 0),
    dataVencimento: row.data_vencimento,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id ?? null,
  }
}

/** Linha da view vw_dashboard_gastos_unificados, já camelizada. */
function mapGastoUnificado(row) {
  const origem = row.origem === 'conta_a_pagar' ? 'conta_a_pagar' : 'lancamento'
  const statusPagamento = row.status_pagamento === 'pago' ? 'pago' : 'pendente'
  return {
    id: row.id,
    descricao: row.descricao ?? '',
    valor: Number(row.valor) || 0,
    dataReferencia: row.data_referencia ?? null,
    statusPagamento,
    origem,
    categoriaNome: row.categoria_nome ?? null,
    categoriaCor: row.categoria_cor ?? null,
  }
}

function normalizeExpense(expense) {
  const valueType = expense.valueType === 'fixo' ? 'fixo' : 'manual'
  const plannedValue = Number(expense.plannedValue) || 0
  const actualValue =
    valueType === 'fixo' ? plannedValue : Number(expense.actualValue ?? expense.plannedValue) || 0

  return {
    description: expense.description,
    categoryId: expense.categoryId || null,
    subcategoryId: expense.subcategoryId || null,
    expenseType: expense.expenseType === 'fixa' ? 'fixa' : 'variavel',
    valueType,
    plannedValue,
    actualValue,
    status: expense.status === 'pago' ? 'pago' : 'pendente',
    referenceMonth: expense.referenceMonth,
    notes: expense.notes ?? '',
  }
}

function toExpenseRecord(expense) {
  const normalized = normalizeExpense(expense)
  return {
    description: normalized.description,
    category_id: normalized.categoryId,
    subcategory_id: normalized.subcategoryId,
    expense_type: normalized.expenseType,
    value_type: normalized.valueType,
    planned_value: normalized.plannedValue,
    actual_value: normalized.actualValue,
    status: normalized.status,
    reference_month: normalized.referenceMonth,
    notes: normalized.notes,
  }
}

function describeError(error) {
  if (!error) return 'Ocorreu um erro inesperado.'
  const message = error.message || String(error)
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('Could not find the table') ||
    message.includes('does not exist')
  ) {
      return 'Tabelas não encontradas no Supabase. Execute supabase/schema.sql, setup_database.sql e as migrações de supabase/migrations no SQL Editor do seu projeto.'
  }
  if (message.includes('Invalid API key') || message.includes('JWT')) {
    return 'Falha de autenticação com o Supabase. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  }
  return message
}

export function FinanceProvider({ children }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [contasPendentes, setContasPendentes] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = useCallback(async () => {
    if (!supabase || !user) {
      setCategories([])
      setExpenses([])
      setContasPendentes([])
      setViewRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const [categoriesResult, subcategoriesResult, expensesResult, contasResult, viewResult] =
        await Promise.all([
          supabase
            .from('categories')
            .select('id, name, color, tipo, created_at')
            .order('created_at', { ascending: true }),
          supabase
            .from('subcategories')
            .select('id, category_id, name, created_at')
            .order('created_at', { ascending: true }),
          supabase
            .from('expenses')
            .select(EXPENSE_COLUMNS)
            .order('created_at', { ascending: false }),
          supabase
            .from('contas_a_pagar')
            .select('id, descricao, valor, valor_pago, data_vencimento, category_id, subcategory_id')
            .in('status', ['Pendente', 'Parcial'])
            .order('data_vencimento', { ascending: true }),
          supabase
            .from('vw_dashboard_gastos_unificados')
            .select(
              'id, descricao, valor, data_referencia, status_pagamento, origem, categoria_nome, categoria_cor',
            )
            .order('data_referencia', { ascending: false }),
        ])

      if (categoriesResult.error) throw categoriesResult.error
      if (subcategoriesResult.error) throw subcategoriesResult.error
      if (expensesResult.error) throw expensesResult.error

      const subsByCategory = new Map()
      subcategoriesResult.data.forEach((row) => {
        const list = subsByCategory.get(row.category_id) ?? []
        list.push(mapSubcategory(row))
        subsByCategory.set(row.category_id, list)
      })

      setCategories(
        categoriesResult.data.map((row) => mapCategory(row, subsByCategory.get(row.id) ?? [])),
      )
      setExpenses(expensesResult.data.map(mapExpense))

      // Melhor esforco: se a tabela contas_a_pagar ainda nao existe no banco,
      // o Dashboard carrega apenas com os lancamentos (sem quebrar a tela).
      if (contasResult.error) {
        console.warn('[FinanceContext] contas_a_pagar indisponiveis:', contasResult.error.message)
        setContasPendentes([])
      } else {
        setContasPendentes((contasResult.data ?? []).map(mapContaPendente))
      }

      // Melhor esforco: se a view nao existe (migracao ainda nao executada),
      // o app continua funcionando e o banner orienta o usuario.
      if (viewResult.error) {
        console.warn(
          '[FinanceContext] vw_dashboard_gastos_unificados indisponivel:',
          viewResult.error.message,
        )
        setViewRows([])
        setError(describeError(viewResult.error))
      } else {
        setViewRows((viewResult.data ?? []).map(mapGastoUnificado))
      }
    } catch (err) {
      console.error('[FinanceContext] loadAll:', err)
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  /* ----------------------------- Categorias ----------------------------- */

  const addCategory = useCallback(async ({ name, color, tipo }) => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        color,
        tipo: tipo === 'receita' ? 'receita' : 'despesa',
      })
      .select('id, name, color, tipo, created_at')
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) => [...prev, mapCategory(data, [])])
  }, [])

  const updateCategory = useCallback(async (categoryId, { name, color, tipo }) => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('categories')
      .update({
        name: name?.trim(),
        color,
        tipo: tipo === 'receita' ? 'receita' : 'despesa',
      })
      .eq('id', categoryId)
      .select('id, name, color, tipo, created_at')
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? { ...category, name: data.name, color: data.color, tipo: data.tipo }
          : category,
      ),
    )
  }, [])

  const deleteCategory = useCallback(async (categoryId) => {
    if (!supabase) return
    const { error: err } = await supabase.from('categories').delete().eq('id', categoryId)
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) => prev.filter((category) => category.id !== categoryId))
    setExpenses((prev) => prev.filter((expense) => expense.categoryId !== categoryId))
  }, [])

  /* ---------------------------- Subcategorias ---------------------------- */

  const addSubcategory = useCallback(async (categoryId, name) => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('subcategories')
      .insert({ category_id: categoryId, name: name.trim() })
      .select('id, category_id, name')
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? { ...category, subcategories: [...category.subcategories, mapSubcategory(data)] }
          : category,
      ),
    )
  }, [])

  const updateSubcategory = useCallback(async (categoryId, subcategoryId, name) => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('subcategories')
      .update({ name: name.trim() })
      .eq('id', subcategoryId)
      .select('id, category_id, name')
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              subcategories: category.subcategories.map((sub) =>
                sub.id === subcategoryId ? { ...sub, name: data.name } : sub,
              ),
            }
          : category,
      ),
    )
  }, [])

  const deleteSubcategory = useCallback(async (categoryId, subcategoryId) => {
    if (!supabase) return
    const { error: err } = await supabase.from('subcategories').delete().eq('id', subcategoryId)
    if (err) {
      setError(describeError(err))
      return
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              subcategories: category.subcategories.filter((sub) => sub.id !== subcategoryId),
            }
          : category,
      ),
    )
    setExpenses((prev) =>
      prev.map((expense) =>
        expense.subcategoryId === subcategoryId ? { ...expense, subcategoryId: null } : expense,
      ),
    )
  }, [])

  /* ------------------------------ Lancamentos ---------------------------- */

  const addExpense = useCallback(async (data) => {
    if (!supabase) return
    const { data: row, error: err } = await supabase
      .from('expenses')
      .insert(toExpenseRecord(data))
      .select(EXPENSE_COLUMNS)
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setExpenses((prev) => [mapExpense(row), ...prev])
  }, [])

  const updateExpense = useCallback(async (expenseId, data) => {
    if (!supabase) return
    const { data: row, error: err } = await supabase
      .from('expenses')
      .update(toExpenseRecord(data))
      .eq('id', expenseId)
      .select(EXPENSE_COLUMNS)
      .single()
    if (err) {
      setError(describeError(err))
      return
    }
    setExpenses((prev) => prev.map((expense) => (expense.id === expenseId ? mapExpense(row) : expense)))
  }, [])

  const deleteExpense = useCallback(async (expenseId) => {
    if (!supabase) return
    const { error: err } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (err) {
      setError(describeError(err))
      return
    }
    setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId))
  }, [])

  const toggleExpenseStatus = useCallback(
    async (expenseId) => {
      if (!supabase) return
      const current = expenses.find((expense) => expense.id === expenseId)
      if (!current) return
      const nextStatus = current.status === 'pago' ? 'pendente' : 'pago'
      const { data: row, error: err } = await supabase
        .from('expenses')
        .update({ status: nextStatus })
        .eq('id', expenseId)
        .select(EXPENSE_COLUMNS)
        .single()
      if (err) {
        setError(describeError(err))
        return
      }
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === expenseId ? mapExpense(row) : expense)),
      )
    },
    [expenses],
  )

  const duplicateExpense = useCallback(
    async (expenseId, targetMonth) => {
      if (!supabase) {
        throw new Error('Supabase não está configurado para duplicar lançamentos.')
      }

      const original = expenses.find((expense) => expense.id === expenseId)
      if (!original) {
        throw new Error('Lançamento original não encontrado para duplicação.')
      }

      const nextMonth =
        typeof targetMonth === 'string' && /^\d{4}-\d{2}$/.test(targetMonth)
          ? targetMonth
          : addMonths(original.referenceMonth, 1)

      const { data: row, error: err } = await supabase
        .from('expenses')
        .insert(
          toExpenseRecord({
            ...original,
            referenceMonth: nextMonth,
            status: 'pendente',
          }),
        )
        .select(EXPENSE_COLUMNS)
        .single()

      if (err) {
        throw new Error(describeError(err))
      }

      const created = mapExpense(row)
      setExpenses((prev) => [created, ...prev])
      return created
    },
    [expenses],
  )

  const clearAll = useCallback(async () => {
    if (!supabase) return
    const expensesResult = await supabase.from('expenses').delete().not('id', 'is', null)
    const categoriesResult = await supabase.from('categories').delete().not('id', 'is', null)
    if (expensesResult.error || categoriesResult.error) {
      setError(describeError(expensesResult.error || categoriesResult.error))
      return
    }
    setExpenses([])
    setCategories([])
  }, [])

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
      contasPendentes,
      viewRows,
      loading,
      error,
      setError,
      refresh: loadAll,
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
      getCategory,
      getSubcategory,
    }),
    [
      categories,
      expenses,
      contasPendentes,
      viewRows,
      loading,
      error,
      loadAll,
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
