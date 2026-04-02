import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const userId       = searchParams.get("userId")
  const status       = searchParams.get("status")
  const method       = searchParams.get("paymentMethod")
  const startDate    = searchParams.get("startDate")
  const endDate      = searchParams.get("endDate")
  const search       = searchParams.get("search")?.trim() ?? "" // seller name/email
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where: Prisma.SaleWhereInput = {}

  if (userId)                     where.userId        = userId
  if (status && status !== "ALL") where.status        = status as Prisma.EnumSaleStatusFilter
  if (method && method !== "ALL") where.paymentMethod = method as Prisma.EnumPaymentMethodFilter
  if (startDate) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: new Date(startDate) }
  if (endDate) {
    const end = new Date(endDate); end.setHours(23, 59, 59, 999)
    where.createdAt = { ...((where.createdAt as object) ?? {}), lte: end }
  }
  if (search) {
    where.user = {
      OR: [
        { name:  { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user:    { select: { id: true, name: true, email: true } },
        lead:    { select: { name: true, email: true, phone: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.sale.count({ where }),
  ])

  return NextResponse.json({
    sales: sales.map((s) => ({
      ...s,
      createdAt:         s.createdAt.toISOString(),
      updatedAt:         s.updatedAt.toISOString(),
      paidAt:            s.paidAt?.toISOString()         ?? null,
      availableAt:       s.availableAt?.toISOString()    ?? null,
      refundedAt:        s.refundedAt?.toISOString()     ?? null,
      pendingFlowFiredAt: s.pendingFlowFiredAt?.toISOString() ?? null,
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
