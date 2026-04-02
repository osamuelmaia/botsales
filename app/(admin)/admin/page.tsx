import { AdminDashboardClient } from "./AdminDashboardClient"
import { prisma } from "@/lib/prisma"

async function fetchStats() {
  const now = new Date()
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [gmvAll, gmvMonth, totalUsers, activeUsers, activeBots, pendingWithdrawals, dailySeries] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { status: "APPROVED" },
        _sum: { grossAmountCents: true, feeAmountCents: true },
      }),
      prisma.sale.aggregate({
        where: { status: "APPROVED", createdAt: { gte: startOfMonth } },
        _sum: { grossAmountCents: true, feeAmountCents: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { registrationStep: 2 } }),
      prisma.bot.count({ where: { isActive: true } }),
      prisma.withdrawal.aggregate({
        where: { status: "REQUESTED" },
        _count: true,
        _sum: { amountCents: true },
      }),
      prisma.$queryRaw<Array<{ date: Date; gmvCents: bigint; feesCents: bigint }>>`
        SELECT
          DATE("createdAt") AS date,
          SUM("grossAmountCents")::bigint AS "gmvCents",
          SUM("feeAmountCents")::bigint   AS "feesCents"
        FROM "Sale"
        WHERE status = 'APPROVED'
          AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ])

  return {
    gmvTotalCents:           gmvAll._sum.grossAmountCents   ?? 0,
    feesTotalCents:          gmvAll._sum.feeAmountCents     ?? 0,
    gmvThisMonthCents:       gmvMonth._sum.grossAmountCents ?? 0,
    feesThisMonthCents:      gmvMonth._sum.feeAmountCents   ?? 0,
    totalUsers,
    activeUsers,
    activeBots,
    pendingWithdrawalsCount: pendingWithdrawals._count,
    pendingWithdrawalsCents: pendingWithdrawals._sum.amountCents ?? 0,
    dailySeries: dailySeries.map((r) => ({
      date:      r.date.toISOString().slice(0, 10),
      gmvCents:  Number(r.gmvCents),
      feesCents: Number(r.feesCents),
    })),
  }
}

export default async function AdminDashboardPage() {
  const initialData = await fetchStats()
  return <AdminDashboardClient initialData={initialData} />
}
