"use client"

import useSWR from "swr"
import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Loader2, RefreshCw, Clock, AlertCircle, ChevronDown } from "lucide-react"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string; bankCode: string; agency: string; account: string
  accountType: "CHECKING" | "SAVINGS"; holderName: string; document: string
  pixKey: string | null; isDefault: boolean
}

interface WithdrawalItem {
  id: string
  amountCents: number
  status: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED"
  adminNote: string | null
  requestedAt: string
  reviewedAt: string | null
  processedAt: string | null
  user: { id: string; name: string; email: string }
  bankAccount: BankAccount
}

interface PageData { withdrawals: WithdrawalItem[]; total: number; pages: number; page: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const STATUS_FILTER_OPTIONS = [
  { value: "REQUESTED",  label: "Aguardando" },
  { value: "PROCESSING", label: "Processando" },
  { value: "COMPLETED",  label: "Concluídos" },
  { value: "FAILED",     label: "Recusados" },
  { value: "ALL",        label: "Todos" },
]

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("")
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Recusar saque</h3>
        <p className="text-sm text-gray-500 mb-4">Informe o motivo da recusa. O usuário será notificado.</p>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Ex: Dados bancários incorretos, CPF divergente..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => { if (note.trim()) { onConfirm(note.trim()) } else { toast.error("Informe o motivo") } }}
            className="flex-1 h-9 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-700 transition-colors">
            Confirmar recusa
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function WithdrawalRow({ item, onAction }: { item: WithdrawalItem; onAction: () => void }) {
  const [acting, setActing] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function approve() {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/withdrawals/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao aprovar"); return }
      toast.success("Saque aprovado — em processamento")
      onAction()
    } finally { setActing(false) }
  }

  async function reject(note: string) {
    setShowReject(false)
    setActing(true)
    try {
      const res = await fetch(`/api/admin/withdrawals/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", adminNote: note }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao recusar"); return }
      toast.success("Saque recusado")
      onAction()
    } finally { setActing(false) }
  }

  async function markComplete() {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/withdrawals/${item.id}`, { method: "PUT" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro"); return }
      toast.success("Saque marcado como concluído")
      onAction()
    } finally { setActing(false) }
  }

  const a = item.bankAccount

  return (
    <>
      {showReject && <RejectDialog onConfirm={reject} onCancel={() => setShowReject(false)} />}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Amount */}
          <div className="shrink-0">
            <p className="text-lg font-bold text-gray-900 tabular-nums">{formatBRL(item.amountCents)}</p>
            <p className="text-xs text-gray-400">{formatDate(item.requestedAt)}</p>
          </div>

          {/* User */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.user.name}</p>
            <p className="text-xs text-gray-400 truncate">{item.user.email}</p>
          </div>

          {/* Bank summary */}
          <div className="hidden sm:block shrink-0 text-right">
            <p className="text-sm text-gray-700 font-medium">Banco {a.bankCode}</p>
            <p className="text-xs text-gray-400">Ag {a.agency} • Cc {a.account}</p>
          </div>

          {/* Expand */}
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          {/* Actions */}
          {item.status === "REQUESTED" && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={approve} disabled={acting}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Aprovar
              </button>
              <button onClick={() => setShowReject(true)} disabled={acting}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                <XCircle className="h-3.5 w-3.5" /> Recusar
              </button>
            </div>
          )}
          {item.status === "PROCESSING" && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                <Loader2 className="h-3 w-3 animate-spin" /> Processando
              </span>
              <button onClick={markComplete} disabled={acting}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Concluir
              </button>
            </div>
          )}
          {item.status === "COMPLETED" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100 shrink-0">
              <CheckCircle2 className="h-3 w-3" /> Concluído
            </span>
          )}
          {item.status === "FAILED" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 shrink-0">
              <XCircle className="h-3 w-3" /> Recusado
            </span>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div><p className="text-gray-400 mb-0.5">Titular</p><p className="text-gray-700 font-medium">{a.holderName}</p></div>
            <div><p className="text-gray-400 mb-0.5">CPF/CNPJ</p><p className="text-gray-700 font-medium">{a.document}</p></div>
            <div><p className="text-gray-400 mb-0.5">Tipo</p><p className="text-gray-700 font-medium">{a.accountType === "CHECKING" ? "Corrente" : "Poupança"}</p></div>
            {a.pixKey && <div><p className="text-gray-400 mb-0.5">Chave PIX</p><p className="text-gray-700 font-medium break-all">{a.pixKey}</p></div>}
            {item.adminNote && (
              <div className="col-span-full">
                <p className="text-gray-400 mb-0.5">Motivo da recusa</p>
                <p className="text-red-600 font-medium">{item.adminNote}</p>
              </div>
            )}
            {item.reviewedAt && <div><p className="text-gray-400 mb-0.5">Revisado em</p><p className="text-gray-700">{formatDate(item.reviewedAt)}</p></div>}
            {item.processedAt && <div><p className="text-gray-400 mb-0.5">Processado em</p><p className="text-gray-700">{formatDate(item.processedAt)}</p></div>}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WithdrawalsAdmin({
  initialData,
  initialTotal,
}: {
  initialData: WithdrawalItem[]
  initialTotal: number
}) {
  const [statusFilter, setStatusFilter] = useState("REQUESTED")

  const { data, mutate, isValidating } = useSWR<PageData>(
    `/api/admin/withdrawals?status=${statusFilter}&page=1`,
    fetcher,
    {
      fallbackData: {
        withdrawals: statusFilter === "REQUESTED" ? initialData : [],
        total: statusFilter === "REQUESTED" ? initialTotal : 0,
        pages: 1, page: 1,
      },
      revalidateOnFocus: true,
    }
  )

  const withdrawals = data?.withdrawals ?? []
  const total = data?.total ?? 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saques</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gerencie as solicitações de saque dos usuários</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats badge */}
          {statusFilter === "REQUESTED" && total > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {total} aguardando aprovação
            </span>
          )}
          <button onClick={() => mutate()} disabled={isValidating}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
            className={`h-8 px-4 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isValidating && withdrawals.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 py-16">
          <CheckCircle2 className="h-10 w-10 text-gray-200" />
          <p className="text-gray-500 font-medium">Nenhum saque aqui</p>
          <p className="text-gray-400 text-sm">
            {statusFilter === "REQUESTED" ? "Nenhuma solicitação aguardando aprovação" : "Sem registros para este filtro"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <WithdrawalRow key={w.id} item={w} onAction={() => mutate()} />
          ))}
        </div>
      )}

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>Atenção:</strong> Verifique os dados bancários antes de aprovar. Após aprovação, o status passa para
          "Processando" — execute a transferência manualmente e clique em "Concluir" quando o pagamento for enviado.
          Ao recusar, o saldo é devolvido ao usuário automaticamente.
        </p>
      </div>
    </div>
  )
}
