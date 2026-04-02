import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BotsAdmin } from "./BotsAdmin"

export default async function AdminBotsPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [bots, total] = await Promise.all([
    prisma.bot.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, isActive: true,
        channelId: true, gracePeriodDays: true,
        createdAt: true, userId: true,
        user:   { select: { id: true, name: true, email: true } },
        _count: { select: { leads: true, flowNodes: true, flowEdges: true } },
      },
    }),
    prisma.bot.count(),
  ])

  const initialData = bots.map((b) => ({
    id:                b.id,
    name:              b.name,
    isActive:          b.isActive,
    channelConfigured: !!b.channelId,
    gracePeriodDays:   b.gracePeriodDays,
    createdAt:         b.createdAt.toISOString(),
    userId:            b.userId,
    user:              b.user,
    _count:            b._count,
  }))

  return <BotsAdmin initialData={initialData} initialTotal={total} />
}
