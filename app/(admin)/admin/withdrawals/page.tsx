import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeDecrypt } from "@/lib/utils"
import { WithdrawalsAdmin } from "./WithdrawalsAdmin"

export default async function AdminWithdrawalsPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { status: "REQUESTED" },
      orderBy: { requestedAt: "asc" },
      take: 50,
      include: {
        user:        { select: { id: true, name: true, email: true } },
        bankAccount: true,
      },
    }),
    prisma.withdrawal.count({ where: { status: "REQUESTED" } }),
  ])

  const initialData = withdrawals.map((w) => ({
    id:          w.id,
    amountCents: w.amountCents,
    status:      w.status as "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED",
    adminNote:   (w as Record<string, unknown>).adminNote as string | null ?? null,
    reviewedAt:  ((w as Record<string, unknown>).reviewedAt as Date | null)?.toISOString() ?? null,
    requestedAt: w.requestedAt.toISOString(),
    processedAt: w.processedAt?.toISOString() ?? null,
    user:        w.user,
    bankAccount: {
      id:          w.bankAccount.id,
      bankCode:    w.bankAccount.bankCode,
      holderName:  w.bankAccount.holderName,
      accountType: w.bankAccount.accountType,
      isDefault:   w.bankAccount.isDefault,
      agency:   safeDecrypt(w.bankAccount.agency),
      account:  safeDecrypt(w.bankAccount.account),
      document: safeDecrypt(w.bankAccount.document),
      pixKey:   w.bankAccount.pixKey ? safeDecrypt(w.bankAccount.pixKey) : null,
    },
  }))

  return <WithdrawalsAdmin initialData={initialData} initialTotal={total} />
}
