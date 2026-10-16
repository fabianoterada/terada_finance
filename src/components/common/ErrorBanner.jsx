import { AlertTriangle, X } from 'lucide-react'

export default function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-redDark/50 bg-brand-redDark/15 p-4 text-sm text-brand-redBright">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 transition hover:bg-brand-redDark/30"
          aria-label="Fechar aviso"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
