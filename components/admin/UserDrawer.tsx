"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { Loader2, Bot, ShoppingBag, TrendingUp, Wallet, Shield, Receipt } from "lucide-react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalesAggregate {
  approved: number; pending: number; refused: number; refunded: number; chargeback: number
  gmv: number; fee: number; net: number
  pixCount: number; pixGmv: number; cardCount: number; cardGmv: number
}

interface UserDetail {
  id: string; name: string; email: string; phone: string | null
  document: string | null; personType: string | null
  registrationStep: number; role: string
  platformFeePercent: number; platformFeeCents: number; withdrawalDays: number
  city: string | null; state: string | null; createdAt: string
  salesAggregate: SalesAggregate
  bots: Array<{ id: string; name: string; isActive: boolean; _count: { leads: number } }>
  products: Array<{ id: string; name: string; priceInCents: number; isRecurring: boolean }>
  sales: Array<{
    id: string; status: string; paymentMethod: string
    grossAmountCents: number; feeAmountCents: number; createdAt: string
    product: { name: string } | null
  }>
  withdrawals: Array<{
    id: string; amountCents: number; status: string; requestedAt: string
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

const SALE_STATUS: Record<string, { cls: string; label: string }> = {
  APPROVED:   { cls: "bg-green-100 text-green-700",   label: "Aprovado" },
  PENDING:    { cls: "bg-yellow-100 text-yellow-700", label: "Pendente" },
  REFUSED:    { cls: "bg-red-100 text-red-600",       label: "Recusado" },
  REFUNDED:   { cls: "bg-orange-100 text-orange-700", label: "Reembolsado" },
  CHARGEBACK: { cls: "bg-purple-100 text-purple-700", label: "Chargeback" },
}

const WITHDRAWAL_STATUS: Record<string, string> = {
  REQUESTED:  "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED:  "bg-green-100 text-green-700",
  FAILED:     "bg-red-100 text-red-600",
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </section>
  )
}

// ─── Fee editor ───────────────────────────────────────────────────────────────

function FeeEditor({ userId, initial, onSaved }: {
  userId: string
  initial: { feePercent: number; feeCents: number; withdrawalDays: number; registrationStep: number; role: string }
  onSaved: () => void
}) {
  const [feePercent,      setFeePercent]      = useState(String(initial.feePercent))
  const [feeCents,        setFeeCents]        = useState(String(initial.feeCents / 100))
  const [withdrawalDays,  setWithdrawalDays]  = useState(String(initial.withdrawalDays))
  const [registrationStep, setRegistrationStep] = useState(initial.registrationStep)
  const [role,            setRole]            = useState(initial.role)
  const [saving,          setSaving]          = useState(false)
  const [dirty,           setDirty]           = useState(false)

  const inputCls = "w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"

  async function save() {
    const pct = parseFloat(feePercent)
    const cts = Math.round(parseFloat(feeCents) * 100)
    const wd  = parseInt(withdrawalDays, 10)
    if (isNaN(pct) || pct < 0 || pct > 50) { toast.error("Taxa % deve ser entre 0 e 50"); return }
    if (isNaN(cts) || cts < 0 || cts > 10000) { toast.error("Taxa fixa deve ser entre R$0 e R$100"); return }
    if (isNaN(wd)  || wd < 0  || wd > 90)    { toast.error("Dias de bloqueio deve ser entre 0 e 90"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformFeePercent: pct,
          platformFeeCents:   cts,
          withdrawalDays:     wd,
          registrationStep,
          role,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao salvar"); return }
      toast.success("Configurações salvas")
      setDirty(false)
      onSaved()
    } finally { setSaving(false) }
  }

  function mark() { setDirty(true) }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Taxa % por venda</label>
          <input type="number" step="0.01" min="0" max="50"
            value={feePercent} onChange={(e) => { setFeePercent(e.target.value); mark() }}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Taxa fixa (R$)</label>
          <input type="number" step="0.01" min="0" max="100"
            value={feeCents} onChange={(e) => { setFeeCents(e.target.value); mark() }}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dias de bloqueio (cartão)</label>
          <input type="number" min="0" max="90"
            value={withdrawalDays} onChange={(e) => { setWithdrawalDays(e.target.value); mark() }}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status de cadastro</label>
          <select value={registrationStep}
            onChange={(e) => { setRegistrationStep(Number(e.target.value) as 1 | 2); mark() }}
            className={inputCls + " cursor-pointer"}>
            <option value={1}>Incompleto (bloqueado)</option>
            <option value={2}>Ativo (habilitado)</option>
          </select>
        </div>
      </div>

      {/* Role toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Papel no sistema</label>
        <select value={role} onChange={(e) => { setRole(e.target.value); mark() }}
          className={inputCls + " cursor-pointer"}>
          <option value="USER">Usuário</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>

      <button
        onClick={save} disabled={saving || !dirty}
        className="w-full h-9 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saving ? "Salvando..." : "Salvar alterações"}
      </button>
    </div>
  )
}

// ─── Drawer content ───────────────────────────────────────────────────────────

function DrawerContent({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const { data: user, isLoading, mutate } = useSWR<UserDetail>(
    `/api/admin/users/${userId}`,
    fetcher
  )

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{user.name[0].toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            user.registrationStep === 2 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          }`}>
            {user.registrationStep === 2 ? "Ativo" : "Incompleto"}
          </span>
          {user.role === "ADMIN" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              <Shield className="h-2.5 w-2.5" /> Admin
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <Section icon={Shield} title="Dados pessoais">
        <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100 text-xs">
          {[
            ["Documento", user.document ?? "—"],
            ["Telefone",  user.phone ?? "—"],
            ["Tipo",      user.personType === "COMPANY" ? "Empresa" : user.personType === "INDIVIDUAL" ? "Pessoa Física" : "—"],
            ["Localidade", user.city && user.state ? `${user.city} / ${user.state}` : "—"],
            ["Cadastrado em", fmtDate(user.createdAt)],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-700 font-medium text-right">{val}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Fee editor */}
      <Section icon={TrendingUp} title="Configurações financeiras">
        <FeeEditor
          userId={user.id}
          initial={{
            feePercent:      user.platformFeePercent,
            feeCents:        user.platformFeeCents,
            withdrawalDays:  user.withdrawalDays,
            registrationStep: user.registrationStep as 1 | 2,
            role:            user.role,
          }}
          onSaved={() => { mutate(); onSaved() }}
        />
      </Section>

      {/* Transactions breakdown */}
      <Section icon={TrendingUp} title="Transações">
        {/* Status cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {([
            { label: "Aprovadas",    val: user.salesAggregate.approved,   cls: "text-green-700 bg-green-50" },
            { label: "Pendentes",    val: user.salesAggregate.pending,    cls: "text-yellow-700 bg-yellow-50" },
            { label: "Recusadas",    val: user.salesAggregate.refused,    cls: "text-red-700 bg-red-50" },
            { label: "Reembolsadas", val: user.salesAggregate.refunded,   cls: "text-orange-700 bg-orange-50" },
            { label: "Chargeback",   val: user.salesAggregate.chargeback, cls: "text-purple-700 bg-purple-50" },
            { label: "Total",        val: user.salesAggregate.approved + user.salesAggregate.pending + user.salesAggregate.refused + user.salesAggregate.refunded + user.salesAggregate.chargeback, cls: "text-gray-700 bg-gray-100" },
          ] as const).map(({ label, val, cls }) => (
            <div key={label} className={`rounded-xl p-2.5 text-center ${cls}`}>
              <p className="text-base font-bold leading-tight">{val}</p>
              <p className="text-[10px] font-medium mt-0.5 opacity-80">{label}</p>
            </div>
          ))}
        </div>
        {/* Volume by method */}
        <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100 text-xs">
          {[
            ["Receita bruta (aprovadas)", brl(user.salesAggregate.gmv)],
            ["Taxa plataforma",           brl(user.salesAggregate.fee)],
            ["Receita líquida",           brl(user.salesAggregate.net)],
            ["PIX aprovados",             `${user.salesAggregate.pixCount}× — ${brl(user.salesAggregate.pixGmv)}`],
            ["Cartão aprovados",          `${user.salesAggregate.cardCount}× — ${brl(user.salesAggregate.cardGmv)}`],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-700 font-medium">{val}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Bots */}
      <Section icon={Bot} title={`Bots (${user.bots.length})`}>
        {user.bots.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Nenhum bot cadastrado</p>
        ) : (
          <div className="space-y-1.5">
            {user.bots.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span className="font-medium text-gray-700 truncate">{b.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-400">{b._count.leads} leads</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Products */}
      <Section icon={ShoppingBag} title={`Produtos (${user.products.length})`}>
        {user.products.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Nenhum produto cadastrado</p>
        ) : (
          <div className="space-y-1.5">
            {user.products.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span className="font-medium text-gray-700 truncate">{p.name}</span>
                <span className="text-gray-500 shrink-0">{brl(p.priceInCents)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent sales */}
      <Section icon={Receipt} title="Últimas transações">
        {user.sales.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Nenhuma venda</p>
        ) : (
          <div className="space-y-1.5">
            {user.sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs gap-2">
                <span className="text-gray-500 shrink-0">{fmtDate(s.createdAt)}</span>
                <span className="text-gray-700 font-medium truncate flex-1">{s.product?.name ?? "—"}</span>
                <span className="font-semibold text-gray-900 shrink-0">{brl(s.grossAmountCents)}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${SALE_STATUS[s.status]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                  {SALE_STATUS[s.status]?.label ?? s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent withdrawals */}
      <Section icon={Wallet} title="Últimos saques">
        {user.withdrawals.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Nenhum saque</p>
        ) : (
          <div className="space-y-1.5">
            {user.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs gap-2">
                <span className="text-gray-500 shrink-0">{fmtDate(w.requestedAt)}</span>
                <span className="font-semibold text-gray-900">{brl(w.amountCents)}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${WITHDRAWAL_STATUS[w.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

    </div>
  )
}

// ─── UserDrawer ───────────────────────────────────────────────────────────────

interface Props {
  userId: string | null
  onClose: () => void
  onSaved: () => void
}

export function UserDrawer({ userId, onClose, onSaved }: Props) {
  // Reset scroll when a new user opens
  useEffect(() => {}, [userId])

  return (
    <Dialog.Root open={!!userId} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Detalhes do usuário
            </Dialog.Title>
            <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">
              ×
            </Dialog.Close>
          </div>

          {/* Body */}
          {userId && <DrawerContent userId={userId} onSaved={onSaved} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
