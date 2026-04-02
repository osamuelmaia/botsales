"use client"

import * as Dialog from "@radix-ui/react-dialog"
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
  APPROVED:   { label: "Aprovado",    cls: "bg-green-100 text-green-700" },
  PENDING:    { label: "Pendente",    cls: "bg-yellow-100 text-yellow-700" },
  REFUSED:    { label: "Recusado",    cls: "bg-red-100 text-red-700" },
  REFUNDED:   { label: "Reembolsado", cls: "bg-orange-100 text-orange-700" },
  CHARGEBACK: { label: "Chargeback",  cls: "bg-purple-100 text-purple-700" },
} as const

function StatusBadge({ status }: { status: SaleRow["status"] }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value ?? "—"}</span>
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
            <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">
              ×
            </Dialog.Close>
          </div>

          {/* Body */}
          {sale && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Status + método */}
              <div className="flex items-center gap-2">
                <StatusBadge status={sale.status} />
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                  {sale.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
                </span>
              </div>

              {/* Cliente */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <Row label="Nome"     value={sale.lead?.name} />
                  <Row label="E-mail"   value={sale.lead?.email} />
                  <Row label="Telefone" value={sale.lead?.phone || "—"} />
                </div>
              </section>

              {/* Produto */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Produto</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <Row label="Produto" value={sale.product?.name} />
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Financeiro</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <Row label="Valor bruto"   value={formatBRL(sale.grossAmountCents)} />
                  <Row label="Taxa"          value={<span className="text-gray-500">{formatBRL(sale.feeAmountCents)}</span>} />
                  <Row label="Valor líquido" value={<span className="font-semibold">{formatBRL(sale.netAmountCents)}</span>} />
                </div>
              </section>

              {/* Datas */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Datas</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <Row label="Criado em"     value={formatDateTime(sale.createdAt)} />
                  <Row label="Pago em"       value={formatDateTime(sale.paidAt)} />
                  <Row label="Disponível em" value={formatDateTime(sale.availableAt)} />
                </div>
              </section>

              {/* Gateway */}
              {sale.gatewayId && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Gateway</h3>
                  <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                    <Row label="ID Asaas" value={<span className="font-mono text-xs break-all">{sale.gatewayId}</span>} />
                  </div>
                </section>
              )}

            </div>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
