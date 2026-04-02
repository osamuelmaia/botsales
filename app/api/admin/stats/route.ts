import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function requireAdmin(role?: string) {
  return role === "ADMIN"
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !requireAdmin((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    gmvAll,
    gmvMonth,
    totalUsers,
    activeUsers,
    activeBots,
    pendingWithdrawals,
    dailySeries,
  ] = await Promise.all([
    // GMV + fees — all time
    prisma.sale.aggregate({
      where: { status: "APPROVED" },
      _sum: { grossAmountCents: true, feeAmountCents: true },
    }),
    // GMV + fees — this month
    prisma.sale.aggregate({
      where: { status: "APPROVED", createdAt: { gte: startOfMonth } },
      _sum: { grossAmountCents: true, feeAmountCents: true },
    }),
    // Total users
    prisma.user.count(),
    // Active users (registrationStep === 2)
    prisma.user.count({ where: { registrationStep: 2 } }),
    // Active bots
    prisma.bot.count({ where: { isActive: true } }),
    // Pending withdrawals
    prisma.withdrawal.aggregate({
      where: { status: "REQUESTED" },
      _count: true,
      _sum: { amountCents: true },
    }),
    // Daily series — last 30 days
    prisma.$queryRaw<Array<{ date: Date; gmvCents: bigint; feesCents: bigint }>>`
      SELECT
        DATE("createdAt") AS date,
        SUM("grossAmountCents")::bigint AS "gmvCents",
        SUM("feeAmountCents")::bigint  AS "feesCents"
      FROM "Sale"
      WHERE status = 'APPROVED'
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ])

  return NextResponse.json({
    gmvTotalCents:            gmvAll._sum.grossAmountCents  ?? 0,
    feesTotalCents:           gmvAll._sum.feeAmountCents    ?? 0,
    gmvThisMonthCents:        gmvMonth._sum.grossAmountCents ?? 0,
    feesThisMonthCents:       gmvMonth._sum.feeAmountCents   ?? 0,
    totalUsers,
    activeUsers,
    activeBots,
    pendingWithdrawalsCount:  pendingWithdrawals._count,
    pendingWithdrawalsCents:  pendingWithdrawals._sum.amountCents ?? 0,
    dailySeries: dailySeries.map((r) => ({
      date:      r.date.toISOString().slice(0, 10),
      gmvCents:  Number(r.gmvCents),
      feesCents: Number(r.feesCents),
    })),
  })
}
