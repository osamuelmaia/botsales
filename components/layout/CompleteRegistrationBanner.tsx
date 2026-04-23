import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AlertCircle } from "lucide-react"
import { CompleteRegistrationModal } from "./CompleteRegistrationModal"

export async function CompleteRegistrationBanner() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { registrationStep: true },
  })

  if (!user || user.registrationStep >= 2) return null

  return (
    <div className="mx-6 mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900 leading-tight">
            Complete seu cadastro
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Preencha seus dados para começar a receber pagamentos.
          </p>
        </div>
      </div>
      <CompleteRegistrationModal />
    </div>
  )
}
