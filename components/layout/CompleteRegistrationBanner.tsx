import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export async function CompleteRegistrationBanner() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { registrationStep: true },
  })

  if (!user || user.registrationStep >= 2) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-sm">
          Complete seu cadastro para começar a receber pagamentos.
        </p>
      </div>
      <Link
        href="/dashboard/settings"
        className="text-sm font-semibold text-amber-900 underline underline-offset-2 hover:no-underline shrink-0"
      >
        Completar agora →
      </Link>
    </div>
  )
}
