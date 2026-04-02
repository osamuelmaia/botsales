"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Bot, ChevronLeft, ChevronRight, Users, GitBranch, Wifi, WifiOff } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotRow {
  id:                string
  name:              string
  isActive:          boolean
  channelConfigured: boolean
  gracePeriodDays:   number
  createdAt:         string
  userId:            string
  user:              { id: string; name: string; email: string } | null
  _count:            { leads: number; flowNodes: number; flowEdges: number }
}

interface ApiResponse {
  bots:  BotRow[]
  total: number
  pages: number
  page:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value ?? "—"}</span>
    </div>
  )
}

// ─── Bot detail drawer ────────────────────────────────────────────────────────

function BotDrawer({ bot, onClose }: { bot: BotRow | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!bot} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Detalhes do bot
              </Dialog.Title>
              {bot && (
                <Dialog.Description className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[260px]">
                  {bot.id}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">
              ×
            </Dialog.Close>
          </div>

          {bot && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Name + status */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{bot.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {bot.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        <Wifi className="h-2.5 w-2.5" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        <WifiOff className="h-2.5 w-2.5" /> Inativo
                      </span>
                    )}
                    {bot.channelConfigured && (
                      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Canal configurado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dono</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Nome"   value={bot.user?.name ?? "—"} />
                  <DetailRow label="E-mail" value={bot.user?.email ?? "—"} />
                </div>
              </section>

              {/* Stats */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estatísticas</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{bot._count.leads.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Leads</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{bot._count.flowNodes}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Nós do fluxo</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{bot._count.flowEdges}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Conexões</p>
                  </div>
                </div>
              </section>

              {/* Config */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Configuração</h3>
                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <DetailRow label="Período de carência" value={`${bot.gracePeriodDays} dia${bot.gracePeriodDays !== 1 ? "s" : ""}`} />
                  <DetailRow label="Canal configurado"   value={bot.channelConfigured ? "Sim" : "Não"} />
                  <DetailRow label="Criado em"           value={fmtDate(bot.createdAt)} />
                </div>
              </section>
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
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function BotsAdmin({
  initialData,
  initialTotal,
}: {
  initialData: BotRow[]
  initialTotal: number
}) {
  const [search,          setSearch]          = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeFilter,    setActiveFilter]    = useState<"ALL" | "true" | "false">("ALL")
  const [page,            setPage]            = useState(1)
  const [selectedBot,     setSelectedBot]     = useState<BotRow | null>(null)
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
    ...(activeFilter !== "ALL" ? { isActive: activeFilter } : {}),
  })

  const isDefault = page === 1 && activeFilter === "ALL" && !debouncedSearch
  const { data, isLoading } = useSWR<ApiResponse>(
    `/api/admin/bots?${params}`,
    fetcher,
    isDefault
      ? { fallbackData: { bots: initialData, total: initialTotal, pages: Math.ceil(initialTotal / PAGE_SIZE), page: 1 } }
      : undefined
  )

  // Client-side search filter (API doesn't have search yet — filter in memory)
  const allBots    = data?.bots ?? []
  const filtered   = debouncedSearch
    ? allBots.filter((b) =>
        b.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        b.user?.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        b.user?.email.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : allBots
  const total      = debouncedSearch ? filtered.length : (data?.total ?? 0)
  const totalPages = debouncedSearch ? 1 : (data?.pages ?? 1)

  const filterBtn = (val: typeof activeFilter, label: string) => (
    <button
      onClick={() => { setActiveFilter(val); setPage(1) }}
      className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors ${
        activeFilter === val
          ? "bg-gray-900 text-white"
          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bots</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("pt-BR")} bot{total !== 1 ? "s" : ""} na plataforma</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar bot ou dono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Active filter */}
          <div className="flex items-center gap-1.5">
            {filterBtn("ALL",   "Todos")}
            {filterBtn("true",  "Ativos")}
            {filterBtn("false", "Inativos")}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dono</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1"><Users className="h-3 w-3" />Leads</span>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1"><GitBranch className="h-3 w-3" />Fluxo</span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Canal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && allBots.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-400">
                      <Bot className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">Nenhum bot encontrado</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBot(b)}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      {/* Bot name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="font-medium text-gray-900 text-xs leading-tight truncate max-w-[140px]">{b.name}</span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 text-xs leading-tight">{b.user?.name ?? "—"}</p>
                          <p className="text-[11px] text-gray-400">{b.user?.email ?? ""}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {b.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Inativo
                          </span>
                        )}
                      </td>

                      {/* Leads */}
                      <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                        {b._count.leads.toLocaleString("pt-BR")}
                      </td>

                      {/* Flow nodes */}
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {b._count.flowNodes} nós · {b._count.flowEdges} conexões
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-3">
                        {b.channelConfigured ? (
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Sim</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {fmtDate(b.createdAt)}
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
                Página {page} de {totalPages} — {total.toLocaleString("pt-BR")} bots
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
      <BotDrawer bot={selectedBot} onClose={() => setSelectedBot(null)} />
    </>
  )
}
