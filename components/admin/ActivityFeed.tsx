"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import {
  CheckCircle2, Clock3, XCircle, RefreshCw,
  RotateCcw, UserPlus, CreditCard, Loader2,
} from "lucide-react"

type EventType =
  | "approved_pix" | "approved_card"
  | "pending_pix"
  | "refused_card" | "refused_pix"
  | "refunded"
  | "new_contact"

interface ActivityEvent {
  id:          string
  type:        EventType
  actor:       string
  description: string
  amountCents: number | null
  sellerName:  string | null
  at:          string
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CFG: Record<EventType, {
  icon: React.ElementType
  iconCls: string
  dot: string
  label: string
}> = {
  approved_pix:  { icon: CheckCircle2, iconCls: "text-green-600",  dot: "bg-green-500",  label: "PIX aprovado" },
  approved_card: { icon: CreditCard,   iconCls: "text-blue-600",   dot: "bg-blue-500",   label: "Cartão aprovado" },
  pending_pix:   { icon: Clock3,       iconCls: "text-amber-500",  dot: "bg-amber-400",  label: "PIX gerado" },
  refused_card:  { icon: XCircle,      iconCls: "text-red-500",    dot: "bg-red-500",    label: "Cartão recusado" },
  refused_pix:   { icon: XCircle,      iconCls: "text-orange-500", dot: "bg-orange-400", label: "PIX expirou" },
  refunded:      { icon: RotateCcw,    iconCls: "text-purple-500", dot: "bg-purple-400", label: "Reembolso" },
  new_contact:   { icon: UserPlus,     iconCls: "text-gray-400",   dot: "bg-gray-300",   label: "Novo contato" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────

export function ActivityFeed({ endpoint = "/api/admin/activity" }: { endpoint?: string }) {
  const { data, isLoading, mutate, isValidating } = useSWR<ActivityEvent[]>(
    endpoint,
    fetcher,
    { refreshInterval: 30_000 }
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Atividades dos usuários</h2>
          <p className="text-xs text-gray-400 mt-0.5">Atualiza a cada 30s · últimas 60 ações</p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isValidating ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          Nenhuma atividade registrada
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
          {data.map((ev) => {
            const cfg  = EVENT_CFG[ev.type]
            const Icon = cfg.icon
            return (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                {/* Icon */}
                <div className={`mt-0.5 h-7 w-7 rounded-full bg-gray-50 flex items-center justify-center shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${cfg.iconCls}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">
                      {ev.actor}
                    </span>
                    <span className="text-sm text-gray-500 truncate">
                      {ev.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      ev.type === "approved_pix"  ? "bg-green-50 text-green-700"  :
                      ev.type === "approved_card" ? "bg-blue-50 text-blue-700"    :
                      ev.type === "pending_pix"   ? "bg-amber-50 text-amber-700"  :
                      ev.type === "refused_card"  ? "bg-red-50 text-red-600"      :
                      ev.type === "refused_pix"   ? "bg-orange-50 text-orange-600":
                      ev.type === "refunded"      ? "bg-purple-50 text-purple-700":
                      "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {ev.sellerName && (
                      <span className="text-[11px] text-gray-400 truncate">via {ev.sellerName}</span>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="text-right shrink-0">
                  {ev.amountCents != null && (
                    <p className={`text-sm font-bold ${
                      ev.type.startsWith("approved") ? "text-green-700" :
                      ev.type === "refunded" ? "text-purple-600" :
                      "text-gray-700"
                    }`}>
                      {brl(ev.amountCents)}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(ev.at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
