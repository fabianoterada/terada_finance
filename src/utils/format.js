/**
 * Utilitarios de formatacao monetaria (padrao brasileiro) e de mes de referencia.
 */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formata um numero para o padrao R$ X.XXX,XX */
export function formatCurrency(value) {
  const number = Number(value)
  return brl.format(Number.isFinite(number) ? number : 0)
}

/** Formata mantendo o sinal explicito (ex: +R$ 10,00 / -R$ 10,00). */
export function formatSignedCurrency(value) {
  const number = Number(value) || 0
  const prefix = number > 0 ? '+' : number < 0 ? '-' : ''
  return `${prefix}${formatCurrency(Math.abs(number))}`
}

/** Formata percentual com sinal. */
export function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0%'
  const prefix = number > 0 ? '+' : ''
  return `${prefix}${number.toFixed(1).replace('.', ',')}%`
}

/**
 * Converte a digitacao do usuario em um numero.
 * Aceita "1.234,56", "1234.56", "R$ 1.234,56" e retorna 1234.56.
 */
export function parseCurrency(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0

  let clean = String(value).replace(/[^\d.,-]/g, '')
  const hasComma = clean.includes(',')
  const hasDot = clean.includes('.')

  if (hasComma && hasDot) {
    // Formato BR: ponto e separador de milhar, virgula decimal.
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    clean = clean.replace(',', '.')
  }

  const number = Number(clean)
  return Number.isFinite(number) ? number : 0
}

/**
 * Formata os digitos crus de um campo monetario para exibicao enquanto digita.
 * Retorna string vazia quando nao ha digitos.
 */
export function maskCurrencyInput(rawValue) {
  const digits = String(rawValue).replace(/\D/g, '')
  if (!digits) return ''
  const number = Number(digits) / 100
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "2026-10" -> "Outubro/2026" */
export function formatMonthLabel(monthKey) {
  if (!monthKey) return '-'
  const [year, month] = String(monthKey).split('-')
  const index = Number(month) - 1
  if (index < 0 || index > 11) return monthKey
  return `${MONTH_NAMES[index]}/${year}`
}

/** "2026-10" -> "Out/2026" */
export function formatMonthShort(monthKey) {
  if (!monthKey) return '-'
  const [year, month] = String(monthKey).split('-')
  const index = Number(month) - 1
  if (index < 0 || index > 11) return monthKey
  return `${MONTH_NAMES[index].slice(0, 3)}/${year}`
}

/** Retorna o mes atual no formato "YYYY-MM". */
export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Soma (ou subtrai) meses de uma chave "YYYY-MM". */
export function addMonths(monthKey, amount) {
  const [year, month] = String(monthKey).split('-').map(Number)
  const date = new Date(year, (month - 1) + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Mes anterior a uma chave "YYYY-MM". */
export function previousMonth(monthKey) {
  return addMonths(monthKey, -1)
}

/** Lista de meses em um intervalo inclusivo. */
export function monthRange(startKey, endKey) {
  const months = []
  if (!startKey || !endKey) return months
  let current = startKey
  let guard = 0
  while (current <= endKey && guard < 240) {
    months.push(current)
    current = addMonths(current, 1)
    guard += 1
  }
  return months
}
