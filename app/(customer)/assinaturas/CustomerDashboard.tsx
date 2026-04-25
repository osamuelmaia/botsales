"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  LogOut, CreditCard, Clock, CheckCircle, XCircle,
  AlertCircle, PauseCircle, PlayCircle, Loader2,
} from "lucide-react"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = "ACTIVE" | "PAUSED" | "REMARKETING" | "KICKED" | "CANCELLED"

interface Subscription {
  id:               string
  status:           SubStatus
  currentPeriodEnd: string
  createdAt:        string
  product: {
    id: string; name: string; priceInCents: number
    isRecurring: boolean; billingType?: string | null
  }
  bot: { id: string; name: string }
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

const BILLING_SUFFIX: Record<string, string> = {
  WEEKLY: "/semana", MONTHLY: "/mês", QUARTERLY: "/trimestre",
  SEMIANNUAL: "/semestre", ANNUAL: "/ano",
}

// ─── Subscription status config ───────────────────────────────────────────────

const SUB_STATUS: Record<SubStatus, {
  label: string; icon: React.ElementType
  cls: string; bg: string; border: string
}> = {
  ACTIVE:      { label: "Ativa",     icon: CheckCircle,  cls: "text-green-700",  bg: "bg-green-50",  border: "border-green-100" },
  PAUSED:      { label: "Pausada",   icon: PauseCircle,  cls: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  REMARKETING: { label: "Atrasada",  icon: AlertCircle,  cls: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  KICKED:      { label: "Expirada",  icon: XCircle,      cls: "text-red-700",    bg: "bg-red-50",    border: "border-red-100" },
  CANCELLED:   { label: "Cancelada", icon: XCircle,      cls: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-100" },
}

const SALE_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED:   { label: "Aprovado",    cls: "text-green-700 bg-green-100" },
  PENDING:    { label: "Pendente",    cls: "text-yellow-700 bg-yellow-100" },
  REFUSED:    { label: "Recusado",    cls: "text-red-700 bg-red-100" },
  REFUNDED:   { label: "Reembolsado", cls: "text-orange-700 bg-orange-100" },
  CHARGEBACK: { label: "Chargeback",  cls: "text-purple-700 bg-purple-100" },
}

// ─── Cancel dialog (hidden/subtle) ───────────────────────────────────────────

function CancelDialog({ subId, productName, onDone }: {
  subId: string; productName: string; onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/customer/cancel/${subId}`, { method: "POST" })
      if (!res.ok) { toast.error("Erro ao cancelar"); return }
      setOpen(false)
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button className="text-xs text-gray-400 hover:text-red-600 font-medium transition-colors underline underline-offset-2">
          Cancelar assinatura
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <AlertDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
          <AlertDialog.Title className="text-base font-semibold text-gray-900 mb-2">
            Cancelar assinatura
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-500 mb-6 leading-relaxed">
            Tem certeza que deseja cancelar <strong>{productName}</strong>?
            Você perderá o acesso ao conteúdo ao final do período atual.
            <br /><br />
            <span className="text-amber-700 font-medium">Prefere só pausar? Você pode pausar e retomar quando quiser, sem perder o acesso.</span>
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
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Subscription card ────────────────────────────────────────────────────────

function SubscriptionCard({ sub, onUpdate }: {
  sub: Subscription
  onUpdate: (id: string, status: SubStatus) => void
}) {
  const [loading, setLoading] = useState(false)
  const cfg    = SUB_STATUS[sub.status]
  const Icon   = cfg.icon
  const suffix = sub.product.billingType
    ? (BILLING_SUFFIX[sub.product.billingType] ?? "/período")
    : sub.product.isRecurring ? "/mês" : ""

  async function callAction(action: "pause" | "resume") {
    setLoading(true)
    try {
      const res = await fetch(`/api/customer/${action}/${sub.id}`, { method: "POST" })
      if (!res.ok) {
        toast.error(action === "pause" ? "Erro ao pausar" : "Erro ao retomar")
        return
      }
      onUpdate(sub.id, action === "pause" ? "PAUSED" : "ACTIVE")
      toast.success(action === "pause" ? "Assinatura pausada" : "Assinatura retomada!")
    } finally { setLoading(false) }
  }

  return (
    <div className={`bg-white rounded-2xl border p-5 ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-4 w-4 shrink-0 ${cfg.cls}`} />
            <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
          </div>
          <p className="text-base font-semibold text-gray-900 truncate">{sub.product.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub.bot.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">{brl(sub.product.priceInCents)}</p>
          {suffix && <p className="text-[11px] text-gray-400">{suffix}</p>}
        </div>
      </div>

      {/* Next billing / paused info */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Clock className="h-3 w-3 shrink-0" />
        {sub.status === "ACTIVE" && `Próxima cobrança: ${fmtDate(sub.currentPeriodEnd)}`}
        {sub.status === "PAUSED" && "Cobranças pausadas — nenhuma cobrança será gerada"}
        {sub.status === "REMARKETING" && `Vencida em ${fmtDate(sub.currentPeriodEnd)}`}
        {sub.status === "CANCELLED" && `Cancelada em ${fmtDate(sub.createdAt)}`}
        {sub.status === "KICKED" && `Expirada em ${fmtDate(sub.currentPeriodEnd)}`}
      </div>

      {/* Actions */}
      {sub.status === "ACTIVE" && sub.product.isRecurring && (
        <div className="space-y-2">
          {/* Pause — prominent */}
          <button
            onClick={() => callAction("pause")}
            disabled={loading}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <PauseCircle className="h-4 w-4" />}
            {loading ? "Pausando..." : "Pausar assinatura"}
          </button>
          {/* Cancel — hidden/subtle */}
          <div className="text-center">
            <CancelDialog
              subId={sub.id}
              productName={sub.product.name}
              onDone={() => onUpdate(sub.id, "CANCELLED")}
            />
          </div>
        </div>
      )}

      {sub.status === "PAUSED" && (
        <div className="space-y-2">
          {/* Resume — prominent */}
          <button
            onClick={() => callAction("resume")}
            disabled={loading}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <PlayCircle className="h-4 w-4" />}
            {loading ? "Retomando..." : "Retomar assinatura"}
          </button>
          {/* Cancel — subtle */}
          <div className="text-center">
            <CancelDialog
              subId={sub.id}
              productName={sub.product.name}
              onDone={() => onUpdate(sub.id, "CANCELLED")}
            />
          </div>
        </div>
      )}
    </div>
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

  function updateSub(id: string, status: SubStatus) {
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status } : s))
  }

  const activeSubs  = subs.filter((s) => ["ACTIVE", "PAUSED", "REMARKETING"].includes(s.status))
  const historySubs = subs.filter((s) => ["KICKED", "CANCELLED"].includes(s.status))

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

        {/* Active / paused subscriptions */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Minhas assinaturas
            {activeSubs.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({activeSubs.length})</span>
            )}
          </h2>

          {activeSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <CreditCard className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhuma assinatura ativa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSubs.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} onUpdate={updateSub} />
              ))}
            </div>
          )}
        </section>

        {/* History */}
        {historySubs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Histórico</h2>
            <div className="space-y-2">
              {historySubs.map((sub) => {
                const cfg = SUB_STATUS[sub.status]
                const Icon = cfg.icon
                return (
                  <div key={sub.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{sub.product.name}</p>
                      <p className="text-xs text-gray-400">{sub.bot.name}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </div>
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
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
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
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
