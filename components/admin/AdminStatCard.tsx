import type { LucideIcon } from "lucide-react"

interface Props {
  title: string
  value: string
  sub?: string
  icon: LucideIcon
  iconColor?: string
  action?: React.ReactNode
}

export function AdminStatCard({ title, value, sub, icon: Icon, iconColor = "text-gray-400", action }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{title}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="mt-auto">{action}</div>}
    </div>
  )
}
