import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WalletClient } from "./WalletClient"

export default async function WalletPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()

  const [approvedSales, withdrawals, user, bankAccounts] = await Promise.all([
    prisma.sale.findMany({
      where: { userId, status: "APPROVED" },
      select: { netAmountCents: true, availableAt: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      take: 10,
      select: {
        id: true, amountCents: true, status: true, requestedAt: true, processedAt: true,
        bankAccount: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { platformFeePercent: true, platformFeeCents: true },
    }),
    prisma.bankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
  ])

  let availableCents = 0
  let pendingCents = 0
  for (const sale of approvedSales) {
    if (sale.availableAt && sale.availableAt <= now) availableCents += sale.netAmountCents
    else pendingCents += sale.netAmountCents
  }

  const withdrawnCents = withdrawals
    .filter((w) => ["COMPLETED", "PROCESSING", "REQUESTED"].includes(w.status))
    .reduce((sum, w) => sum + w.amountCents, 0)

  const initialData = {
    balanceCents: Math.max(0, availableCents - withdrawnCents),
    availableCents,
    pendingCents,
    withdrawnCents,
    feePercent: Number(user?.platformFeePercent ?? 5.99),
    feeCents: user?.platformFeeCents ?? 100,
    recentWithdrawals: withdrawals.map((w) => ({
      ...w,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      bankAccount: {
        ...w.bankAccount,
        createdAt: w.bankAccount.createdAt.toISOString(),
      },
    })),
    bankAccounts: bankAccounts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }

  return <WalletClient initialData={initialData} />
}
