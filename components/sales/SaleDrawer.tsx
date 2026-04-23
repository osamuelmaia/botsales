"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { SaleRow } from "./SalesTable"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  APPROVED:   { label: "Aprovado",    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  PENDING:    { label: "Pendente",    cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  REFUSED:    { label: "Recusado",    cls: "bg-red-50 text-red-700 border border-red-200" },
  REFUNDED:   { label: "Reembolsado", cls: "bg-orange-50 text-orange-700 border border-orange-200" },
  CHARGEBACK: { label: "Chargeback",  cls: "bg-purple-50 text-purple-700 border border-purple-200" },
} as const

function StatusBadge({ status }: { status: SaleRow["status"] }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-50 text-gray-700 border border-gray-200" }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">{title}</h3>
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 divide-y divide-gray-100">
        {children}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-xs font-medium text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right tabular-nums">{value ?? "—"}</span>
    </div>
  )
}

// ─── SaleDrawer ───────────────────────────────────────────────────────────────

interface Props {
  sale: SaleRow | null
  onClose: () => void
}

export function SaleDrawer({ sale, onClose }: Props) {
  return (
    <Dialog.Root open={!!sale} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Detalhes da venda
              </Dialog.Title>
              {sale && (
                <Dialog.Description className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[260px]">
                  {sale.id}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          {sale && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Status + método */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={sale.status} />
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {sale.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
                </span>
              </div>

              {/* Cliente */}
              <Section title="Cliente">
                <Row label="Nome"     value={<span className="font-medium">{sale.lead?.name ?? "—"}</span>} />
                <Row label="E-mail"   value={<span className="font-mono text-xs">{sale.lead?.email ?? "—"}</span>} />
                <Row label="Telefone" value={sale.lead?.phone || "—"} />
              </Section>

              {/* Produto */}
              <Section title="Produto">
                <Row label="Produto" value={sale.product?.name} />
              </Section>

              {/* Financeiro */}
              <Section title="Financeiro">
                <Row
                  label="Valor bruto"
                  value={<span className="text-gray-700">{formatBRL(sale.grossAmountCents)}</span>}
                />
                <Row
                  label="Taxa"
                  value={<span className="text-gray-400">{formatBRL(sale.feeAmountCents)}</span>}
                />
                <Row
                  label="Valor líquido"
                  value={
                    <span className="font-semibold text-emerald-700 text-base">
                      {formatBRL(sale.netAmountCents)}
                    </span>
                  }
                />
              </Section>

              {/* Datas */}
              <Section title="Datas">
                <Row label="Criado em"     value={formatDateTime(sale.createdAt)} />
                <Row label="Pago em"       value={formatDateTime(sale.paidAt)} />
                <Row label="Disponível em" value={formatDateTime(sale.availableAt)} />
              </Section>

              {/* Gateway */}
              {sale.gatewayId && (
                <Section title="Gateway">
                  <Row
                    label="ID Asaas"
                    value={<span className="font-mono text-xs break-all">{sale.gatewayId}</span>}
                  />
                </Section>
              )}

            </div>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
