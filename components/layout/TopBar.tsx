import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LogOut } from "lucide-react"

// all values in cents (R$)
const LEVELS = [
  { name: "Iniciante",    min: 0,           max: 1_000_000   }, // 0 → 10k
  { name: "Vendedor",     min: 1_000_000,   max: 5_000_000   }, // 10k → 50k
  { name: "Profissional", min: 5_000_000,   max: 20_000_000  }, // 50k → 200k
  { name: "Especialista", min: 20_000_000,  max: 50_000_000  }, // 200k → 500k
  { name: "Sênior",       min: 50_000_000,  max: 100_000_000 }, // 500k → 1M
  { name: "Autoridade",   min: 100_000_000, max: 500_000_000 }, // 1M → 5M
  { name: "Elite",        min: 500_000_000, max: null        }, // 5M+
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
      <div className="hidden sm:flex items-center gap-2.5 shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        {/* Roman numeral badge */}
        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold leading-none">{ROMAN[lvl.idx]}</span>
        </div>
        {/* Name + bar + range */}
        <div className="flex flex-col gap-1.5 w-28">
          <p className="text-xs font-semibold text-gray-900 leading-none truncate">{lvl.name}</p>
          <div className="relative h-[3px] w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gray-900 rounded-full transition-all duration-700"
              style={{ width: `${lvl.progress}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-400 tabular-nums leading-none">{lvl.minLabel}</span>
            <span className="text-[9px] text-gray-400 tabular-nums leading-none">{lvl.maxLabel}</span>
          </div>
        </div>
        {/* Progress % */}
        <span className="text-[10px] font-medium text-gray-400 leading-none shrink-0 tabular-nums">
          {Math.round(lvl.progress)}%
        </span>
      </div>

      {/* push right */}
      <div className="flex-1" />

      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
        <p className="text-xs text-gray-500 leading-tight">{user?.email}</p>
      </div>
      <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-semibold shrink-0">
        {user?.name?.[0]?.toUpperCase() ?? "U"}
      </div>
      <form action={handleSignOut}>
        <button
          type="submit"
          title="Sair"
          className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </header>
  )
}
