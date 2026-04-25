"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import {
  ArrowUpRight, Clock, TrendingUp, Building2, Trash2,
  Star, Plus, RefreshCw, CheckCircle2, AlertCircle, Loader, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { BankAccountForm } from "@/components/wallet/BankAccountForm"
import { FeeInfo } from "@/components/wallet/FeeInfo"
import { PageHeader } from "@/components/ui/PageHeader"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string; bankCode: string; agency: string; account: string
  accountType: "CHECKING" | "SAVINGS"; holderName: string; document: string
  pixKey: string | null; isDefault: boolean; createdAt: string
}

interface Withdrawal {
  id: string; amountCents: number
  status: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED"
  requestedAt: string; processedAt: string | null; bankAccount: BankAccount
}

interface WalletData {
  balanceCents: number; availableCents: number; pendingCents: number
  withdrawnCents: number; pendingApprovalCents: number
  feePercent: number; feeCents: number
  recentWithdrawals: Withdrawal[]; bankAccounts: BankAccount[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const WITHDRAWAL_STATUS = {
  REQUESTED:  { label: "Solicitado",  icon: Clock,        cls: "text-amber-700 bg-amber-50 border-amber-200" },
  PROCESSING: { label: "Processando", icon: Loader,       cls: "text-blue-600 bg-blue-50 border-blue-200" },
  COMPLETED:  { label: "Concluído",   icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  FAILED:     { label: "Falhou",      icon: XCircle,      cls: "text-red-600 bg-red-50 border-red-200" },
} as const

const ACCOUNT_TYPE_LABELS = { CHECKING: "Corrente", SAVINGS: "Poupança" }

const controlCls = "w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400"

// ─── Balance hero ─────────────────────────────────────────────────────────────

function BalanceHero({ data }: { data: WalletData }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-lg shadow-blue-600/20">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-4 -bottom-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute left-1/3 -top-6 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-blue-100 uppercase tracking-wider mb-1">Saldo disponível</p>
          <p className="text-4xl font-bold tabular-nums">{formatBRL(data.balanceCents)}</p>
          <p className="text-xs text-blue-200 mt-1">Pronto para sacar a qualquer momento</p>
        </div>
        <div className="flex gap-6">
          {data.pendingApprovalCents > 0 && (
            <div>
              <p className="text-xs text-blue-200 mb-0.5">Em análise</p>
              <p className="text-lg font-semibold tabular-nums text-yellow-200">{formatBRL(data.pendingApprovalCents)}</p>
              <p className="text-xs text-blue-300 mt-0.5">Aguardando aprovação</p>
            </div>
          )}
          <div>
            <p className="text-xs text-blue-200 mb-0.5">A liberar</p>
            <p className="text-lg font-semibold tabular-nums text-yellow-200">{formatBRL(data.pendingCents)}</p>
            <p className="text-xs text-blue-300 mt-0.5">PIX: 1d • Cartão: 30d</p>
          </div>
          <div>
            <p className="text-xs text-blue-200 mb-0.5">Total sacado</p>
            <p className="text-lg font-semibold tabular-nums text-white/80">{formatBRL(data.withdrawnCents)}</p>
            <p className="text-xs text-blue-300 mt-0.5">Histórico acumulado</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Withdrawal panel ─────────────────────────────────────────────────────────

function WithdrawalPanel({ data, onSuccess }: { data: WalletData; onSuccess: () => void }) {
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const accounts = data.bankAccounts
  const balance = data.balanceCents

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId((accounts.find((a) => a.isDefault) ?? accounts[0]).id)
    }
  }, [accounts, accountId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) { toast.error("Informe um valor válido"); return }
    if (!accountId) { toast.error("Selecione uma conta"); return }
    if (amountCents > balance) { toast.error("Saldo insuficiente"); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, bankAccountId: accountId }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao solicitar saque"); return }
      toast.success("Saque solicitado com sucesso!")
      setAmount("")
      onSuccess()
    } finally { setSubmitting(false) }
  }

