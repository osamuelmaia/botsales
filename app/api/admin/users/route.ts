import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type SaleStatRow = {
  userid:   string
  total:    bigint
  approved: bigint
  gmv:      bigint
  pix:      bigint
  card:     bigint
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const search = searchParams.get("search")?.trim() ?? ""
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where = search
    ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, email: true,
        document: true, phone: true,
        registrationStep: true, role: true,
        platformFeePercent: true, platformFeeCents: true,
        withdrawalDays: true, personType: true,
        createdAt: true,
        _count: { select: { bots: true, products: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Per-user sales breakdown (only for this page's user IDs)
  const userIds = users.map((u) => u.id)
  const statsMap = new Map<string, { total: number; approved: number; gmv: number; pix: number; card: number }>()
  if (userIds.length > 0) {
    const rows = await prisma.$queryRaw<SaleStatRow[]>`
      SELECT
        "userId"                                                                          AS userid,
        COUNT(*)::bigint                                                                  AS total,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::bigint                              AS approved,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE status = 'APPROVED'), 0)::bigint  AS gmv,
        COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'PIX')::bigint  AS pix,
        COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'CREDIT_CARD')::bigint AS card
      FROM "Sale"
      WHERE "userId" = ANY(${userIds})
      GROUP BY "userId"
    `
    for (const r of rows) {
      statsMap.set(r.userid, {
        total:    Number(r.total),
        approved: Number(r.approved),
        gmv:      Number(r.gmv),
        pix:      Number(r.pix),
        card:     Number(r.card),
      })
    }
  }

  const empty = { total: 0, approved: 0, gmv: 0, pix: 0, card: 0 }

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      platformFeePercent: Number(u.platformFeePercent),
      createdAt: u.createdAt.toISOString(),
      salesStats: statsMap.get(u.id) ?? empty,
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
