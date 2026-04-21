"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts"
import { TrendingUp, DollarSign, ArrowDownCircle, Clock, CreditCard, Smartphone } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function shortBrl(cents: number) {
  const v = cents / 100
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`
  return brl(cents)
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-")
  return new Date(Number(y), Number(m) - 1).toLocaleString("pt-BR", { month: "short", year: "2-digit" })
}

const WITHDRAW_LABEL: Record<string, string> = {
  REQUESTED: "Aguardando",
  PROCESSING: "Processando",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
}
const WITHDRAW_COLOR: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  data: {
    totals: {
      gmv: number; fees: number; net: number; count: number
      pixCount: number; pixGmv: number; cardCount: number; cardGmv: number
    }
    monthly: { month: string; gmv: number; fees: number; net: number; count: number }[]
    withdrawals: { status: string; count: number; total: number }[]
    sellers: { id: string; name: string; email: string; gmv: number; fees: number; net: number; sales: number }[]
    pendingWithdrawalsCount: number
    pendingWithdrawalsCents: number
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-gray-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-gray-600">{p.name}: <span className="font-medium text-gray-900">{brl(p.value)}</span></p>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FinanceiroClient({ data }: Props) {
  const { totals, monthly, withdrawals, sellers, pendingWithdrawalsCount, pendingWithdrawalsCents } = data

  const pieData = [
    { name: "PIX", value: totals.pixGmv, count: totals.pixCount, color: "#10b981" },
    { name: "Cartão", value: totals.cardGmv, count: totals.cardCount, color: "#6366f1" },
  ]

  const chartData = monthly.map((m) => ({
    name: monthLabel(m.month),
    GMV: m.gmv,
    "Receita plataforma": m.fees,
    "Repasse vendedores": m.net,
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consolidado de toda a plataforma</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="GMV Total (todas as vendas)"
          value={brl(totals.gmv)}
          sub={`${totals.count} vendas aprovadas`}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Receita da Plataforma (taxas)"
          value={brl(totals.fees)}
          sub={totals.gmv > 0 ? `${((totals.fees / totals.gmv) * 100).toFixed(1)}% do GMV` : "—"}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          label="Repasse aos Vendedores"
          value={brl(totals.net)}
          sub="Líquido após taxas"
          icon={<ArrowDownCircle className="h-5 w-5 text-violet-600" />}
          color="bg-violet-50"
        />
        <StatCard
          label="Saques Aguardando"
          value={brl(pendingWithdrawalsCents)}
          sub={`${pendingWithdrawalsCount} solicitações`}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Monthly bar chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Evolução mensal (últimos 12 meses)</h2>
          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">Nenhum dado disponível</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={10} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => shortBrl(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="GMV" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Receita plataforma" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Repasse vendedores" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment method breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Método de pagamento</h2>
          <div className="flex justify-center">
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={75} cy={75} innerRadius={50} outerRadius={72} dataKey="value" strokeWidth={2}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="mt-3 space-y-3">
            {pieData.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="flex items-center gap-1">
                    {p.name === "PIX"
                      ? <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                      : <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
                    }
                    <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{brl(p.value)}</p>
                  <p className="text-xs text-gray-400">{p.count} venda{p.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Withdrawal status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Saques por status</h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum saque solicitado ainda</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.status} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WITHDRAW_COLOR[w.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {WITHDRAW_LABEL[w.status] ?? w.status}
                    </span>
                    <span className="text-xs text-gray-400">{w.count} saque{w.count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{brl(w.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top sellers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Top vendedores por GMV</h2>
          {sellers.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma venda aprovada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Vendedor</th>
                    <th className="text-right pb-2 font-medium">GMV</th>
                    <th className="text-right pb-2 font-medium">Sua taxa</th>
                    <th className="text-right pb-2 font-medium">Vendas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sellers.map((s, i) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center text-gray-300 font-bold">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate max-w-[120px]">{s.name || "—"}</p>
                            <p className="text-gray-400 truncate max-w-[120px]">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{brl(s.gmv)}</td>
                      <td className="py-2 text-right text-emerald-700 font-medium tabular-nums whitespace-nowrap">{brl(s.fees)}</td>
                      <td className="py-2 text-right text-gray-500 tabular-nums">{s.sales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Breakdown mensal detalhado</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum dado disponível</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Mês</th>
                  <th className="text-right pb-2 font-medium">Vendas</th>
                  <th className="text-right pb-2 font-medium">GMV</th>
                  <th className="text-right pb-2 font-medium">Receita plataforma</th>
                  <th className="text-right pb-2 font-medium">Repasse vendedores</th>
                  <th className="text-right pb-2 font-medium">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...monthly].reverse().map((m) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-700">{monthLabel(m.month)}</td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">{m.count}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">{brl(m.gmv)}</td>
                    <td className="py-2 text-right text-emerald-700 font-medium tabular-nums">{brl(m.fees)}</td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">{brl(m.net)}</td>
                    <td className="py-2 text-right tabular-nums">
                      <span className="text-xs text-emerald-600 font-medium">
                        {m.gmv > 0 ? `${((m.fees / m.gmv) * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="pt-2 text-gray-800">Total (12 meses)</td>
                  <td className="pt-2 text-right text-gray-500 tabular-nums">{monthly.reduce((s, m) => s + m.count, 0)}</td>
                  <td className="pt-2 text-right text-gray-900 tabular-nums">{brl(monthly.reduce((s, m) => s + m.gmv, 0))}</td>
                  <td className="pt-2 text-right text-emerald-700 tabular-nums">{brl(monthly.reduce((s, m) => s + m.fees, 0))}</td>
                  <td className="pt-2 text-right text-gray-500 tabular-nums">{brl(monthly.reduce((s, m) => s + m.net, 0))}</td>
                  <td className="pt-2 text-right">
                    {(() => {
                      const gTotal = monthly.reduce((s, m) => s + m.gmv, 0)
                      const fTotal = monthly.reduce((s, m) => s + m.fees, 0)
                      return <span className="text-xs text-emerald-600 font-medium">{gTotal > 0 ? `${((fTotal / gTotal) * 100).toFixed(1)}%` : "—"}</span>
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
