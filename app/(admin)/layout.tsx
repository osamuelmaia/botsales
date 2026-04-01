import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!session?.user?.id || role !== "ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center gap-4">
        <span className="text-sm font-bold tracking-widest uppercase text-gray-400">Admin</span>
        <span className="text-white font-semibold">Painel Administrativo</span>
        <a href="/dashboard" className="ml-auto text-xs text-gray-400 hover:text-white transition-colors">
          ← Voltar ao dashboard
        </a>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
