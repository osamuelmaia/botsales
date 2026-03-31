import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LogOut } from "lucide-react"

const LEVELS = [
  { name: "Iniciante",    min: 0 },
  { name: "Vendedor",     min: 50000 },
  { name: "Profissional", min: 200000 },
  { name: "Especialista", min: 1000000 },
  { name: "Sênior",       min: 5000000 },
  { name: "Autoridade",   min: 10000000 },
  { name: "Elite",        min: 100000000 },
]

function getLevelName(totalCents: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalCents >= LEVELS[i].min) return LEVELS[i].name
  }
  return LEVELS[0].name
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
  const levelName = getLevelName(revenueAgg?._sum?.netAmountCents ?? 0)

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-end px-6 shrink-0 gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
        <p className="text-xs text-gray-500 leading-tight">
          {user?.email}
          <span className="ml-2 text-gray-300">·</span>
          <span className="ml-1.5 text-gray-400">{levelName}</span>
        </p>
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
