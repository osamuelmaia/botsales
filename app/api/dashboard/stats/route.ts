import { NextResponse, NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const to   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : now
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const stats = await prisma.sale.aggregate({
    where: { userId, status: "APPROVED", paidAt: { gte: from, lte: to } },
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
