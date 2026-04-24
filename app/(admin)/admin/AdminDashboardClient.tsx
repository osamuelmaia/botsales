"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { TrendingUp, DollarSign, Users, Bot, Wallet, ArrowRight, Building2 } from "lucide-react"
import { AdminStatCard } from "@/components/admin/AdminStatCard"
import { AdminRevenueChart } from "@/components/admin/AdminRevenueChart"
import { DateRangePicker } from "@/components/ui/DateRangePicker"
import { fetcher } from "@/lib/fetcher"

function defaultRange() {
  const to   = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  return { from, to }
}

interface Stats {
  gmvPeriodCents:          number
  feesPeriodCents:         number
  totalUsers:              number
  activeUsers:             number
  activeBots:              number
  pendingWithdrawalsCount: number
  pendingWithdrawalsCents: number
  asaasBalanceCents:       number
  asaasAvailableCents:     number
  dailySeries: Array<{ date: string; gmvCents: number; feesCents: number }>
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-4" />
      <div className="h-7 bg-gray-100 rounded w-32 mb-2" />
      <div className="h-2.5 bg-gray-100 rounded w-20" />
    </div>
  )
}

export function AdminDashboardClient() {
  const [range, setRange] = useState(defaultRange)

  const key = `/api/admin/stats?from=${range.from}&to=${range.to}`
  const { data, isLoading } = useSWR<Stats>(key, fetcher, { refreshInterval: 60_000 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas consolidadas da plataforma</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Row 1 — 4 main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            {/* Saldo Asaas — always live, independent of period */}
            <AdminStatCard
              title="Saldo Asaas"
              value={brl(data?.asaasAvailableCents ?? 0)}
              sub={`Disponível · Total: ${brl(data?.asaasBalanceCents ?? 0)}`}
              icon={Building2}
              iconColor="text-emerald-500"
            />
            <AdminStatCard
              title="GMV do período"
              value={brl(data?.gmvPeriodCents ?? 0)}
              sub="Vendas aprovadas no período"
              icon={TrendingUp}
              iconColor="text-gray-500"
            />
            <AdminStatCard
              title="Taxas do período"
              value={brl(data?.feesPeriodCents ?? 0)}
              sub="Receita da plataforma"
              icon={DollarSign}
              iconColor="text-blue-500"
            />
            <AdminStatCard
              title="Saques Pendentes"
              value={String(data?.pendingWithdrawalsCount ?? 0)}
              sub={`Total: ${brl(data?.pendingWithdrawalsCents ?? 0)}`}
              icon={Wallet}
              iconColor={(data?.pendingWithdrawalsCount ?? 0) > 0 ? "text-amber-500" : "text-gray-400"}
              action={
                (data?.pendingWithdrawalsCount ?? 0) > 0 ? (
                  <Link
                    href="/admin/withdrawals"
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Ver fila <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null
              }
            />
          </>
        )}
      </div>

      {/* Row 2 — Usuários e Bots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading && !data ? (
          Array.from({ length: 2 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <AdminStatCard
              title="Usuários Ativos"
              value={String(data?.activeUsers ?? 0)}
              sub={`de ${data?.totalUsers ?? 0} cadastrados`}
              icon={Users}
              iconColor="text-blue-500"
            />
            <AdminStatCard
              title="Bots Ativos"
              value={String(data?.activeBots ?? 0)}
              sub="Respondendo agora"
              icon={Bot}
              iconColor="text-purple-500"
            />
          </>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Volume e Taxas</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vendas aprovadas no período selecionado</p>
          </div>
          <p className="text-xs text-gray-400 italic">
            Nota: saldo Asaas pode diferir das taxas acumuladas por reembolsos e tarifas do gateway.
          </p>
        </div>
        {isLoading && !data ? (
          <div className="h-[220px] animate-pulse bg-gray-50 rounded-lg" />
        ) : (
          <AdminRevenueChart data={data?.dailySeries ?? []} />
        )}
      </div>
    </div>
  )
}
