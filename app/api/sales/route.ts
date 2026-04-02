import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const startDate   = searchParams.get("startDate")
  const endDate     = searchParams.get("endDate")
  const status      = searchParams.get("status")
  const method      = searchParams.get("paymentMethod")
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where: Prisma.SaleWhereInput = { userId }

  if (startDate) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: new Date(startDate) }
  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    where.createdAt = { ...((where.createdAt as object) ?? {}), lte: end }
  }
  if (status && status !== "ALL") where.status = status as Prisma.EnumSaleStatusFilter
  if (method && method !== "ALL") where.paymentMethod = method as Prisma.EnumPaymentMethodFilter

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lead: { select: { name: true, email: true, phone: true } },
        product: { select: { name: true } },
        bot: { select: { name: true } },
      },
    }),
    prisma.sale.count({ where }),
  ])

  return NextResponse.json({
    sales,
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
