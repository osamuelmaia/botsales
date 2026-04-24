"use client"

import useSWR from "swr"
import { useState } from "react"
import {
  TrendingUp, Wallet, ShoppingCart, CreditCard,
  RefreshCw, Repeat, Users, Target,
} from "lucide-react"
import { fetcher } from "@/lib/fetcher"
import { DateRangePicker } from "@/components/ui/DateRangePicker"

function defaultRange() {
  const to   = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  return { from, to }
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          {loading ? (
            <div className="h-7 w-28 bg-gray-100 rounded-md mt-2 animate-pulse" />
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{primary.label}</p>
                <p className="text-base font-bold text-gray-900 tabular-nums leading-tight truncate mt-0.5">{primary.value}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{secondary.label}</p>
                <p className="text-base font-bold text-gray-900 tabular-nums leading-tight truncate mt-0.5">{secondary.value}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {primary.sub} · {secondary.sub}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-blue-600" strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}

export function DashboardStatsClient({ firstName }: { firstName?: string }) {
  const [range, setRange] = useState(defaultRange)

  const key = `/api/dashboard/stats?from=${range.from}&to=${range.to}`
  const { data, isLoading } = useSWR<StatsData>(key, fetcher, { refreshInterval: 30_000 })

  const loading = isLoading && !data

  return (
    <div className="space-y-4">
      {/* Header — title left, calendar right, same row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {firstName && (
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Olá, {firstName}!</h1>
          )}
          <p className="text-sm text-gray-500 mt-0.5">
            Acompanhe seu faturamento e veja o desempenho do seu bot de vendas.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas"
          value={brl(data?.gmvCents ?? 0)}
          sub="Volume bruto no período"
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
          sub="Transações no período"
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
          sub="Leads novos no período"
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
