import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UsersClient } from "./UsersClient"

type SaleStatRow = {
  userid: string; total: bigint; approved: bigint; gmv: bigint; pix: bigint; card: bigint
}

export default async function AdminUsersPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, name: true, email: true, document: true,
        registrationStep: true, role: true,
        platformFeePercent: true, platformFeeCents: true,
        createdAt: true,
        _count: { select: { bots: true, products: true } },
      },
    }),
    prisma.user.count(),
  ])

  const userIds = users.map((u) => u.id)
  const statsRows = userIds.length > 0
    ? await prisma.$queryRaw<SaleStatRow[]>`
        SELECT
          "userId" AS userid,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::bigint AS approved,
          COALESCE(SUM("grossAmountCents") FILTER (WHERE status = 'APPROVED'), 0)::bigint AS gmv,
          COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'PIX')::bigint AS pix,
          COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'CREDIT_CARD')::bigint AS card
        FROM "Sale"
        WHERE "userId" = ANY(${userIds})
        GROUP BY "userId"
      `
    : []

  const statsMap = new Map(statsRows.map((r) => [r.userid, {
    total: Number(r.total), approved: Number(r.approved),
    gmv: Number(r.gmv), pix: Number(r.pix), card: Number(r.card),
  }]))
  const empty = { total: 0, approved: 0, gmv: 0, pix: 0, card: 0 }

  const initialData = users.map((u) => ({
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    document:           u.document,
    registrationStep:   u.registrationStep,
    role:               u.role,
    platformFeePercent: Number(u.platformFeePercent),
    platformFeeCents:   u.platformFeeCents,
    createdAt:          u.createdAt.toISOString(),
    _count:             u._count,
    salesStats:         statsMap.get(u.id) ?? empty,
  }))

  return <UsersClient initialData={initialData} initialTotal={total} />
}
