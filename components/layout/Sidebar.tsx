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
    <nav className="flex flex-col gap-1 p-4 h-full">
      <div className="mb-6 px-2 pt-1">
        <span className="text-xl font-bold text-white tracking-tight">BotFlows</span>
      </div>
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
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/[0.06] bg-[#0d1526] min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 p-2 bg-[#0d1526] border border-white/[0.08] rounded-lg shadow-sm"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5 text-zinc-400" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-56 bg-[#0d1526] min-h-screen shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-300"
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
