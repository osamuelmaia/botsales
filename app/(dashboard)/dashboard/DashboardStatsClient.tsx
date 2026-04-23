"use client"

import useSWR from "swr"
import { useState, useMemo } from "react"
import { TrendingUp, Wallet, ShoppingCart, DollarSign, Calendar } from "lucide-react"
import { fetcher } from "@/lib/fetcher"

type Period = "today" | "7d" | "month" | "30d" | "custom"

const PRESETS: Array<{ label: string; value: Exclude<Period, "custom"> }> = [
  { label: "Hoje",     value: "today" },
  { label: "7 dias",   value: "7d"    },
  { label: "Este mês", value: "month" },
  { label: "30 dias",  value: "30d"   },
]

function getPresetRange(period: Exclude<Period, "custom">): { from: string; to: string } {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (period) {
    case "today":
      return { from: today, to: today }
    case "7d":
      return { from: new Date(Date.now() - 7  * 86400_000).toISOString().slice(0, 10), to: today }
    case "30d":
      return { from: new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10), to: today }
    case "month": {
      const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0")
      return { from: `${y}-${m}-01`, to: today }
    }
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

function StatCard({ label, value, sub, icon: Icon, loading }: {
  label: string; value: string; sub: string; icon: React.ElementType; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
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
  const [period, setPeriod]       = useState<Period>("month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo,   setCustomTo]   = useState("")

  // useMemo prevents new Date() from re-running on every render → fixes infinite SWR refetch
  const range = useMemo<{ from: string; to: string } | null>(() => {
    if (period === "custom") {
      if (!customFrom || !customTo) return null
      return { from: customFrom, to: customTo }
    }
    return getPresetRange(period)
  }, [period, customFrom, customTo])

  // null key = SWR does not fetch (user hasn't finished picking custom dates)
  const key = range ? `/api/dashboard/stats?from=${range.from}&to=${range.to}` : null
  const { data, isLoading } = useSWR<StatsData>(key, fetcher, { refreshInterval: 30_000 })

  const periodLabel =
    period === "custom"
      ? customFrom && customTo ? `${customFrom} → ${customTo}` : ""
      : PRESETS.find((p) => p.value === period)?.label ?? ""

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400">Período:</span>
        {PRESETS.map((p) => (
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
        <button
          onClick={() => setPeriod("custom")}
          className={`h-7 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
            period === "custom"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          <Calendar className="h-3 w-3" />
          Personalizado
        </button>
      </div>

      {/* Custom date inputs */}
      {period === "custom" && (
        <div className="flex items-center gap-3 flex-wrap bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">De:</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Até:</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          {(!customFrom || !customTo) && (
            <p className="text-xs text-gray-400">Selecione as duas datas para ver os dados.</p>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas"
          value={brl(data?.gmvCents ?? 0)}
          sub={`${data?.salesCount ?? 0} transações · ${periodLabel}`}
          icon={TrendingUp}
          loading={isLoading && !data}
        />
        <StatCard
          label="Receita líquida"
          value={brl(data?.netCents ?? 0)}
          sub="Após taxas da plataforma"
          icon={Wallet}
          loading={isLoading && !data}
        />
        <StatCard
          label="Nº de vendas"
          value={String(data?.salesCount ?? 0)}
          sub={`Em ${periodLabel.toLowerCase()}`}
          icon={ShoppingCart}
          loading={isLoading && !data}
        />
        <StatCard
          label="Taxas pagas"
          value={brl(data?.feesCents ?? 0)}
          sub="Comissão da plataforma"
          icon={DollarSign}
          loading={isLoading && !data}
        />
      </div>
    </div>
  )
}
