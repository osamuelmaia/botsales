import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const now = new Date()

  const [
    approvedSales,
    withdrawals,
    user,
    bankAccounts,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { userId, status: "APPROVED" },
      select: { netAmountCents: true, availableAt: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId },
      select: { amountCents: true, status: true, requestedAt: true, processedAt: true },
      orderBy: { requestedAt: "desc" },
      take: 10,
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

  // Balance breakdown
  let availableCents = 0
  let pendingCents = 0

  for (const sale of approvedSales) {
    if (sale.availableAt && sale.availableAt <= now) {
      availableCents += sale.netAmountCents
    } else {
      pendingCents += sale.netAmountCents
    }
  }

  // Subtract already withdrawn amounts from available
  const withdrawnCents = withdrawals
    .filter((w) => w.status === "COMPLETED" || w.status === "PROCESSING" || w.status === "REQUESTED")
    .reduce((sum, w) => sum + w.amountCents, 0)

  const balanceCents = Math.max(0, availableCents - withdrawnCents)

  return NextResponse.json({
    balanceCents,
    availableCents,
    pendingCents,
    withdrawnCents,
    feePercent: Number(user?.platformFeePercent ?? 5.99),
    feeCents: user?.platformFeeCents ?? 100,
    recentWithdrawals: withdrawals,
    bankAccounts,
  })
}
