"use client"

import { useState, useEffect, useCallback } from "react"
import { Wallet, Clock, TrendingUp, Plus, RefreshCw, Building2, Trash2, Star } from "lucide-react"
import { toast } from "sonner"
import { BalanceCard } from "@/components/wallet/BalanceCard"
import { WithdrawalForm } from "@/components/wallet/WithdrawalForm"
import { BankAccountForm } from "@/components/wallet/BankAccountForm"
import { FeeInfo } from "@/components/wallet/FeeInfo"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string
  bankCode: string
  agency: string
  account: string
  accountType: "CHECKING" | "SAVINGS"
  holderName: string
  document: string
  pixKey: string | null
  isDefault: boolean
  createdAt: string
}

interface Withdrawal {
  id: string
  amountCents: number
  status: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED"
  requestedAt: string
  processedAt: string | null
  bankAccount: BankAccount
}

interface WalletData {
  balanceCents: number
  availableCents: number
  pendingCents: number
  withdrawnCents: number
  feePercent: number
  feeCents: number
  recentWithdrawals: Withdrawal[]
  bankAccounts: BankAccount[]
}

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

const WITHDRAWAL_STATUS: Record<string, { label: string; cls: string }> = {
  REQUESTED:  { label: "Solicitado",  cls: "bg-yellow-100 text-yellow-700" },
  PROCESSING: { label: "Processando", cls: "bg-blue-100 text-blue-700" },
  COMPLETED:  { label: "Concluído",   cls: "bg-green-100 text-green-700" },
  FAILED:     { label: "Falhou",      cls: "bg-red-100 text-red-700" },
}

const ACCOUNT_TYPE_LABELS = { CHECKING: "Corrente", SAVINGS: "Poupança" }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBankForm, setShowBankForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchWallet = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallet")
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWallet() }, [fetchWallet])

  async function deleteAccount(id: string) {
    if (!confirm("Remover esta conta bancária?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao remover conta"); return }
      toast.success("Conta removida")
      fetchWallet()
    } finally {
      setDeletingId(null)
    }
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/bank-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    if (res.ok) { toast.success("Conta principal atualizada"); fetchWallet() }
    else toast.error("Erro ao atualizar conta")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carteira</h1>
          <p className="text-gray-500 text-sm mt-0.5">Saldo, saques e contas bancárias</p>
        </div>
        <button
          onClick={fetchWallet}
          disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BalanceCard
          label="Saldo disponível"
          amountCents={data?.balanceCents ?? 0}
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
          valueColor="text-green-700"
          subtitle="Pronto para sacar"
          loading={loading}
        />
        <BalanceCard
          label="Aguardando liberação"
          amountCents={data?.pendingCents ?? 0}
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          iconBg="bg-yellow-50"
          valueColor="text-yellow-700"
          subtitle="PIX: 1 dia útil • Cartão: 30 dias"
          loading={loading}
        />
        <BalanceCard
          label="Total sacado"
          amountCents={data?.withdrawnCents ?? 0}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          valueColor="text-blue-700"
          subtitle="Histórico acumulado"
          loading={loading}
        />
      </div>

      {/* Fee info */}
      {data && (
        <FeeInfo feePercent={data.feePercent} feeCents={data.feeCents} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: withdrawal form + history */}
        <div className="space-y-4">
          {data && (
            <WithdrawalForm
              balanceCents={data.balanceCents}
              bankAccounts={data.bankAccounts}
              onSuccess={fetchWallet}
            />
          )}

          {/* Withdrawal history */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Histórico de saques</h3>
            </div>
            {loading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-24 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : !data?.recentWithdrawals.length ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-400">Nenhum saque realizado ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.recentWithdrawals.map((w) => {
                  const s = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, cls: "bg-gray-100 text-gray-700" }
                  return (
                    <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                          {formatBRL(w.amountCents)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {formatDate(w.requestedAt)} • Ag {w.bankAccount.agency} / Cc {w.bankAccount.account}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: bank accounts */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Contas bancárias</h3>
              </div>
              {!showBankForm && (
                <button
                  onClick={() => setShowBankForm(true)}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-gray-900 text-xs text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.bankAccounts.length && !showBankForm ? (
              <div className="px-5 py-10 text-center">
                <Building2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Nenhuma conta cadastrada</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Cadastre uma conta para solicitar saques.</p>
                <button
                  onClick={() => setShowBankForm(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-900 text-xs text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar conta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(data?.bankAccounts ?? []).map((a) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          Banco {a.bankCode} — {ACCOUNT_TYPE_LABELS[a.accountType]}
                        </p>
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                            <Star className="h-2.5 w-2.5" /> Principal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ag {a.agency} • Cc {a.account} • {a.holderName}
                      </p>
                      {a.pixKey && (
                        <p className="text-xs text-teal-600 mt-0.5">PIX: {a.pixKey}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!a.isDefault && (
                        <button
                          onClick={() => setDefault(a.id)}
                          title="Definir como principal"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAccount(a.id)}
                        disabled={deletingId === a.id}
                        title="Remover conta"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showBankForm && (
            <BankAccountForm
              onSuccess={() => { setShowBankForm(false); fetchWallet() }}
              onCancel={() => setShowBankForm(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
