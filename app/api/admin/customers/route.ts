import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const search  = searchParams.get("search")?.trim() ?? ""
  const hasAccess = searchParams.get("hasAccess") // "true" | "false" | null = all
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name:     { contains: search, mode: "insensitive" } },
      { email:    { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ]
  }
  if (hasAccess === "true")  where.portalPasswordHash = { not: null }
  if (hasAccess === "false") where.portalPasswordHash = null

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, email: true, username: true,
        phone: true, telegramId: true, createdAt: true,
        portalPasswordHash: true, // used only to check truthiness
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
    prisma.lead.count({ where }),
  ])

  return NextResponse.json({
    leads: leads.map((l) => ({
      id:         l.id,
      name:       l.name,
      email:      l.email,
      username:   l.username,
      phone:      l.phone,
      telegramId: l.telegramId,
      createdAt:  l.createdAt.toISOString(),
      hasPortalAccess: !!l.portalPasswordHash,
      bot:        l.bot,
      latestSub:  l.subscriptions[0]
        ? {
            ...l.subscriptions[0],
            currentPeriodEnd: l.subscriptions[0].currentPeriodEnd.toISOString(),
          }
        : null,
      salesCount: l._count.sales,
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
