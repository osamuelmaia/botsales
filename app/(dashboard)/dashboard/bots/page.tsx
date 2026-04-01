import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { BotsClient } from "./BotsClient"

export default async function BotsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, isActive: true, createdAt: true,
      _count: { select: { botProducts: true } },
    },
  })

  // Serialize dates for client component
  const serialized = bots.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))

  return <BotsClient initialBots={serialized} />
}
