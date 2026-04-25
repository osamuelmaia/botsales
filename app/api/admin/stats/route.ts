import { NextResponse, NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GatewayService } from "@/lib/gateway"

function requireAdmin(role?: string) {
  return role === "ADMIN"
}

function parseDate(str: string | null, fallback: Date, endOfDay = false): Date {
  if (!str) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"))
  }
  return new Date(str)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !requireAdmin((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const from = parseDate(searchParams.get("from"), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const to   = parseDate(searchParams.get("to"),   now, true)

  const [
    gmvPeriod,
    salesApprovedCount,
    salesTotalCount,
    newUsersPeriod,
    totalUsers,
    completeUsers,
    activeBots,
    activeSubscriptions,
    pendingWithdrawals,
    dailySeries,
    asaasBalance,
  ] = await Promise.all([
    // Revenue
    prisma.sale.aggregate({
      where: { status: "APPROVED", createdAt: { gte: from, lte: to } },
      _sum: { grossAmountCents: true, feeAmountCents: true },
    }),
    // Approved sales count (period)
    prisma.sale.count({
      where: { status: "APPROVED", createdAt: { gte: from, lte: to } },
    }),
    // Total sales created (period) — for conversion rate
    prisma.sale.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    // New user registrations in period
    prisma.user.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    // All-time users
    prisma.user.count(),
    // Users with complete registration
    prisma.user.count({ where: { registrationStep: 2 } }),
    // Active bots
    prisma.bot.count({ where: { isActive: true } }),
    // Active subscriptions
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    // Pending withdrawals
    prisma.withdrawal.aggregate({
      where: { status: "REQUESTED" },
      _count: true,
      _sum: { amountCents: true },
    }),
    // Daily chart series
    prisma.$queryRaw<Array<{ date: Date; gmvCents: bigint; feesCents: bigint }>>`
      SELECT
        DATE("createdAt") AS date,
        SUM("grossAmountCents")::bigint AS "gmvCents",
        SUM("feeAmountCents")::bigint   AS "feesCents"
      FROM "Sale"
      WHERE status = 'APPROVED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
    GatewayService.getPlatformBalance().catch(() => ({ totalCents: 0, availableCents: 0 })),
  ])

  const gmvCents  = gmvPeriod._sum.grossAmountCents ?? 0
  const feesCents = gmvPeriod._sum.feeAmountCents   ?? 0
  const avgTicket = salesApprovedCount > 0 ? Math.round(gmvCents / salesApprovedCount) : 0
  const conversion = salesTotalCount > 0
    ? Math.round((salesApprovedCount / salesTotalCount) * 100)
    : 0

  return NextResponse.json({
    // Revenue (period)
    gmvPeriodCents:      gmvCents,
    feesPeriodCents:     feesCents,
    avgTicketCents:      avgTicket,
    salesApprovedCount,
    salesTotalCount,
    conversionRate:      conversion,
    // Users
    newUsersPeriod,
    totalUsers,
    completeUsers,
    // Platform (live)
    activeBots,
    activeSubscriptions,
    pendingWithdrawalsCount: pendingWithdrawals._count,
    pendingWithdrawalsCents: pendingWithdrawals._sum.amountCents ?? 0,
    asaasBalanceCents:       asaasBalance.totalCents,
    asaasAvailableCents:     asaasBalance.availableCents,
    // Chart
    dailySeries: dailySeries.map((r) => ({
      date:      r.date.toISOString().slice(0, 10),
      gmvCents:  Number(r.gmvCents),
      feesCents: Number(r.feesCents),
    })),
  })
}
