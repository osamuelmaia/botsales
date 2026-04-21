import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { FinanceiroClient } from "./FinanceiroClient"

type MonthRow    = { month: Date; gmv: bigint; fees: bigint; net: bigint; count: bigint }
type TotalsRow   = { gmv: bigint; fees: bigint; net: bigint; count: bigint; pixcount: bigint; pixgmv: bigint; cardcount: bigint; cardgmv: bigint }
type WithdrawRow = { status: string; count: bigint; total: bigint }
type SellerRow   = { id: string; name: string; email: string; gmv: bigint; fees: bigint; net: bigint; sales: bigint }

async function fetchFinanceiro() {
  const [totalsRows, monthlyRows, withdrawRows, sellerRows, pendingWithdrawals] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>`
      SELECT
        COALESCE(SUM("grossAmountCents"), 0)::bigint                                                     AS gmv,
        COALESCE(SUM("feeAmountCents"), 0)::bigint                                                       AS fees,
        COALESCE(SUM("netAmountCents"), 0)::bigint                                                       AS net,
        COUNT(*)::bigint                                                                                  AS count,
        COUNT(*) FILTER (WHERE "paymentMethod" = 'PIX')::bigint                                          AS pixcount,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE "paymentMethod" = 'PIX'), 0)::bigint              AS pixgmv,
        COUNT(*) FILTER (WHERE "paymentMethod" = 'CREDIT_CARD')::bigint                                  AS cardcount,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE "paymentMethod" = 'CREDIT_CARD'), 0)::bigint      AS cardgmv
      FROM "Sale"
      WHERE status = 'APPROVED'
    `,
    prisma.$queryRaw<MonthRow[]>`
      SELECT
        DATE_TRUNC('month', "paidAt")            AS month,
        COALESCE(SUM("grossAmountCents"), 0)::bigint AS gmv,
        COALESCE(SUM("feeAmountCents"), 0)::bigint   AS fees,
        COALESCE(SUM("netAmountCents"), 0)::bigint   AS net,
        COUNT(*)::bigint                             AS count
      FROM "Sale"
      WHERE status = 'APPROVED'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "paidAt")
      ORDER BY month ASC
    `,
    prisma.$queryRaw<WithdrawRow[]>`
      SELECT status, COUNT(*)::bigint AS count, COALESCE(SUM("amountCents"), 0)::bigint AS total
      FROM "Withdrawal"
      GROUP BY status
    `,
    prisma.$queryRaw<SellerRow[]>`
      SELECT
        u.id, u.name, u.email,
        COALESCE(SUM(s."grossAmountCents"), 0)::bigint AS gmv,
        COALESCE(SUM(s."feeAmountCents"), 0)::bigint   AS fees,
        COALESCE(SUM(s."netAmountCents"), 0)::bigint   AS net,
        COUNT(s.id)::bigint                            AS sales
      FROM "Sale" s
      JOIN "User" u ON s."userId" = u.id
      WHERE s.status = 'APPROVED'
      GROUP BY u.id, u.name, u.email
      ORDER BY gmv DESC
      LIMIT 10
    `,
    prisma.withdrawal.aggregate({
      where: { status: "REQUESTED" },
      _count: true,
      _sum: { amountCents: true },
    }),
  ])

  const t = totalsRows[0]

  return {
    totals: {
      gmv:       Number(t?.gmv  ?? 0),
      fees:      Number(t?.fees ?? 0),
      net:       Number(t?.net  ?? 0),
      count:     Number(t?.count ?? 0),
      pixCount:  Number(t?.pixcount ?? 0),
      pixGmv:   Number(t?.pixgmv ?? 0),
      cardCount: Number(t?.cardcount ?? 0),
      cardGmv:  Number(t?.cardgmv ?? 0),
    },
    monthly: monthlyRows.map((r) => ({
      month: r.month instanceof Date ? r.month.toISOString().slice(0, 7) : String(r.month).slice(0, 7),
      gmv:   Number(r.gmv),
      fees:  Number(r.fees),
      net:   Number(r.net),
      count: Number(r.count),
    })),
    withdrawals: withdrawRows.map((r) => ({
      status: r.status,
      count:  Number(r.count),
      total:  Number(r.total),
    })),
    sellers: sellerRows.map((r) => ({
      id:    r.id,
      name:  r.name,
      email: r.email,
      gmv:   Number(r.gmv),
      fees:  Number(r.fees),
      net:   Number(r.net),
      sales: Number(r.sales),
    })),
    pendingWithdrawalsCount: pendingWithdrawals._count,
    pendingWithdrawalsCents: pendingWithdrawals._sum.amountCents ?? 0,
  }
}

export default async function FinanceiroPage() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard")
  const data = await fetchFinanceiro()
  return <FinanceiroClient data={data} />
}
