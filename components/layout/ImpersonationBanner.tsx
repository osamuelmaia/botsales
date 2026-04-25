"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  userName: string
}

export function ImpersonationBanner({ userName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function stopImpersonation() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao restaurar sessão"); return }
      router.push("/admin")
      router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-white text-sm font-medium">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 shrink-0" />
        <span>
          Você está logado como <strong>{userName}</strong>. Sessão de impersonação ativa.
        </span>
      </div>
      <button
        onClick={stopImpersonation}
        disabled={loading}
        className="flex items-center gap-1.5 shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        {loading ? "Saindo..." : "Voltar para admin"}
      </button>
    </div>
  )
}
