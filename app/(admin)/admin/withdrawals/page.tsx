import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeDecrypt } from "@/lib/utils"
import { WithdrawalsAdmin } from "./WithdrawalsAdmin"

export default async function AdminWithdrawalsPage() {
  await auth()

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { status: "REQUESTED" },
      orderBy: { requestedAt: "asc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        bankAccount: true,
      },
    }),
    prisma.withdrawal.count({ where: { status: "REQUESTED" } }),
  ])

  const initialData = withdrawals.map((w) => {
    const wAny = w as Record<string, unknown>
    return {
      id:          w.id,
      amountCents: w.amountCents,
      status:      w.status,
      adminNote:   (wAny.adminNote as string | null) ?? null,
      reviewedAt:  (wAny.reviewedAt as Date | null)?.toISOString() ?? null,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      user:        w.user,
      bankAccount: {
        ...w.bankAccount,
        agency:    safeDecrypt(w.bankAccount.agency),
        account:   safeDecrypt(w.bankAccount.account),
        document:  safeDecrypt(w.bankAccount.document),
        pixKey:    w.bankAccount.pixKey ? safeDecrypt(w.bankAccount.pixKey) : null,
        createdAt: w.bankAccount.createdAt.toISOString(),
      },
    }
  })

  return <WithdrawalsAdmin initialData={initialData} initialTotal={total} />
}
