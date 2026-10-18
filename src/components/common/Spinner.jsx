import clsx from 'clsx'

/**
 * @param {object} [props]
 * @param {number} [props.size]
 * @param {string} [props.className]
 */
export default function Spinner({ size = 20, className }) {
  return (
    <span
      className={clsx('inline-block animate-spin rounded-full border-2 border-brand-border border-t-brand-redBright', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Carregando"
    />
  )
}
