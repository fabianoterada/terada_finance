import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import clsx from 'clsx'

const ToastContext = createContext(null)

const TOAST_DURATIONS = {
  success: 4000,
  info: 5000,
  error: 7000,
}

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    container: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    iconClass: 'text-emerald-400',
  },
  error: {
    icon: AlertTriangle,
    container: 'border-brand-redDark/60 bg-brand-redDark/25 text-brand-redBright',
    iconClass: 'text-brand-redBright',
  },
  info: {
    icon: Info,
    container: 'border-brand-border bg-brand-elevated/95 text-slate-200',
    iconClass: 'text-slate-300',
  },
}

function createToastId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (type, message, options = {}) => {
      const id = createToastId()
      const fallbackDuration = TOAST_DURATIONS[type] ?? TOAST_DURATIONS.info
      const duration =
        typeof options.duration === 'number' ? options.duration : fallbackDuration

      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          message: String(message ?? ''),
          description: options.description ? String(options.description) : '',
        },
      ])

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, timer)
      }

      return id
    },
    [dismiss],
  )

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    },
    [],
  )

  const toast = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="region"
        aria-label="Notificações"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-stretch gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((item) => {
          const style = TOAST_STYLES[item.type] ?? TOAST_STYLES.info
          const Icon = style.icon
          return (
            <div
              key={item.id}
              role={item.type === 'error' ? 'alert' : 'status'}
              aria-live={item.type === 'error' ? 'assertive' : 'polite'}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 text-sm shadow-card backdrop-blur animate-scale-in sm:w-96',
                style.container,
              )}
            >
              <Icon size={18} className={clsx('mt-0.5 shrink-0', style.iconClass)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.message}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs opacity-80">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-lg p-1 transition hover:bg-white/10"
                aria-label="Fechar notificação"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  }
  return context
}
