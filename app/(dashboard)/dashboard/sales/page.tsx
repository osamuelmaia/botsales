"use client"

import { useState, useEffect, useCallback } from "react"
import { SalesTable, type SaleRow } from "@/components/sales/SalesTable"
import { ExportButton } from "@/components/sales/ExportButton"

// ─── Filter types ─────────────────────────────────────────────────────────────

interface Filters {
  startDate: string
  endDate: string
  status: string
  paymentMethod: string
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const selectCls =
  "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer"

const inputCls =
  "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [filters, setFilters] = useState<Filters>({
    startDate: thirtyDaysAgo(),
    endDate: today(),
    status: "ALL",
    paymentMethod: "ALL",
  })
  const [page, setPage] = useState(1)

  const [sales, setSales] = useState<SaleRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchSales = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" })
      if (f.startDate)     params.set("startDate", f.startDate)
      if (f.endDate)       params.set("endDate", f.endDate)
      if (f.status !== "ALL")        params.set("status", f.status)
      if (f.paymentMethod !== "ALL") params.set("paymentMethod", f.paymentMethod)

      const res = await fetch(`/api/sales?${params}`)
      const json = await res.json()
      setSales(json.sales ?? [])
      setTotal(json.total ?? 0)
      setPages(json.pages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSales(filters, page)
  }, [filters, page, fetchSales])

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
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
          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">De</label>
            <input
              type="date"
              value={filters.startDate}
              max={filters.endDate || today()}
              onChange={(e) => setFilter("startDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Até</label>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              max={today()}
              onChange={(e) => setFilter("endDate", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Quick ranges */}
          <div className="flex items-center gap-1">
            {[
              { label: "Hoje",    days: 0 },
              { label: "7 dias",  days: 7 },
              { label: "30 dias", days: 30 },
              { label: "90 dias", days: 90 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => {
                  const end = today()
                  const start = (() => {
                    const d = new Date()
                    d.setDate(d.getDate() - days)
                    return d.toISOString().slice(0, 10)
                  })()
                  setFilters((p) => ({ ...p, startDate: start, endDate: end }))
                  setPage(1)
                }}
                className="h-7 px-2.5 rounded-md text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

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

          {/* Payment method */}
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
        data={sales}
        loading={loading}
        page={page}
        pages={pages}
        total={total}
        onPage={setPage}
      />
    </div>
  )
}
