"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Bot,
  ShoppingCart,
  Wallet,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/cn"

const navItems = [
  { href: "/dashboard",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Produtos",  icon: Package },
  { href: "/dashboard/bots",     label: "Bots",      icon: Bot },
  { href: "/dashboard/sales",    label: "Vendas",    icon: ShoppingCart },
  { href: "/dashboard/wallet",   label: "Carteira",  icon: Wallet },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-8">
        <Link href="/dashboard" onClick={onClose} className="inline-flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-gray-900 tracking-tight">BotFlows</span>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Navegação
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-transform",
                  !isActive && "group-hover:scale-105",
                )}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              {label}
            </Link>
          )
        })}
      </div>

      {/* Footer meta */}
      <div className="px-5 py-4 border-t border-gray-100 mt-4">
        <p className="text-[10px] text-gray-400">
          BotFlows · v1.0
        </p>
      </div>
    </nav>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-gray-200 bg-white min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-white min-h-screen shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
