/** Funcoes de agregacao para dashboard, relatorios e insights. */

export function filterByMonth(expenses, monthKey) {
  return expenses.filter((expense) => expense.referenceMonth === monthKey)
}

export function sumBy(expenses, selector) {
  return expenses.reduce((total, expense) => total + (Number(selector(expense)) || 0), 0)
}

/**
 * Totais de um conjunto de lancamentos.
 * - planned: total previsto
 * - actual: total real (valor efetivo informado)
 * - paid: total real ja pago
 * - pending: total real ainda pendente
 */
export function computeTotals(expenses) {
  const planned = sumBy(expenses, (e) => e.plannedValue)
  const actual = sumBy(expenses, (e) => e.actualValue)
  const paid = sumBy(
    expenses.filter((e) => e.status === 'pago'),
    (e) => e.actualValue,
  )
  const pending = sumBy(
    expenses.filter((e) => e.status === 'pendente'),
    (e) => e.actualValue,
  )
  const paidPlanned = sumBy(
    expenses.filter((e) => e.status === 'pago'),
    (e) => e.plannedValue,
  )

  return {
    planned,
    actual,
    paid,
    pending,
    paidPlanned,
    // Sobra/estouro em relacao ao previsto no mes.
    balance: planned - actual,
    count: expenses.length,
  }
}

/**
 * Agrupa os lancamentos por categoria.
 * Retorna [{ categoryId, name, color, planned, actual, paid, pending, count }]
 * ordenado do maior para o menor valor real.
 */
export function aggregateByCategory(expenses, categories) {
  const map = new Map()

  categories.forEach((category) => {
    map.set(category.id, {
      categoryId: category.id,
      name: category.name,
      color: category.color,
      planned: 0,
      actual: 0,
      paid: 0,
      pending: 0,
      count: 0,
    })
  })

  expenses.forEach((expense) => {
    const entry = map.get(expense.categoryId)
    if (!entry) return
    entry.planned += Number(expense.plannedValue) || 0
    entry.actual += Number(expense.actualValue) || 0
    if (expense.status === 'pago') entry.paid += Number(expense.actualValue) || 0
    else entry.pending += Number(expense.actualValue) || 0
    entry.count += 1
  })

  return Array.from(map.values()).sort((a, b) => b.actual - a.actual)
}

/**
 * Compara o total real por categoria entre dois meses.
 * Retorna [{ categoryId, name, color, previous, current, diff, percent }]
 */
export function compareByCategory(currentExpenses, previousExpenses, categories) {
  const current = aggregateByCategory(currentExpenses, categories)
  const previous = aggregateByCategory(previousExpenses, categories)

  const previousMap = new Map(previous.map((item) => [item.categoryId, item]))

  return current
    .map((item) => {
      const prev = previousMap.get(item.categoryId)?.actual ?? 0
      const diff = item.actual - prev
      const percent = prev > 0 ? (diff / prev) * 100 : item.actual > 0 ? 100 : 0
      return {
        categoryId: item.categoryId,
        name: item.name,
        color: item.color,
        previous: prev,
        current: item.actual,
        diff,
        percent,
      }
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

/** Variacao percentual entre dois totais. */
export function percentChange(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/** Lista de meses de referencia presentes nos lancamentos (ordem decrescente). */
export function listMonths(expenses) {
  const set = new Set(expenses.map((expense) => expense.referenceMonth).filter(Boolean))
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}
