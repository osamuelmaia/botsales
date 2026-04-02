"use client"

import useSWR from "swr"
import { useState, useMemo } from "react"
import { SalesTable, type SaleRow } from "@/components/sales/SalesTable"
import { SaleDrawer } from "@/components/sales/SaleDrawer"
import { ExportButton } from "@/components/sales/ExportButton"
import { fetcher } from "@/lib/fetcher"

interface Filters {
  startDate: string
  endDate: string
  status: string
  paymentMethod: string
}

interface SalesData {
  sales: SaleRow[]
  total: number
  pages: number
  page: number
}

function today() { return new Date().toISOString().slice(0, 10) }

const selectCls = "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer"
const inputCls  = "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

export function SalesClient({ initialStartDate }: { initialStartDate: string }) {
  const [filters, setFilters] = useState<Filters>({
    startDate: initialStartDate,
    endDate: today(),
    status: "ALL",
    paymentMethod: "ALL",
  })
  const [page, setPage] = useState(1)
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null)

  const key = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "50" })
    if (filters.startDate)               params.set("startDate", filters.startDate)
    if (filters.endDate)                 params.set("endDate", filters.endDate)
    if (filters.status !== "ALL")        params.set("status", filters.status)
    if (filters.paymentMethod !== "ALL") params.set("paymentMethod", filters.paymentMethod)
    return `/api/sales?${params}`
  }, [filters, page])

  const { data, isLoading } = useSWR<SalesData>(key, fetcher, { keepPreviousData: true })

  function setFilter<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((p) => ({ ...p, [k]: v }))
    setPage(1)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Histórico completo de transações</p>
        </div>
        <ExportButton
          filters={{
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            status: filters.status !== "ALL" ? filters.status : undefined,
            paymentMethod: filters.paymentMethod !== "ALL" ? filters.paymentMethod : undefined,
          }}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">De</label>
            <input type="date" value={filters.startDate} max={filters.endDate || today()}
              onChange={(e) => setFilter("startDate", e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Até</label>
            <input type="date" value={filters.endDate} min={filters.startDate} max={today()}
              onChange={(e) => setFilter("endDate", e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-1">
            {[{ label: "Hoje", days: 0 }, { label: "7 dias", days: 7 }, { label: "30 dias", days: 30 }, { label: "90 dias", days: 90 }].map(({ label, days }) => (
              <button key={label} onClick={() => {
                const end = today()
                const d = new Date(); d.setDate(d.getDate() - days)
                setFilters((p) => ({ ...p, startDate: d.toISOString().slice(0, 10), endDate: end }))
                setPage(1)
              }} className="h-7 px-2.5 rounded-md text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                {label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-gray-200" />
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={selectCls}>
            <option value="ALL">Todos os status</option>
            <option value="APPROVED">Aprovado</option>
            <option value="PENDING">Pendente</option>
            <option value="REFUSED">Recusado</option>
            <option value="REFUNDED">Reembolsado</option>
            <option value="CHARGEBACK">Chargeback</option>
          </select>
          <select value={filters.paymentMethod} onChange={(e) => setFilter("paymentMethod", e.target.value)} className={selectCls}>
            <option value="ALL">Todos os métodos</option>
            <option value="PIX">PIX</option>
            <option value="CREDIT_CARD">Cartão</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <SalesTable
        data={data?.sales ?? []}
        loading={isLoading && !data}
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total ?? 0}
        onPage={setPage}
        onRowClick={setSelectedSale}
      />

      {/* Detail drawer */}
      <SaleDrawer sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  )
}
