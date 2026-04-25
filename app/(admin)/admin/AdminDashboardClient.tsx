"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import {
  TrendingUp, DollarSign, Users, Bot, Wallet, ArrowRight,
  Building2, Percent, Ticket, UserCheck, UserPlus,
  RefreshCw, Repeat2,
} from "lucide-react"
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
  avgTicketCents:          number
  salesApprovedCount:      number
  salesTotalCount:         number
  conversionRate:          number
  newUsersPeriod:          number
  totalUsers:              number
  completeUsers:           number
  activeBots:              number
  activeSubscriptions:     number
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-0.5">
      {children}
    </p>
  )
}

export function AdminDashboardClient() {
  const [range, setRange] = useState(defaultRange)

  const key = `/api/admin/stats?from=${range.from}&to=${range.to}`
  const { data, isLoading, mutate, isValidating } = useSWR<Stats>(key, fetcher, { refreshInterval: 60_000 })

  const skeletons = (n: number) => Array.from({ length: n }).map((_, i) => <StatSkeleton key={i} />)

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas consolidadas da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
          </button>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {/* ── Receita ── */}
      <div className="space-y-3">
        <SectionLabel>Receita — período selecionado</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {isLoading && !data ? skeletons(4) : (
            <>
              <AdminStatCard
                title="GMV"
                value={brl(data?.gmvPeriodCents ?? 0)}
                sub="Volume total de vendas aprovadas"
                icon={TrendingUp}
                iconColor="text-gray-600"
              />
              <AdminStatCard
                title="Receita da plataforma"
                value={brl(data?.feesPeriodCents ?? 0)}
                sub="Taxas descontadas das vendas"
                icon={DollarSign}
                iconColor="text-emerald-500"
              />
              <AdminStatCard
                title="Ticket médio"
                value={brl(data?.avgTicketCents ?? 0)}
                sub={`${data?.salesApprovedCount ?? 0} vendas aprovadas`}
                icon={Ticket}
                iconColor="text-blue-500"
              />
              <AdminStatCard
                title="Taxa de conversão"
                value={`${data?.conversionRate ?? 0}%`}
                sub={`${data?.salesApprovedCount ?? 0} de ${data?.salesTotalCount ?? 0} iniciadas`}
                icon={Percent}
                iconColor="text-purple-500"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Usuários ── */}
      <div className="space-y-3">
        <SectionLabel>Usuários</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading && !data ? skeletons(3) : (
            <>
              <AdminStatCard
                title="Novos cadastros"
                value={String(data?.newUsersPeriod ?? 0)}
                sub="Registros no período selecionado"
                icon={UserPlus}
                iconColor="text-blue-500"
              />
              <AdminStatCard
                title="Cadastros completos"
                value={String(data?.completeUsers ?? 0)}
                sub="Com registro finalizado (step 2)"
                icon={UserCheck}
                iconColor="text-emerald-500"
              />
              <AdminStatCard
                title="Total de usuários"
                value={String(data?.totalUsers ?? 0)}
                sub="Acumulado desde o início"
                icon={Users}
                iconColor="text-gray-500"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Plataforma (live) ── */}
      <div className="space-y-3">
        <SectionLabel>Plataforma — tempo real</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {isLoading && !data ? skeletons(4) : (
            <>
              <AdminStatCard
                title="Saldo Asaas"
                value={brl(data?.asaasAvailableCents ?? 0)}
                sub={`Disponível · Total: ${brl(data?.asaasBalanceCents ?? 0)}`}
                icon={Building2}
                iconColor="text-emerald-500"
              />
              <AdminStatCard
                title="Saques pendentes"
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
              <AdminStatCard
                title="Assinaturas ativas"
                value={String(data?.activeSubscriptions ?? 0)}
                sub="Clientes pagando recorrência"
                icon={Repeat2}
                iconColor="text-blue-500"
              />
              <AdminStatCard
                title="Bots ativos"
                value={String(data?.activeBots ?? 0)}
                sub="Respondendo agora"
                icon={Bot}
                iconColor="text-purple-500"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Gráfico ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">GMV e Receita da plataforma</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vendas aprovadas no período · por dia</p>
          </div>
          <p className="text-xs text-gray-400 italic hidden sm:block">
            Saldo Asaas pode diferir por reembolsos e tarifas do gateway
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
