import Spinner from './Spinner.jsx'

export default function LoadingBlock({ label = 'Carregando dados...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brand-border bg-brand-surface/50 py-16 text-slate-400">
      <Spinner size={28} />
      <p className="text-sm">{label}</p>
    </div>
  )
}
