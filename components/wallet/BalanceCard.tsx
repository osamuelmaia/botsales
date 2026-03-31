"use client"

import { ReactNode } from "react"

interface Props {
  label: string
  amountCents: number
  icon: ReactNode
  iconBg: string
  valueColor?: string
  subtitle?: string
  loading?: boolean
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function BalanceCard({
  label,
  amountCents,
  icon,
  iconBg,
  valueColor = "text-gray-900",
  subtitle,
  loading,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {loading ? (
          <div className="h-7 w-28 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${valueColor}`}>
            {formatBRL(amountCents)}
          </p>
        )}
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
