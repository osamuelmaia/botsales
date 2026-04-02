"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Users, ChevronLeft, ChevronRight, ShieldCheck, ExternalLink } from "lucide-react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatestSub {
  id:               string
  status:           string
  currentPeriodEnd: string
  product:          { name: string }
}

interface CustomerRow {
  id:              string
  name:            string | null
  email:           string | null
  username:        string | null
  phone:           string | null
  telegramId:      string
  createdAt:       string
  hasPortalAccess: boolean
  salesCount:      number
  bot:             { id: string; name: string; user: { id: string; name: string; email: string } } | null
  latestSub:       LatestSub | null
}

interface ApiResponse {
  leads: CustomerRow[]
  total: number
  pages: number
  page:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

// ─── Sub status badge ─────────────────────────────────────────────────────────

const SUB_COLORS: Record<string, string> = {
  ACTIVE:      "bg-green-100 text-green-700",
  REMARKETING: "bg-yellow-100 text-yellow-700",
  KICKED:      "bg-red-100 text-red-700",
  CANCELLED:   "bg-gray-100 text-gray-500",
}

const SUB_LABELS: Record<string, string> = {
  ACTIVE:      "Ativa",
  REMARKETING: "Atrasada",
  KICKED:      "Removida",
  CANCELLED:   "Cancelada",
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function CustomersAdmin({
  initialData,
  initialTotal,
}: {
  initialData: CustomerRow[]
  initialTotal: number
}) {
  const [search,          setSearch]          = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [accessFilter,    setAccessFilter]    = useState<"ALL" | "true" | "false">("ALL")
  const [page,            setPage]            = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const params = new URLSearchParams({
    page: String(page), limit: String(PAGE_SIZE),
    ...(debouncedSearch         ? { search: debouncedSearch } : {}),
    ...(accessFilter !== "ALL"  ? { hasAccess: accessFilter } : {}),
  })

  const isDefault = page === 1 && !debouncedSearch && accessFilter === "ALL"
  const { data, isLoading } = useSWR<ApiResponse>(
    `/api/admin/customers?${params}`,
    fetcher,
    isDefault
      ? { fallbackData: { leads: initialData, total: initialTotal, pages: Math.ceil(initialTotal / PAGE_SIZE), page: 1 } }
      : undefined
  )

  const leads      = data?.leads ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.pages ?? 1

  const filterBtn = (val: typeof accessFilter, label: string) => (
    <button
      onClick={() => { setAccessFilter(val); setPage(1) }}
      className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors ${
        accessFilter === val
          ? "bg-gray-900 text-white"
          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes finais</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("pt-BR")} lead{total !== 1 ? "s" : ""} na plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {filterBtn("ALL",   "Todos")}
          {filterBtn("true",  "Com acesso portal")}
          {filterBtn("false", "Sem acesso portal")}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendedor / Bot</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assinatura</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Compras</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Portal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrou em</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && leads.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-xs leading-tight">
                          {l.name ?? <span className="text-gray-400 italic">Sem nome</span>}
                        </p>
                        {l.email && <p className="text-[11px] text-gray-400">{l.email}</p>}
                        {l.username && <p className="text-[11px] text-blue-400">@{l.username}</p>}
                      </div>
                    </td>

                    {/* Seller + Bot */}
                    <td className="px-4 py-3">
                      {l.bot ? (
                        <div>
                          <p className="text-xs font-medium text-gray-700 leading-tight">{l.bot.user.name}</p>
                          <p className="text-[11px] text-gray-400">{l.bot.name}</p>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Latest subscription */}
                    <td className="px-4 py-3">
                      {l.latestSub ? (
                        <div>
                          <p className="text-xs font-medium text-gray-700 leading-tight truncate max-w-[120px]">
                            {l.latestSub.product.name}
                          </p>
                          <span className={`mt-0.5 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SUB_COLORS[l.latestSub.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {SUB_LABELS[l.latestSub.status] ?? l.latestSub.status}
                          </span>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Sales count */}
                    <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                      {l.salesCount}
                    </td>

                    {/* Portal access */}
                    <td className="px-4 py-3 text-center">
                      {l.hasPortalAccess ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          <ShieldCheck className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-400">{fmtDate(l.createdAt)}</span>
                        {l.hasPortalAccess && l.email && (
                          <a
                            href="/assinaturas"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-gray-600 transition-colors"
                            title="Ver portal"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
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
              Página {page} de {totalPages} — {total.toLocaleString("pt-BR")} leads
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
