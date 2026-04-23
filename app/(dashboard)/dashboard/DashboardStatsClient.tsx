"use client"

import useSWR from "swr"
import { useState, useMemo } from "react"
import {
  TrendingUp, Wallet, ShoppingCart, CreditCard,
  RefreshCw, Repeat, Users, Target,
} from "lucide-react"
import { fetcher } from "@/lib/fetcher"
import { DateRangePicker } from "@/components/ui/DateRangePicker"

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

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`
}

interface StatsData {
  gmvCents:          number
  netCents:          number
  feesCents:         number
  salesCount:        number
  cardGmvCents:      number
  cardSalesCount:    number
  pixGmvCents:       number
  pixSalesCount:     number
  renewalGmvCents:   number
  renewalNetCents:   number
  renewalSalesCount: number
  contactsCount:     number
  buyerLeadsCount:   number
  conversionPct:     number
}

function StatCard({
  label, value, sub, icon: Icon, loading, tone = "blue",
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  loading?: boolean
  tone?: "blue" | "emerald" | "amber" | "violet"
}) {
  const toneClasses = {
    blue:    "bg-blue-50    border-blue-100    text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    amber:   "bg-amber-50   border-amber-100   text-amber-600",
    violet:  "bg-violet-50  border-violet-100  text-violet-600",
  }[tone]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          {loading ? (
            <div className="h-7 w-28 bg-gray-100 rounded-md mt-2 animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{value}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${toneClasses}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}

function SplitCard({
  label, primary, secondary, icon: Icon, loading,
}: {
  label: string
  primary:   { label: string; value: string; sub: string }
  secondary: { label: string; value: string; sub: string }
  icon: React.ElementType
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-blue-600" strokeWidth={2} />
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-5 bg-gray-100 rounded animate-pulse" />
          <div className="h-5 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-gray-500">{primary.label}</span>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900 tabular-nums">{primary.value}</p>
              <p className="text-[10px] text-gray-400">{primary.sub}</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">{secondary.label}</span>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900 tabular-nums">{secondary.value}</p>
              <p className="text-[10px] text-gray-400">{secondary.sub}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardStatsClient() {
  const [period, setPeriod]       = useState<Period>("month")
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null)

  const range = useMemo<{ from: string; to: string } | null>(() => {
    if (period === "custom") return customRange
    return getPresetRange(period)
  }, [period, customRange])

  const key = range ? `/api/dashboard/stats?from=${range.from}&to=${range.to}` : null
  const { data, isLoading } = useSWR<StatsData>(key, fetcher, { refreshInterval: 30_000 })

  const periodLabel =
    period === "custom"
      ? customRange ? `${customRange.from} → ${customRange.to}` : "personalizado"
      : PRESETS.find((p) => p.value === period)?.label.toLowerCase() ?? ""

  const loading = isLoading && !data

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400">Período:</span>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {p.label}
          </button>
        ))}
        <DateRangePicker
          value={period === "custom" ? customRange : null}
          onChange={(r) => { setCustomRange(r); setPeriod("custom") }}
          placeholder="Personalizado"
        />
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas"
          value={brl(data?.gmvCents ?? 0)}
          sub={`Volume bruto · ${periodLabel}`}
          icon={TrendingUp}
          tone="blue"
          loading={loading}
        />
        <StatCard
          label="Receita líquida"
          value={brl(data?.netCents ?? 0)}
          sub="Após taxas da plataforma"
          icon={Wallet}
          tone="emerald"
          loading={loading}
        />
        <StatCard
          label="Total de vendas"
          value={String(data?.salesCount ?? 0)}
          sub={`Transações em ${periodLabel}`}
          icon={ShoppingCart}
          tone="blue"
          loading={loading}
        />
        <SplitCard
          label="Cartão × PIX"
          primary={{
            label: "Cartão",
            value: brl(data?.cardGmvCents ?? 0),
            sub: `${data?.cardSalesCount ?? 0} vendas`,
          }}
          secondary={{
            label: "PIX",
            value: brl(data?.pixGmvCents ?? 0),
            sub: `${data?.pixSalesCount ?? 0} vendas`,
          }}
          icon={CreditCard}
          loading={loading}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas por renovação"
          value={brl(data?.renewalGmvCents ?? 0)}
          sub={`${data?.renewalSalesCount ?? 0} renovações · recorrência`}
          icon={Repeat}
          tone="violet"
          loading={loading}
        />
        <StatCard
          label="Receita líquida · renovação"
          value={brl(data?.renewalNetCents ?? 0)}
          sub="Lucro vindo de renovações"
          icon={RefreshCw}
          tone="violet"
          loading={loading}
        />
        <StatCard
          label="Contatos"
          value={String(data?.contactsCount ?? 0)}
          sub={`Leads novos em ${periodLabel}`}
          icon={Users}
          tone="amber"
          loading={loading}
        />
        <StatCard
          label="Taxa de conversão"
          value={pct(data?.conversionPct ?? 0)}
          sub={`${data?.buyerLeadsCount ?? 0} compraram de ${data?.contactsCount ?? 0}`}
          icon={Target}
          tone="emerald"
          loading={loading}
        />
      </div>
    </div>
  )
}
