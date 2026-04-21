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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Produtos", icon: Package },
  { href: "/dashboard/bots", label: "Bots", icon: Bot },
  { href: "/dashboard/sales", label: "Vendas", icon: ShoppingCart },
  { href: "/dashboard/wallet", label: "Carteira", icon: Wallet },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-4 h-full">
      <div className="mb-6 px-2 pt-1">
        <span className="text-xl font-bold text-gray-900">BotFlows</span>
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
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-gray-200 bg-white min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-56 bg-white min-h-screen shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
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
