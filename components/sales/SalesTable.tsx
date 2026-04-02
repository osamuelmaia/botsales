"use client"

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaleRow {
  id: string
  createdAt: string
  paidAt: string | null
  availableAt: string | null
  gatewayId: string | null
  lead: { name: string | null; email: string | null; phone: string | null } | null
  product: { name: string } | null
  paymentMethod: "PIX" | "CREDIT_CARD"
  grossAmountCents: number
  feeAmountCents: number
  netAmountCents: number
  status: "APPROVED" | "PENDING" | "REFUSED" | "REFUNDED" | "CHARGEBACK"
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

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  APPROVED:   { label: "Aprovado",     cls: "bg-green-100 text-green-700" },
  PENDING:    { label: "Pendente",     cls: "bg-yellow-100 text-yellow-700" },
  REFUSED:    { label: "Recusado",     cls: "bg-red-100 text-red-700" },
  REFUNDED:   { label: "Reembolsado",  cls: "bg-orange-100 text-orange-700" },
  CHARGEBACK: { label: "Chargeback",   cls: "bg-purple-100 text-purple-700" },
} as const

const METHOD_CONFIG = {
  PIX:         { label: "PIX",    cls: "bg-gray-100 text-gray-600" },
  CREDIT_CARD: { label: "Cartão", cls: "bg-gray-100 text-gray-600" },
} as const

function StatusBadge({ status }: { status: SaleRow["status"] }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>{c.label}</span>
}

function MethodBadge({ method }: { method: SaleRow["paymentMethod"] }) {
  const c = METHOD_CONFIG[method] ?? { label: method, cls: "bg-gray-100 text-gray-700" }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>{c.label}</span>
}

// ─── Column definitions ───────────────────────────────────────────────────────

const col = createColumnHelper<SaleRow>()

const columns = [
  col.accessor("createdAt", {
    header: "Data/Hora",
    cell: (i) => <span className="text-gray-600 whitespace-nowrap">{formatDate(i.getValue())}</span>,
  }),
  col.accessor((r) => r.lead?.name ?? "—", {
    id: "leadName",
    header: "Cliente",
    cell: (i) => <span className="font-medium text-gray-900">{i.getValue()}</span>,
  }),
  col.accessor((r) => r.lead?.email ?? "—", {
    id: "leadEmail",
    header: "E-mail",
    cell: (i) => <span className="text-gray-500">{i.getValue()}</span>,
  }),
  col.accessor((r) => r.product?.name ?? "—", {
    id: "productName",
    header: "Produto",
    cell: (i) => <span className="text-gray-700">{i.getValue()}</span>,
  }),
  col.accessor("paymentMethod", {
    header: "Pagamento",
    cell: (i) => <MethodBadge method={i.getValue()} />,
  }),
  col.accessor("grossAmountCents", {
    header: "Valor Bruto",
    cell: (i) => <span className="text-gray-900 font-medium tabular-nums">{formatBRL(i.getValue())}</span>,
  }),
  col.accessor("feeAmountCents", {
    header: "Taxa",
    cell: (i) => <span className="text-gray-500 tabular-nums">{formatBRL(i.getValue())}</span>,
  }),
  col.accessor("netAmountCents", {
    header: "Valor Líquido",
    cell: (i) => <span className="text-gray-900 font-medium tabular-nums">{formatBRL(i.getValue())}</span>,
  }),
  col.accessor("status", {
    header: "Status",
    cell: (i) => <StatusBadge status={i.getValue()} />,
  }),
]

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (j * 17 + i * 11) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <tr>
      <td colSpan={9} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Nenhuma venda encontrada</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              As transações aparecerão aqui assim que os primeiros pagamentos forem processados pelo seu bot.
            </p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── SalesTable ───────────────────────────────────────────────────────────────

interface Props {
  data: SaleRow[]
  loading: boolean
  page: number
  pages: number
  total: number
  onPage: (p: number) => void
  onRowClick?: (row: SaleRow) => void
}

export function SalesTable({ data, loading, page, pages, total, onPage, onRowClick }: Props) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pages,
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : data.length === 0 ? (
              <EmptyState />
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          {total === 0 ? "Nenhum resultado" : `${total} venda${total !== 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            {page} / {Math.max(1, pages)}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= pages || loading}
            className="flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Próxima <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
