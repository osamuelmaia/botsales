"use client"

import useSWR from "swr"
import { useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle2, XCircle, Loader2, RefreshCw,
  Clock, AlertCircle, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const STATUS_OPTS = [
  { value: "REQUESTED",  label: "Aguardando" },
  { value: "PROCESSING", label: "Processando" },
  { value: "COMPLETED",  label: "Concluídos"  },
  { value: "FAILED",     label: "Recusados"   },
  { value: "ALL",        label: "Todos"       },
]

const STATUS_BADGE: Record<string, string> = {
  REQUESTED:  "bg-amber-50  text-amber-700  border-amber-100",
  PROCESSING: "bg-blue-50   text-blue-700   border-blue-100",
  COMPLETED:  "bg-green-50  text-green-700  border-green-100",
  FAILED:     "bg-red-50    text-red-600    border-red-100",
}

// ─── Confirm dialog (approve / complete) ─────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel, confirmClass, onConfirm, onCancel, loading,
}: {
  title: string; description: string; confirmLabel: string; confirmClass: string
  onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <AlertDialog.Root open>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 focus:outline-none data-[state=open]:animate-fade-in">
          <AlertDialog.Title className="text-base font-semibold text-gray-900 mb-1">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-500 mb-5">{description}</AlertDialog.Description>
          <div className="flex gap-2">
            <AlertDialog.Cancel onClick={onCancel}
              className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm} disabled={loading}
              className={`flex-1 h-9 rounded-lg text-sm text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 ${confirmClass}`}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("")
  return (
    <AlertDialog.Root open>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 focus:outline-none data-[state=open]:animate-fade-in">
          <AlertDialog.Title className="text-base font-semibold text-gray-900 mb-1">Recusar saque</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-500 mb-3">
            Informe o motivo. O saldo será devolvido ao usuário automaticamente.
          </AlertDialog.Description>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
            placeholder="Ex: Dados bancários incorretos, CPF divergente..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
          />
          <div className="flex gap-2">
            <AlertDialog.Cancel onClick={onCancel}
              className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => { if (note.trim().length >= 5) onConfirm(note.trim()); else toast.error("Informe o motivo (mín. 5 caracteres)") }}
              className="flex-1 h-9 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-700 transition-colors">
              Confirmar recusa
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Withdrawal row ───────────────────────────────────────────────────────────