  const hasAccounts = accounts.length > 0
  const canWithdraw = balance > 0 && hasAccounts

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Efetuar saque</h3>
          <p className="text-xs text-gray-400">Transfira seu saldo para sua conta bancária</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Valor do saque
            <span className="ml-1.5 text-gray-400 font-normal">disponível: {formatBRL(balance)}</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 select-none">R$</span>
            <input
              type="number" step="0.01" min="1" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              disabled={!canWithdraw}
              className={`${controlCls} pl-9`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Conta destino</label>
          {hasAccounts ? (
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={controlCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankCode} • Ag {a.agency} • Cc {a.account}{a.isDefault ? " — Principal" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
              <AlertCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-400">Nenhuma conta cadastrada — adicione uma ao lado</p>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!canWithdraw || submitting}
          className="w-full h-10 rounded-lg bg-[#111627] text-sm text-white font-medium hover:bg-[#1c2434] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-black/10"
        >
          {submitting
            ? <><Loader className="h-3.5 w-3.5 animate-spin" /> Solicitando...</>
            : <><ArrowUpRight className="h-3.5 w-3.5" /> Solicitar saque</>
          }
        </button>
        {!hasAccounts && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
            Cadastre uma conta bancária para habilitar os saques
          </p>
        )}
        {hasAccounts && balance <= 0 && (
          <p className="text-xs text-center text-gray-400">
            Seu saldo ficará disponível após aprovação dos pagamentos
          </p>
        )}
      </form>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WalletClient() {
  const { data, mutate, isValidating } = useSWR<WalletData>("/api/wallet", fetcher)
  const [showBankForm, setShowBankForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function deleteAccount(id: string) {
    if (!confirm("Remover esta conta bancária?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao remover conta"); return }
      toast.success("Conta removida")
      mutate()
    } finally { setDeletingId(null) }
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/bank-accounts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    if (res.ok) { toast.success("Conta principal atualizada"); mutate() }
    else toast.error("Erro ao atualizar conta")
  }

  if (!data) return null
  const accounts = data.bankAccounts
  const withdrawals = data.recentWithdrawals

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteira"
        description="PIX cai em 1 dia útil, cartão fica bloqueado por 30 dias. Cadastre sua conta bancária para sacar."
        actions={
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-colors shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        }
      />

      <BalanceHero data={data} />
      <FeeInfo feePercent={data.feePercent} feeCents={data.feeCents} />

      {/* Ação + Contas lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Efetuar saque — coluna estreita */}
        <div className="lg:col-span-2">
          <WithdrawalPanel data={data} onSuccess={() => mutate()} />
        </div>

        {/* Contas bancárias — coluna larga */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Contas bancárias</h3>
                  <p className="text-xs text-gray-400">Para receber seus saques</p>
                </div>
              </div>
              {accounts.length > 0 && !showBankForm && (
                <button
                  onClick={() => setShowBankForm(true)}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              )}
            </div>

            {accounts.length === 0 && !showBankForm ? (
              <div className="p-5">
                <div className="flex flex-col items-center gap-2 pb-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Nenhuma conta cadastrada</p>
                  <p className="text-xs text-gray-400 leading-relaxed">Cadastre sua conta bancária ou chave PIX para receber saques.</p>
                </div>
                <button
                  onClick={() => setShowBankForm(true)}
                  className="w-full h-10 rounded-lg bg-[#111627] text-sm text-white font-medium hover:bg-[#1c2434] transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-black/10"
                >
                  <Plus className="h-4 w-4" /> Cadastrar conta bancária
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {accounts.map((a) => (
                  <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">Banco {a.bankCode}</p>
                        <span className="text-xs text-gray-400">{ACCOUNT_TYPE_LABELS[a.accountType]}</span>
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> Principal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Ag {a.agency} · Cc {a.account}</p>
                      <p className="text-xs text-gray-400">{a.holderName}</p>
                      {a.pixKey && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <span className="font-medium">PIX:</span> {a.pixKey}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                      {!a.isDefault && (
                        <button
                          onClick={() => setDefault(a.id)}
                          title="Definir como principal"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAccount(a.id)}
                        disabled={deletingId === a.id}
                        title="Remover"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
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
              onSuccess={() => { setShowBankForm(false); mutate() }}
              onCancel={() => setShowBankForm(false)}
            />
          )}
        </div>
      </div>

      {/* Histórico de saques — largura total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Histórico de saques</h3>
            <p className="text-xs text-gray-400">Todas as suas solicitações</p>
          </div>
        </div>
        {withdrawals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-600">Nenhum saque ainda</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Quando você solicitar um saque, ele aparecerá aqui com o status atualizado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {withdrawals.map((w) => {
              const s = WITHDRAWAL_STATUS[w.status] ?? WITHDRAWAL_STATUS.REQUESTED
              const Icon = s.icon
              return (
                <div key={w.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatBRL(w.amountCents)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Banco {w.bankAccount.bankCode} · Ag {w.bankAccount.agency}</p>
                  </div>
                  <p className="text-xs text-gray-400 hidden sm:block shrink-0">{formatDate(w.requestedAt)}</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${s.cls}`}>
                    <Icon className="h-3 w-3" /> {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
