"use client"

import { useState } from "react"
import { Download, ChevronDown, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"

interface ExportFilters {
  startDate?: string
  endDate?: string
  status?: string
  paymentMethod?: string
}

interface SaleRow {
  createdAt: string
  leadName: string
  leadEmail: string
  productName: string
  paymentMethod: string
  grossAmountCents: number
  feeAmountCents: number
  netAmountCents: number
  status: string
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Pendente",
  REFUSED: "Recusado",
  REFUNDED: "Reembolsado",
  CHARGEBACK: "Chargeback",
}

const METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão",
}

async function fetchAllSales(filters: ExportFilters): Promise<SaleRow[]> {
  const params = new URLSearchParams({ limit: "10000", page: "1" })
  if (filters.startDate)    params.set("startDate", filters.startDate)
  if (filters.endDate)      params.set("endDate", filters.endDate)
  if (filters.status)       params.set("status", filters.status)
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod)

  const res = await fetch(`/api/sales?${params}`)
  const json = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.sales ?? []).map((s: any) => ({
    createdAt: s.createdAt,
    leadName: s.lead?.name ?? "—",
    leadEmail: s.lead?.email ?? "—",
    productName: s.product?.name ?? "—",
    paymentMethod: s.paymentMethod,
    grossAmountCents: s.grossAmountCents,
    feeAmountCents: s.feeAmountCents,
    netAmountCents: s.netAmountCents,
    status: s.status,
  }))
}

function buildRows(sales: SaleRow[]) {
  return sales.map((s) => ({
    "Data/Hora":      formatDate(s.createdAt),
    "Cliente":        s.leadName,
    "E-mail":         s.leadEmail,
    "Produto":        s.productName,
    "Pagamento":      METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod,
    "Valor Bruto":    formatBRL(s.grossAmountCents),
    "Taxa":           formatBRL(s.feeAmountCents),
    "Valor Líquido":  formatBRL(s.netAmountCents),
    "Status":         STATUS_LABELS[s.status] ?? s.status,
  }))
}

export function ExportButton({ filters }: { filters: ExportFilters }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function doExport(format: "xlsx" | "csv") {
    setOpen(false)
    setLoading(true)
    try {
      const sales = await fetchAllSales(filters)
      const rows = buildRows(sales)
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Vendas")

      const filename = `vendas_${new Date().toISOString().slice(0, 10)}.${format}`
      if (format === "xlsx") {
        XLSX.writeFile(wb, filename)
      } else {
        XLSX.writeFile(wb, filename, { bookType: "csv" })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={() => doExport("xlsx")}
          disabled={loading}
          className="flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-l-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Exportar
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          className="flex items-center h-9 px-1.5 rounded-r-lg border border-l-0 border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-32 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
            <button
              onClick={() => doExport("xlsx")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 text-green-600" /> .xlsx
            </button>
            <button
              onClick={() => doExport("csv")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" /> .csv
            </button>
          </div>
        </>
      )}
    </div>
  )
}
