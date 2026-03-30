import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { CompleteRegistrationBanner } from "@/components/layout/CompleteRegistrationBanner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <CompleteRegistrationBanner />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
