import { auth, signOut } from "@/lib/auth"
import { LogOut } from "lucide-react"

export async function TopBar() {
  const session = await auth()
  const user = session?.user

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-end px-6 shrink-0 gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
        <p className="text-xs text-gray-500 leading-tight">{user?.email}</p>
      </div>
      <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-semibold shrink-0">
        {user?.name?.[0]?.toUpperCase() ?? "U"}
      </div>
      <form action={handleSignOut}>
        <button
          type="submit"
          title="Sair"
          className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </header>
  )
}
