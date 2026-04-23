import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LogOut } from "lucide-react"

const LEVELS = [
  { name: "Iniciante",    min: 0,           max: 1_000_000   },
  { name: "Vendedor",     min: 1_000_000,   max: 5_000_000   },
  { name: "Profissional", min: 5_000_000,   max: 20_000_000  },
  { name: "Especialista", min: 20_000_000,  max: 50_000_000  },
  { name: "Sênior",       min: 50_000_000,  max: 100_000_000 },
  { name: "Autoridade",   min: 100_000_000, max: 500_000_000 },
  { name: "Elite",        min: 500_000_000, max: null        },
]

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]

function formatK(cents: number): string {
  const r = cents / 100
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(r % 1_000_000 === 0 ? 0 : 1)}M`
  if (r >= 1_000)     return `${(r / 1_000).toFixed(0)}k`
  return `${r}`
}

function getLevel(totalCents: number) {
  let idx = 0
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalCents >= LEVELS[i].min) { idx = i; break }
  }
  const level = LEVELS[idx]
  const progress = level.max
    ? Math.min(((totalCents - level.min) / (level.max - level.min)) * 100, 100)
    : 100
  return {
    idx,
    name: level.name,
    progress,
    minLabel: formatK(level.min),
    maxLabel: level.max ? formatK(level.max) : "∞",
  }
}

export async function TopBar() {
  const session = await auth()
  const user = session?.user

  const revenueAgg = user?.id
    ? await prisma.sale.aggregate({
        where: { userId: user.id, status: "APPROVED" },
        _sum: { netAmountCents: true },
      })
    : null
  const lvl = getLevel(revenueAgg?._sum?.netAmountCents ?? 0)

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 shrink-0 gap-4">
      {/* Gamification widget */}
      <div className="hidden sm:flex items-center gap-3 shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        {/* Roman numeral badge */}
        <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20">
          <span className="text-white text-[11px] font-bold leading-none">{ROMAN[lvl.idx]}</span>
        </div>

        {/* Name + bar + range */}
        <div className="flex flex-col gap-1.5 w-32">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-900 leading-none truncate">{lvl.name}</p>
            <span className="text-[10px] font-medium text-gray-400 leading-none tabular-nums">
              {Math.round(lvl.progress)}%
            </span>
          </div>
          <div className="relative h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
              style={{ width: `${lvl.progress}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-400 tabular-nums leading-none">{lvl.minLabel}</span>
            <span className="text-[9px] text-gray-400 tabular-nums leading-none">{lvl.maxLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* User info */}
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
        <p className="text-xs text-gray-500 leading-tight mt-0.5">{user?.email}</p>
      </div>
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0 ring-2 ring-white shadow-sm">
        {user?.name?.[0]?.toUpperCase() ?? "U"}
      </div>
      <form action={handleSignOut}>
        <button
          type="submit"
          title="Sair"
          aria-label="Sair"
          className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </header>
  )
}
