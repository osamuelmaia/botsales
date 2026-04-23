"use client"

import useSWR from "swr"
import { useState } from "react"
import { TrendingUp, Wallet, ShoppingCart, DollarSign } from "lucide-react"
import { fetcher } from "@/lib/fetcher"

type Period = "today" | "7d" | "month" | "30d"

const PERIODS: Array<{ label: string; value: Period }> = [
  { label: "Hoje",      value: "today" },
  { label: "7 dias",    value: "7d"    },
  { label: "Este mês",  value: "month" },
  { label: "30 dias",   value: "30d"   },
]

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  switch (period) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: now }
    case "7d":
      return { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), to: now }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
    case "30d":
      return { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: now }
  }
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface StatsData {
  gmvCents:   number
  feesCents:  number
  netCents:   number
  salesCount: number
}

function StatCard({
  label, value, sub, icon: Icon, loading,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          {loading ? (
            <div className="h-7 w-28 bg-gray-100 rounded-md mt-2 animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{value}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-blue-600" strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}

export function DashboardStatsClient() {
  const [period, setPeriod] = useState<Period>("month")
  const { from, to } = getPeriodRange(period)

  const key = `/api/dashboard/stats?from=${from.toISOString()}&to=${to.toISOString()}`
  const { data, isLoading } = useSWR<StatsData>(key, fetcher, { refreshInterval: 30_000 })

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? ""

  return (
    <div className="space-y-3">
      {/* Period chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 mr-1">Período:</span>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas"
          value={brl(data?.gmvCents ?? 0)}
          sub={`${data?.salesCount ?? 0} transações · ${periodLabel}`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          label="Receita líquida"
          value={brl(data?.netCents ?? 0)}
          sub="Após taxas da plataforma"
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          label="Nº de vendas"
          value={String(data?.salesCount ?? 0)}
          sub={`Em ${periodLabel.toLowerCase()}`}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          label="Taxas pagas"
          value={brl(data?.feesCents ?? 0)}
          sub="Comissão da plataforma"
          icon={DollarSign}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
