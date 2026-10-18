import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { maskCurrencyInput, parseCurrency } from '../../utils/format.js'

function toDisplay(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Campo monetario com digitacao fluida no padrao brasileiro (R$).
 * Mantem o valor numerico controlado via onChange(number).
 *
 * @param {object} props
 * @param {number} props.value
 * @param {(value: number) => void} props.onChange
 * @param {string} [props.id]
 * @param {string} [props.placeholder]
 * @param {string} [props.className]
 * @param {boolean} [props.required]
 * @param {boolean} [props.autoFocus]
 */
export default function CurrencyInput({
  value,
  onChange,
  id,
  placeholder = '0,00',
  className,
  required,
  autoFocus,
}) {
  const [display, setDisplay] = useState(() => toDisplay(value))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(toDisplay(value))
    }
  }, [value])

  function handleChange(event) {
    const masked = maskCurrencyInput(event.target.value)
    setDisplay(masked)
    onChange(masked ? parseCurrency(masked) : 0)
  }

  function handleBlur() {
    focusedRef.current = false
    setDisplay(toDisplay(value))
  }

  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
        value={display}
        placeholder={placeholder}
        onFocus={() => {
          focusedRef.current = true
        }}
        onChange={handleChange}
        onBlur={handleBlur}
        className="input pl-10 text-right font-semibold tabular-nums"
      />
    </div>
  )
}
