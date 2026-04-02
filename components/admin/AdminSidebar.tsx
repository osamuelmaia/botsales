"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Wallet, Users, ShoppingCart, Bot, LogOut, UserCheck,
} from "lucide-react"
import { signOut } from "next-auth/react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

const NAV = [
  { href: "/admin",             icon: LayoutDashboard, label: "Visão Geral" },
  { href: "/admin/withdrawals", icon: Wallet,          label: "Saques"      },
  { href: "/admin/users",       icon: Users,           label: "Usuários"    },
  { href: "/admin/sales",       icon: ShoppingCart,    label: "Vendas"      },
  { href: "/admin/bots",        icon: Bot,             label: "Bots"        },
  { href: "/admin/customers",   icon: UserCheck,       label: "Clientes"    },
]

interface PendingData { total: number }

export function AdminSidebar() {
  const pathname = usePathname()

  // Badge de saques pendentes
  const { data } = useSWR<PendingData>(
    "/api/admin/withdrawals?status=REQUESTED&limit=1",
    fetcher,
    { refreshInterval: 30_000 }
  )
  const pendingCount = data?.total ?? 0

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-gray-900 min-h-screen">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-800 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center">
          <Bot className="h-4 w-4 text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">BotSales</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Painel Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(href)
          const isWithdrawals = href === "/admin/withdrawals"

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </span>
              {isWithdrawals && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer / logout */}
      <div className="p-3 border-t border-gray-800 shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
