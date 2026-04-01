import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SalesClient } from "./SalesClient"

function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function SalesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const startDate = thirtyDaysAgo()
  const endDate = todayStr()
  const limit = 50

  const startDt = new Date(startDate)
  const endDt = new Date(endDate)
  endDt.setHours(23, 59, 59, 999)

  const where = { userId, createdAt: { gte: startDt, lte: endDt } }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        lead: { select: { name: true, email: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.sale.count({ where }),
  ])

  const initialData = {
    sales: sales.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      availableAt: s.availableAt?.toISOString() ?? null,
    })),
    total,
    pages: Math.ceil(total / limit),
    page: 1,
  }

  return <SalesClient initialData={initialData} initialStartDate={startDate} />
}
