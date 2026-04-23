"use client"

import useSWR from "swr"
import { useState, useMemo } from "react"
import { SalesTable, type SaleRow } from "@/components/sales/SalesTable"
import { SaleDrawer } from "@/components/sales/SaleDrawer"
import { ExportButton } from "@/components/sales/ExportButton"
import { PageHeader } from "@/components/ui/PageHeader"
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

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PERIOD_CHIPS = [
  { label: "Hoje",    days: 0 },
  { label: "7 dias",  days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
]

const controlCls = "h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"

export function SalesClient({ initialStartDate }: { initialStartDate: string }) {
  const [filters, setFilters] = useState<Filters>({
    startDate: initialStartDate,
    endDate: today(),
    status: "ALL",
    paymentMethod: "ALL",
  })
  const [activePeriod, setActivePeriod] = useState<number | null>(null)
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
    refreshInterval: 15_000,   // auto-refresh a cada 15s para pegar novos pagamentos
  })

  function setFilter<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((p) => ({ ...p, [k]: v }))
    setPage(1)
  }

  function applyPeriod(days: number) {
    setActivePeriod(days)
    setFilters((p) => ({
      ...p,
      startDate: days === 0 ? today() : daysAgo(days),
      endDate: today(),
    }))
    setPage(1)
  }

  function onDateChange(k: "startDate" | "endDate", v: string) {
    setActivePeriod(null)
    setFilter(k, v)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        description="Histórico completo de transações"
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

          {/* Period chips */}
          <div className="flex items-center gap-1">
            {PERIOD_CHIPS.map(({ label, days }) => {
              const isActive = activePeriod === days
              return (
                <button
                  key={label}
                  onClick={() => applyPeriod(days)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">De</label>
            <input
              type="date"
              value={filters.startDate}
              max={filters.endDate || today()}
              onChange={(e) => onDateChange("startDate", e.target.value)}
              className={controlCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Até</label>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              max={today()}
              onChange={(e) => onDateChange("endDate", e.target.value)}
              className={controlCls}
            />
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Status + method selects */}
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className={controlCls}
          >
            <option value="ALL">Todos os status</option>
            <option value="APPROVED">Aprovado</option>
            <option value="PENDING">Pendente</option>
            <option value="REFUSED">Recusado</option>
            <option value="REFUNDED">Reembolsado</option>
            <option value="CHARGEBACK">Chargeback</option>
          </select>

          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilter("paymentMethod", e.target.value)}
            className={controlCls}
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
