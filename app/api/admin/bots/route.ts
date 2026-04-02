import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const userId   = searchParams.get("userId")
  const isActive = searchParams.get("isActive")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where: { userId?: string; isActive?: boolean } = {}
  if (userId) where.userId = userId
  if (isActive === "true")  where.isActive = true
  if (isActive === "false") where.isActive = false

  const [bots, total] = await Promise.all([
    prisma.bot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, isActive: true,
        channelId: true, gracePeriodDays: true,
        createdAt: true, userId: true,
        // tokenEncrypted is intentionally excluded
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { leads: true, flowNodes: true, flowEdges: true } },
      },
    }),
    prisma.bot.count({ where }),
  ])

  return NextResponse.json({
    bots: bots.map((b) => ({
      ...b,
      createdAt:       b.createdAt.toISOString(),
      channelConfigured: !!b.channelId,
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
