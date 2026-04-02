import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminTopBar } from "@/components/admin/AdminTopBar"
import { SWRProvider } from "@/components/providers/SWRProvider"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!session?.user?.id || role !== "ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <AdminTopBar />
        <SWRProvider fallback={{}}>
          <main className="flex-1 p-6">{children}</main>
        </SWRProvider>
      </div>
    </div>
  )
}
