/** Gera um identificador unico e legivel. */
export function createId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}
