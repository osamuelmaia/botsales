"use client"

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts"

interface DayEntry { date: string; gmvCents: number; feesCents: number }

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  )
}

export function AdminRevenueChart({ data }: { data: DayEntry[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Sem dados de vendas nos últimos 30 dias.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    date:     shortDate(d.date),
    "GMV":    d.gmvCents,
    "Taxas":  d.feesCents,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span className="text-gray-600">{value}</span>}
        />
        <Line
          type="monotone" dataKey="GMV"
          stroke="#111827" strokeWidth={2}
          dot={false} activeDot={{ r: 4 }}
        />
        <Line
          type="monotone" dataKey="Taxas"
          stroke="#16a34a" strokeWidth={2}
          dot={false} activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
