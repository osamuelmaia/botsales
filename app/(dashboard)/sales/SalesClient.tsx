"use client"

import useSWR from "swr"
import { useState, useMemo } from "react"
import { SalesTable, type SaleRow } from "@/components/sales/SalesTable"
import { SaleDrawer } from "@/components/sales/SaleDrawer"
import { ExportButton } from "@/components/sales/ExportButton"
import { PageHeader } from "@/components/ui/PageHeader"
import { DateRangePicker } from "@/components/ui/DateRangePicker"
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

const selectCls = "h-10 rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"

export function SalesClient({ initialStartDate }: { initialStartDate: string }) {
  const [range, setRange] = useState({ from: initialStartDate, to: today() })
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

  const { data, isLoading, mutate } = useSWR<SalesData>(key, fetcher, {
    keepPreviousData: true,
    refreshInterval: 15_000,
  })

  function setFilter<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((p) => ({ ...p, [k]: v }))
    setPage(1)
  }

  function onRangeChange(r: { from: string; to: string }) {
    setRange(r)
    setFilters((p) => ({ ...p, startDate: r.from, endDate: r.to }))
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        description="Todas as vendas realizadas pelo seu bot — filtre por período, status ou método de pagamento."
        actions={
          <ExportButton
            filters={{
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
              status: filters.status !== "ALL" ? filters.status : undefined,
              paymentMethod: filters.paymentMethod !== "ALL" ? filters.paymentMethod : undefined,
            }}
          />
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Date range picker — same component as dashboard */}
          <DateRangePicker value={range} onChange={onRangeChange} />

          <div className="h-5 w-px bg-gray-200" />

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className={selectCls}
          >
            <option value="ALL">Todos os status</option>
            <option value="APPROVED">Aprovado</option>
            <option value="PENDING">Pendente</option>
            <option value="REFUSED">Recusado</option>
            <option value="REFUNDED">Reembolsado</option>
            <option value="CHARGEBACK">Chargeback</option>
          </select>

          {/* Method */}
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilter("paymentMethod", e.target.value)}
            className={selectCls}
          >
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
      <SaleDrawer
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onRefund={() => mutate()}
      />
    </div>
  )
}