function WithdrawalRow({ item, onAction }: { item: WithdrawalItem; onAction: () => void }) {
  const [acting, setActing]           = useState(false)
  const [showReject, setShowReject]   = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const a = item.bankAccount

  async function approve() {
    setShowApprove(false)
    setActing(true)
    try {
      const res  = await fetch(`/api/admin/withdrawals/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao aprovar"); return }
      toast.success("Saque aprovado — faça a transferência e clique em Concluir")
      onAction()
    } finally { setActing(false) }
  }

  async function reject(note: string) {
    setShowReject(false)
    setActing(true)
    try {
      const res  = await fetch(`/api/admin/withdrawals/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", adminNote: note }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao recusar"); return }
      toast.success("Saque recusado — saldo devolvido ao usuário")
      onAction()
    } finally { setActing(false) }
  }

  async function markComplete() {
    setShowComplete(false)
    setActing(true)
    try {
      const res  = await fetch(`/api/admin/withdrawals/${item.id}`, { method: "PUT" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro"); return }
      toast.success("Saque marcado como concluído")
      onAction()
    } finally { setActing(false) }
  }

  return (
    <>
      {showReject   && <RejectDialog onConfirm={reject} onCancel={() => setShowReject(false)} />}
      {showApprove  && (
        <ConfirmDialog
          title="Aprovar saque"
          description={`Confirma a aprovação de ${formatBRL(item.amountCents)} para ${item.user.name}? Após aprovar, execute a transferência manualmente e marque como Concluído.`}
          confirmLabel="Aprovar" confirmClass="bg-green-600 hover:bg-green-700"
          onConfirm={approve} onCancel={() => setShowApprove(false)} loading={acting}
        />
      )}
      {showComplete && (
        <ConfirmDialog
          title="Confirmar envio"
          description={`Confirma que a transferência de ${formatBRL(item.amountCents)} para ${item.user.name} foi enviada?`}
          confirmLabel="Confirmar envio" confirmClass="bg-gray-900 hover:bg-gray-800"
          onConfirm={markComplete} onCancel={() => setShowComplete(false)} loading={acting}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
          {/* Amount + date */}
          <div className="shrink-0 min-w-[100px]">
            <p className="text-lg font-bold text-gray-900 tabular-nums">{formatBRL(item.amountCents)}</p>
            <p className="text-xs text-gray-400">{formatDate(item.requestedAt)}</p>
          </div>

          {/* User */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.user.name}</p>
            <p className="text-xs text-gray-400 truncate">{item.user.email}</p>
          </div>

          {/* Bank summary */}
          <div className="hidden sm:block shrink-0 text-right">
            <p className="text-sm text-gray-700 font-medium">Banco {a.bankCode}</p>
            <p className="text-xs text-gray-400">Ag {a.agency} · Cc {a.account}</p>
          </div>

          {/* Status / Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {item.status === "REQUESTED" && (
              <>
                <button onClick={() => setShowApprove(true)} disabled={acting}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Aprovar
                </button>
                <button onClick={() => setShowReject(true)} disabled={acting}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                  <XCircle className="h-3.5 w-3.5" /> Recusar
                </button>
              </>
            )}
            {item.status === "PROCESSING" && (
              <>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE.PROCESSING}`}>
                  <Loader2 className="h-3 w-3 animate-spin" /> Processando
                </span>
                <button onClick={() => setShowComplete(true)} disabled={acting}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Concluir
                </button>
              </>
            )}
            {item.status === "COMPLETED" && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE.COMPLETED}`}>
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </span>
            )}
            {item.status === "FAILED" && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE.FAILED}`}>
                <XCircle className="h-3 w-3" /> Recusado
              </span>
            )}

            {/* Expand toggle */}
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div><p className="text-gray-400 mb-0.5">Titular</p><p className="text-gray-700 font-medium">{a.holderName}</p></div>
            <div><p className="text-gray-400 mb-0.5">Documento</p><p className="text-gray-700 font-medium">{a.document}</p></div>
            <div><p className="text-gray-400 mb-0.5">Tipo de conta</p><p className="text-gray-700 font-medium">{a.accountType === "CHECKING" ? "Corrente" : "Poupança"}</p></div>
            {a.pixKey && (
              <div className="col-span-2">
                <p className="text-gray-400 mb-0.5">Chave PIX</p>
                <p className="text-gray-700 font-medium break-all">{a.pixKey}</p>
              </div>
            )}
            {item.adminNote && (
              <div className="col-span-full bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <p className="text-red-500 mb-0.5 font-medium">Motivo da recusa</p>
                <p className="text-red-700">{item.adminNote}</p>
              </div>
            )}
            <div><p className="text-gray-400 mb-0.5">Solicitado em</p><p className="text-gray-700">{formatDate(item.requestedAt)}</p></div>
            {item.reviewedAt  && <div><p className="text-gray-400 mb-0.5">Revisado em</p><p className="text-gray-700">{formatDate(item.reviewedAt)}</p></div>}
            {item.processedAt && <div><p className="text-gray-400 mb-0.5">Concluído em</p><p className="text-gray-700">{formatDate(item.processedAt)}</p></div>}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function WithdrawalsAdmin({
  initialData,
  initialTotal,
}: {
  initialData: WithdrawalItem[]
  initialTotal: number
}) {
  const [statusFilter, setStatusFilter] = useState("REQUESTED")
  const [page, setPage] = useState(1)

  const { data, mutate, isValidating } = useSWR<PageData>(
    `/api/admin/withdrawals?status=${statusFilter}&page=${page}`,
    fetcher,
    {
      fallbackData: statusFilter === "REQUESTED" && page === 1
        ? { withdrawals: initialData, total: initialTotal, pages: Math.ceil(initialTotal / 50), page: 1 }
        : undefined,
      revalidateOnFocus: true,
    }
  )

  const withdrawals = data?.withdrawals ?? []
  const total       = data?.total  ?? 0
  const pages       = data?.pages  ?? 1

  function changeFilter(f: string) { setStatusFilter(f); setPage(1) }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie as solicitações de saque dos usuários</p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm flex-wrap">
        {STATUS_OPTS.map((opt) => (
          <button key={opt.value} onClick={() => changeFilter(opt.value)}
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center gap-2 py-16">
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">{total} registros · página {page} de {pages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>Atenção:</strong> Verifique os dados bancários antes de aprovar. Após aprovar,
          execute a transferência manualmente e clique em <strong>Concluir</strong> quando o pagamento for enviado.
          Ao recusar, o saldo é devolvido automaticamente.
        </p>
      </div>
    </div>
  )
}
