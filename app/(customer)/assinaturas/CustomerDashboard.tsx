"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, CreditCard, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import * as AlertDialog from "@radix-ui/react-alert-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  id:               string
  status:           "ACTIVE" | "REMARKETING" | "KICKED" | "CANCELLED"
  currentPeriodEnd: string
  createdAt:        string
  product:          { id: string; name: string; priceInCents: number; isRecurring: boolean }
  bot:              { id: string; name: string }
}

interface Sale {
  id:               string
  status:           string
  paymentMethod:    "PIX" | "CREDIT_CARD"
  grossAmountCents: number
  createdAt:        string
  paidAt:           string | null
  product:          { name: string } | null
}

interface Props {
  data: {
    id:            string
    name:          string
    email:         string
    subscriptions: Subscription[]
    sales:         Sale[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Subscription status ──────────────────────────────────────────────────────

const SUB_STATUS: Record<string, { label: string; icon: React.ElementType; cls: string; bg: string }> = {
  ACTIVE:      { label: "Ativa",      icon: CheckCircle,  cls: "text-green-700",  bg: "bg-green-50 border-green-100" },
  REMARKETING: { label: "Atrasada",   icon: AlertCircle,  cls: "text-yellow-700", bg: "bg-yellow-50 border-yellow-100" },
  KICKED:      { label: "Removida",   icon: XCircle,      cls: "text-red-700",    bg: "bg-red-50 border-red-100" },
  CANCELLED:   { label: "Cancelada",  icon: XCircle,      cls: "text-gray-500",   bg: "bg-gray-50 border-gray-100" },
}

// ─── Sale status ──────────────────────────────────────────────────────────────

const SALE_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED:   { label: "Aprovado",    cls: "text-green-700 bg-green-100" },
  PENDING:    { label: "Pendente",    cls: "text-yellow-700 bg-yellow-100" },
  REFUSED:    { label: "Recusado",    cls: "text-red-700 bg-red-100" },
  REFUNDED:   { label: "Reembolsado", cls: "text-orange-700 bg-orange-100" },
  CHARGEBACK: { label: "Chargeback",  cls: "text-purple-700 bg-purple-100" },
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({ subId, productName, onCancelled }: {
  subId: string; productName: string; onCancelled: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/customer/cancel/${subId}`, { method: "POST" })
      if (res.ok) { setOpen(false); onCancelled() }
    } finally { setLoading(false) }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
          Cancelar assinatura
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <AlertDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
          <AlertDialog.Title className="text-base font-semibold text-gray-900 mb-2">
            Cancelar assinatura
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-500 mb-6">
            Tem certeza que deseja cancelar <strong>{productName}</strong>?
            Você perderá o acesso ao conteúdo ao final do período atual.
          </AlertDialog.Description>
          <div className="flex gap-3">
            <AlertDialog.Cancel className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Voltar
            </AlertDialog.Cancel>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CustomerDashboard({ data }: Props) {
  const router = useRouter()
  const [subs, setSubs] = useState(data.subscriptions)

  async function handleLogout() {
    await fetch("/api/customer/logout", { method: "POST" })
    router.push("/assinaturas/login")
    router.refresh()
  }

  function handleCancelled(subId: string) {
    setSubs((prev) => prev.map((s) => s.id === subId ? { ...s, status: "CANCELLED" as const } : s))
  }

  const activeSubs = subs.filter((s) => s.status === "ACTIVE" || s.status === "REMARKETING")
  const otherSubs  = subs.filter((s) => s.status === "KICKED" || s.status === "CANCELLED")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{data.name[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{data.name}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{data.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Active subscriptions */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Assinaturas ativas
            {activeSubs.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({activeSubs.length})</span>
            )}
          </h2>

          {activeSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <CreditCard className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhuma assinatura ativa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSubs.map((sub) => {
                const cfg = SUB_STATUS[sub.status] ?? SUB_STATUS.ACTIVE
                const Icon = cfg.icon
                return (
                  <div key={sub.id} className={`bg-white rounded-2xl border p-5 ${cfg.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 shrink-0 ${cfg.cls}`} />
                          <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
                        </div>
                        <p className="text-base font-semibold text-gray-900 truncate">{sub.product.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sub.bot.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-gray-900">{brl(sub.product.priceInCents)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {sub.product.isRecurring ? "/ mês" : "único"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sub.status === "CANCELLED"
                          ? `Cancelado em ${fmtDate(sub.createdAt)}`
                          : `Próxima cobrança: ${fmtDate(sub.currentPeriodEnd)}`}
                      </span>
                      {sub.status !== "CANCELLED" && sub.product.isRecurring && (
                        <CancelDialog
                          subId={sub.id}
                          productName={sub.product.name}
                          onCancelled={() => handleCancelled(sub.id)}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Inactive subscriptions */}
        {otherSubs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Histórico de assinaturas</h2>
            <div className="space-y-2">
              {otherSubs.map((sub) => {
                const cfg = SUB_STATUS[sub.status] ?? SUB_STATUS.CANCELLED
                return (
                  <div key={sub.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{sub.product.name}</p>
                      <p className="text-xs text-gray-400">{sub.bot.name}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls} bg-opacity-10`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Payment history */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Extrato de pagamentos
            {data.sales.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({data.sales.length})</span>
            )}
          </h2>

          {data.sales.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Método</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((sale) => {
                    const ss = SALE_STATUS[sale.status] ?? { label: sale.status, cls: "text-gray-600 bg-gray-100" }
                    return (
                      <tr key={sale.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {fmtDateTime(sale.paidAt ?? sale.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 max-w-[140px] truncate">
                          {sale.product?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {sale.paymentMethod === "PIX" ? "PIX" : "Cartão"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ss.cls}`}>
                            {ss.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                          {brl(sale.grossAmountCents)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
