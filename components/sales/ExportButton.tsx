"use client"

import { useState } from "react"
import { Download, ChevronDown, Loader2, FileSpreadsheet, FileText } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
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
  if (filters.startDate)     params.set("startDate", filters.startDate)
  if (filters.endDate)       params.set("endDate", filters.endDate)
  if (filters.status)        params.set("status", filters.status)
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
    "Data/Hora":     formatDate(s.createdAt),
    "Cliente":       s.leadName,
    "E-mail":        s.leadEmail,
    "Produto":       s.productName,
    "Pagamento":     METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod,
    "Valor Bruto":   formatBRL(s.grossAmountCents),
    "Taxa":          formatBRL(s.feeAmountCents),
    "Valor Líquido": formatBRL(s.netAmountCents),
    "Status":        STATUS_LABELS[s.status] ?? s.status,
  }))
}

export function ExportButton({ filters }: { filters: ExportFilters }) {
  const [loading, setLoading] = useState(false)

  async function doExport(format: "xlsx" | "csv") {
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 pl-4 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            : <Download className="h-4 w-4 text-gray-500" />
          }
          Exportar
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-0.5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-44 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden p-1 animate-fade-in"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Formato
          </DropdownMenu.Label>

          <DropdownMenu.Item
            onSelect={() => doExport("xlsx")}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:bg-gray-50 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium leading-none">.xlsx</p>
              <p className="text-xs text-gray-400 mt-0.5">Excel / Sheets</p>
            </div>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => doExport("csv")}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:bg-gray-50 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium leading-none">.csv</p>
              <p className="text-xs text-gray-400 mt-0.5">Texto separado</p>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
