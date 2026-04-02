import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomersAdmin } from "./CustomersAdmin"

export default async function AdminCustomersPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, email: true, username: true,
        phone: true, telegramId: true, createdAt: true,
        portalPasswordHash: true,
        bot: {
          select: {
            id: true, name: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true, status: true, currentPeriodEnd: true,
            product: { select: { name: true } },
          },
        },
        _count: { select: { sales: true } },
      },
    }),
    prisma.lead.count(),
  ])

  const initialData = leads.map((l) => ({
    id:              l.id,
    name:            l.name,
    email:           l.email,
    username:        l.username,
    phone:           l.phone,
    telegramId:      l.telegramId,
    createdAt:       l.createdAt.toISOString(),
    hasPortalAccess: !!l.portalPasswordHash,
    bot:             l.bot,
    latestSub:       l.subscriptions[0]
      ? { ...l.subscriptions[0], currentPeriodEnd: l.subscriptions[0].currentPeriodEnd.toISOString() }
      : null,
    salesCount:      l._count.sales,
  }))

  return <CustomersAdmin initialData={initialData} initialTotal={total} />
}
