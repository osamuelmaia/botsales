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

  const stats = await prisma.sale.aggregate({
    where: { userId, status: "APPROVED", createdAt: { gte: from, lte: to } },
    _sum: { grossAmountCents: true, feeAmountCents: true, netAmountCents: true },
    _count: true,
  })

  return NextResponse.json({
    gmvCents:   stats._sum.grossAmountCents ?? 0,
    feesCents:  stats._sum.feeAmountCents   ?? 0,
    netCents:   stats._sum.netAmountCents   ?? 0,
    salesCount: stats._count,
  })
}
