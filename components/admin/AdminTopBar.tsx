import { auth } from "@/lib/auth"
import { ShieldCheck } from "lucide-react"

export async function AdminTopBar() {
  const session = await auth()

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <ShieldCheck className="h-4 w-4 text-gray-400" />
        <span>Painel Administrativo</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-bold leading-none">
            {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
          </span>
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">
          {session?.user?.name ?? "Admin"}
        </span>
      </div>
    </header>
  )
}
