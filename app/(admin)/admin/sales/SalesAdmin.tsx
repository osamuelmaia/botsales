"use client"

import { useState, useEffect, useRef } from "react"
import { Search, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminSaleRow {
  id:               string
  createdAt:        string
  paidAt:           string | null
  availableAt:      string | null
  gatewayId:        string | null
  status:           "APPROVED" | "PENDING" | "REFUSED" | "REFUNDED" | "CHARGEBACK"
  paymentMethod:    "PIX" | "CREDIT_CARD"
  grossAmountCents: number
  feeAmountCents:   number
  netAmountCents:   number
  user:             { id: string; name: string; email: string } | null
  lead:             { name: string | null; email: string | null; phone: string | null } | null
  product:          { name: string } | null
}

interface ApiResponse {
  sales: AdminSaleRow[]
  total: number
  pages: number
  page:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function fmtDateOnly(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  APPROVED:   { label: "Aprovado",    cls: "bg-green-100 text-green-700" },
  PENDING:    { label: "Pendente",    cls: "bg-yellow-100 text-yellow-700" },
  REFUSED:    { label: "Recusado",    cls: "bg-red-100 text-red-700" },
  REFUNDED:   { label: "Reembolsado", cls: "bg-orange-100 text-orange-700" },
  CHARGEBACK: { label: "Chargeback",  cls: "bg-purple-100 text-purple-700" },
} as const

function StatusBadge({ status }: { status: AdminSaleRow["status"] }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value ?? "—"}</span>
    </div>
  )
}

function SaleDetailDrawer({ sale, onClose }: { sale: AdminSaleRow | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!sale} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">Detalhes da venda</Dialog.Title>
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

          {sale && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Status + método */}
              <div className="flex items-center gap-2">
                <StatusBadge status={sale.status} />
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                  {sale.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
                </span>
              </div>

              {/* Vendedor */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vendedor</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Nome"   value={sale.user?.name ?? "—"} />
                  <DetailRow label="E-mail" value={sale.user?.email ?? "—"} />
                </div>
              </section>

              {/* Cliente */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Nome"     value={sale.lead?.name} />
                  <DetailRow label="E-mail"   value={sale.lead?.email} />
                  <DetailRow label="Telefone" value={sale.lead?.phone || "—"} />
                </div>
              </section>

              {/* Produto */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Produto</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Produto" value={sale.product?.name} />
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Financeiro</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Valor bruto"   value={brl(sale.grossAmountCents)} />
                  <DetailRow label="Taxa plataforma" value={<span className="text-gray-500">{brl(sale.feeAmountCents)}</span>} />
                  <DetailRow label="Valor líquido" value={<span className="font-semibold">{brl(sale.netAmountCents)}</span>} />
                </div>
              </section>

              {/* Datas */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Datas</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Criado em"     value={fmtDateOnly(sale.createdAt)} />
                  <DetailRow label="Pago em"       value={fmtDateOnly(sale.paidAt)} />
                  <DetailRow label="Disponível em" value={fmtDateOnly(sale.availableAt)} />
                </div>
              </section>

              {/* Gateway */}
              {sale.gatewayId && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Gateway</h3>
                  <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                    <DetailRow label="ID Asaas" value={<span className="font-mono text-xs break-all">{sale.gatewayId}</span>} />
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

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "ALL",        label: "Todos" },
  { value: "APPROVED",   label: "Aprovado" },
  { value: "PENDING",    label: "Pendente" },
  { value: "REFUSED",    label: "Recusado" },
  { value: "REFUNDED",   label: "Reembolsado" },
  { value: "CHARGEBACK", label: "Chargeback" },
]

const METHOD_OPTIONS = [
  { value: "ALL",         label: "Todos" },
  { value: "PIX",         label: "PIX" },
  { value: "CREDIT_CARD", label: "Cartão" },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function SalesAdmin({
  initialData,
  initialTotal,
}: {
  initialData: AdminSaleRow[]
  initialTotal: number
}) {
  const [search,          setSearch]          = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status,          setStatus]          = useState("ALL")
  const [method,          setMethod]          = useState("ALL")
  const [page,            setPage]            = useState(1)
  const [selectedSale,    setSelectedSale]    = useState<AdminSaleRow | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== "ALL"  ? { status }  : {}),
    ...(method !== "ALL"  ? { paymentMethod: method } : {}),
  })

  const isDefault = page === 1 && !debouncedSearch && status === "ALL" && method === "ALL"
  const { data, isLoading } = useSWR<ApiResponse>(
    `/api/admin/sales?${params}`,
    fetcher,
    isDefault
      ? { fallbackData: { sales: initialData, total: initialTotal, pages: Math.ceil(initialTotal / PAGE_SIZE), page: 1 } }
      : undefined
  )

  const sales      = data?.sales ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.pages ?? 1

  const selectInput = "h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("pt-BR")} venda{total !== 1 ? "s" : ""} na plataforma</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search (seller) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Status filter */}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectInput}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Method filter */}
          <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} className={selectInput}>
            {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bruto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Taxa</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && sales.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">Nenhuma venda encontrada</p>
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSale(s)}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 text-xs leading-tight">{s.user?.name ?? "—"}</p>
                          <p className="text-[11px] text-gray-400">{s.user?.email ?? ""}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">
                        {s.product?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                          {s.paymentMethod === "PIX" ? "PIX" : "Cartão"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-900 whitespace-nowrap">
                        {brl(s.grossAmountCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                        {brl(s.feeAmountCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {brl(s.netAmountCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Página {page} de {totalPages} — {total.toLocaleString("pt-BR")} vendas
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <SaleDetailDrawer sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </>
  )
}
