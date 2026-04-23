import { NextResponse, NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function parseDate(str: string | null, fallback: Date, endOfDay = false): Date {
  if (!str) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"))
  }
  return new Date(str)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const from = parseDate(searchParams.get("from"), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const to   = parseDate(searchParams.get("to"),   new Date(), true)

  const [
    totals,
    byMethod,
    renewalRow,
    contactsCount,
    buyerLeadsRow,
  ] = await Promise.all([
    // All approved sales in period
    prisma.sale.aggregate({
      where: { userId, status: "APPROVED", createdAt: { gte: from, lte: to } },
      _sum: { grossAmountCents: true, netAmountCents: true, feeAmountCents: true },
      _count: true,
    }),

    // Breakdown by payment method
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { userId, status: "APPROVED", createdAt: { gte: from, lte: to } },
      _sum: { grossAmountCents: true },
      _count: true,
    }),

    // Renewals: approved sales where the same lead+product had a previous approved sale
    prisma.$queryRaw<Array<{ gross: bigint; net: bigint; count: bigint }>>`
      SELECT
        COALESCE(SUM(s."grossAmountCents"), 0)::bigint AS gross,
        COALESCE(SUM(s."netAmountCents"),   0)::bigint AS net,
        COUNT(*)::bigint                              AS count
      FROM "Sale" s
      WHERE s."userId"    = ${userId}
        AND s.status      = 'APPROVED'
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        AND s."leadId"    IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "Sale" s2
          WHERE s2."leadId"    = s."leadId"
            AND s2."productId" = s."productId"
            AND s2.status      = 'APPROVED'
            AND s2."createdAt" < s."createdAt"
        )
    `,

    // Contacts: leads created in period for bots owned by this user
    prisma.lead.count({
      where: {
        bot: { userId },
        createdAt: { gte: from, lte: to },
      },
    }),

    // Unique leads with at least one approved sale in the period
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "leadId")::bigint AS count
      FROM "Sale"
      WHERE "userId"    = ${userId}
        AND status      = 'APPROVED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
        AND "leadId"    IS NOT NULL
    `,
  ])

  const card = byMethod.find((m) => m.paymentMethod === "CREDIT_CARD")
  const pix  = byMethod.find((m) => m.paymentMethod === "PIX")

  const buyerLeads    = Number(buyerLeadsRow[0]?.count ?? 0)
  const conversionPct = contactsCount > 0 ? (buyerLeads / contactsCount) * 100 : 0

  return NextResponse.json({
    gmvCents:          totals._sum.grossAmountCents ?? 0,
    netCents:          totals._sum.netAmountCents   ?? 0,
    feesCents:         totals._sum.feeAmountCents   ?? 0,
    salesCount:        totals._count,

    cardGmvCents:      card?._sum.grossAmountCents ?? 0,
    cardSalesCount:    card?._count ?? 0,
    pixGmvCents:       pix?._sum.grossAmountCents  ?? 0,
    pixSalesCount:     pix?._count ?? 0,

    renewalGmvCents:   Number(renewalRow[0]?.gross ?? 0),
    renewalNetCents:   Number(renewalRow[0]?.net   ?? 0),
    renewalSalesCount: Number(renewalRow[0]?.count ?? 0),

    contactsCount,
    buyerLeadsCount:   buyerLeads,
    conversionPct,
  })
}
