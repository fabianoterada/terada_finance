import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, PieChart as PieIcon, CalendarClock } from 'lucide-react'
import { formatCurrency, formatMonthShort } from '../../utils/format.js'

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold text-white">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      <p className="flex items-center gap-2 font-semibold text-white">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.payload.color }} />
        {item.name}
      </p>
      <p className="mt-1 text-slate-300">
        <span className="font-semibold text-white">{formatCurrency(item.value)}</span> ·{' '}
        {item.payload.share.toFixed(1).replace('.', ',')}%
      </p>
    </div>
  )
}

export default function AnalyticsCharts({
  comparison,
  distribution,
  previsao = [],
  currentMonth,
  previousMonthKey,
}) {
  const barData = comparison
    .filter((item) => item.current > 0 || item.previous > 0)
    .map((item) => ({
      name: item.name,
      Anterior: Number(item.previous.toFixed(2)),
      Atual: Number(item.current.toFixed(2)),
    }))

  const total = distribution.reduce((sum, item) => sum + item.actual, 0)
  const pieData = distribution
    .filter((item) => item.actual > 0)
    .slice(0, 7)
    .map((item) => ({
      name: item.name,
      value: Number(item.actual.toFixed(2)),
      color: item.color,
      share: total > 0 ? (item.actual / total) * 100 : 0,
    }))

  const maxPrevisao = previsao.reduce((max, item) => Math.max(max, item.valor), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="card p-5 xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-redBright" />
            <div>
              <h3 className="font-bold text-white">Comparativo Mensal por Categoria</h3>
              <p className="text-xs text-slate-400">
                {formatMonthShort(previousMonthKey)} × {formatMonthShort(currentMonth)}
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            {barData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Sem dados para comparar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232f42" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#232f42' }}
                    tickLine={false}
                    interval={0}
                    angle={-16}
                    textAnchor="end"
                    height={58}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                  <Bar dataKey="Anterior" fill="#475569" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="Atual" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <PieIcon size={18} className="text-brand-redBright" />
            <div>
              <h3 className="font-bold text-white">Top Categorias</h3>
              <p className="text-xs text-slate-400">Distribuição real de {formatMonthShort(currentMonth)}</p>
            </div>
          </div>
          <div className="h-72 w-full">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Nenhuma despesa lançada no mês.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="#0f172a"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {previsao.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={18} className="text-brand-redBright" />
            <div>
              <h3 className="font-bold text-white">Previsão de Despesas / A Pagar</h3>
              <p className="text-xs text-slate-400">
                Contas pendentes com vencimento em {formatMonthShort(currentMonth)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {previsao.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{item.name}</span>
                  <span className="tabular-nums text-slate-400">{formatCurrency(item.valor)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-red to-brand-redBright transition-all"
                    style={{
                      width: maxPrevisao > 0 ? `${Math.min(100, (item.valor / maxPrevisao) * 100)}%` : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
