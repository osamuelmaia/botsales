import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeDecrypt } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const now = new Date()

  const [approvedSales, allWithdrawals, user, bankAccounts] = await Promise.all([
    prisma.sale.findMany({
      where: { userId, status: "APPROVED" },
      select: { netAmountCents: true, availableAt: true },
    }),
    // Fetch ALL withdrawals for correct balance math (no take limit)
    prisma.withdrawal.findMany({
      where: { userId },
      include: { bankAccount: true },
      orderBy: { requestedAt: "desc" },
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
  let pendingCents   = 0

  for (const sale of approvedSales) {
    if (sale.availableAt && sale.availableAt <= now) availableCents += sale.netAmountCents
    else pendingCents += sale.netAmountCents
  }

  // Only COMPLETED + PROCESSING count as "effectively withdrawn" for display
  const withdrawnCents = allWithdrawals
    .filter((w) => w.status === "COMPLETED" || w.status === "PROCESSING")
    .reduce((sum, w) => sum + w.amountCents, 0)

  // REQUESTED = pending admin approval (reserved but not yet processed)
  const pendingApprovalCents = allWithdrawals
    .filter((w) => w.status === "REQUESTED")
    .reduce((sum, w) => sum + w.amountCents, 0)

  // True available balance = available sales - already withdrawn - pending approval
  const balanceCents = Math.max(0, availableCents - withdrawnCents - pendingApprovalCents)

  // Only return last 10 for display
  const recentWithdrawals = allWithdrawals.slice(0, 10)

  return NextResponse.json({
    balanceCents,
    availableCents,
    pendingCents,
    withdrawnCents,
    pendingApprovalCents,
    feePercent: Number(user?.platformFeePercent ?? 5.99),
    feeCents: user?.platformFeeCents ?? 100,
    recentWithdrawals: recentWithdrawals.map((w) => ({
      id: w.id, amountCents: w.amountCents, status: w.status,
      adminNote: (w as Record<string, unknown>).adminNote ?? null,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      bankAccount: {
        ...w.bankAccount,
        agency:    safeDecrypt(w.bankAccount.agency),
        account:   safeDecrypt(w.bankAccount.account),
        document:  safeDecrypt(w.bankAccount.document),
        pixKey:    w.bankAccount.pixKey ? safeDecrypt(w.bankAccount.pixKey) : null,
        createdAt: w.bankAccount.createdAt.toISOString(),
      },
    })),
    bankAccounts: bankAccounts.map((a) => ({
      ...a,
      agency:    safeDecrypt(a.agency),
      account:   safeDecrypt(a.account),
      document:  safeDecrypt(a.document),
      pixKey:    a.pixKey ? safeDecrypt(a.pixKey) : null,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}
