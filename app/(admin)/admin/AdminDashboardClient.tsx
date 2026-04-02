"use client"

import useSWR from "swr"
import Link from "next/link"
import { TrendingUp, DollarSign, Users, Bot, Wallet, ArrowRight } from "lucide-react"
import { AdminStatCard } from "@/components/admin/AdminStatCard"
import { AdminRevenueChart } from "@/components/admin/AdminRevenueChart"
import { fetcher } from "@/lib/fetcher"

interface Stats {
  gmvTotalCents:            number
  feesTotalCents:           number
  gmvThisMonthCents:        number
  feesThisMonthCents:       number
  totalUsers:               number
  activeUsers:              number
  activeBots:               number
  pendingWithdrawalsCount:  number
  pendingWithdrawalsCents:  number
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

export function AdminDashboardClient({ initialData }: { initialData?: Stats }) {
  const { data, isLoading } = useSWR<Stats>("/api/admin/stats", fetcher, {
    fallbackData: initialData,
    refreshInterval: 60_000,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas consolidadas da plataforma</p>
      </div>

      {/* Row 1 — 4 main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <AdminStatCard
              title="GMV Total"
              value={brl(data?.gmvTotalCents ?? 0)}
              sub="Desde o início"
              icon={TrendingUp}
              iconColor="text-gray-500"
            />
            <AdminStatCard
              title="Taxas Arrecadadas"
              value={brl(data?.feesTotalCents ?? 0)}
              sub="Receita da plataforma"
              icon={DollarSign}
              iconColor="text-green-500"
            />
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

      {/* Row 2 — Este mês + Saques pendentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading && !data ? (
          Array.from({ length: 2 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <AdminStatCard
              title="GMV Este Mês"
              value={brl(data?.gmvThisMonthCents ?? 0)}
              sub={`Taxas: ${brl(data?.feesThisMonthCents ?? 0)}`}
              icon={TrendingUp}
              iconColor="text-gray-400"
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

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Volume e Taxas</h2>
          <p className="text-xs text-gray-400 mt-0.5">Últimos 30 dias — vendas aprovadas</p>
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
