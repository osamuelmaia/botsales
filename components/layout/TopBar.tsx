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

function formatK(cents: number): string {
  const r = cents / 100
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(r % 1_000_000 === 0 ? 0 : 1)}M`
  if (r >= 1_000)     return `${(r / 1_000).toFixed(r % 1_000 === 0 ? 0 : 0)}k`
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
    name: level.name,
    minLabel: formatK(level.min),
    maxLabel: level.max ? formatK(level.max) : "∞",
    progress,
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
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 shrink-0 gap-4">
      {/* Gamification widget */}
      <div className="hidden sm:flex flex-col justify-center w-44 shrink-0">
        <p className="text-[11px] font-semibold text-gray-700 leading-none mb-1">{lvl.name}</p>
        <div className="relative h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gray-900 rounded-full transition-all duration-500"
            style={{ width: `${lvl.progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{lvl.minLabel}</span>
          <span className="text-[10px] text-gray-400">{lvl.maxLabel}</span>
        </div>
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
