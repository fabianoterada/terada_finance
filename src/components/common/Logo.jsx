import clsx from 'clsx'

export default function Logo({ className, compact = false }) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-red/40 bg-brand-surface shadow-glow">
        <img
          src="/logo_transparente.jpeg"
          alt="Terada Finance"
          className="h-full w-full object-contain p-1"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-base font-extrabold tracking-tight text-white">
            TERADA <span className="text-brand-redBright">FINANCE</span>
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Controle de Despesas
          </p>
        </div>
      )}
    </div>
  )
}
