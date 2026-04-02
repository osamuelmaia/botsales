import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const search = searchParams.get("search")?.trim() ?? ""
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const where = search
    ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, email: true,
        document: true, phone: true,
        registrationStep: true, role: true,
        platformFeePercent: true, platformFeeCents: true,
        withdrawalDays: true, personType: true,
        createdAt: true,
        _count: { select: { bots: true, products: true, sales: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      platformFeePercent: Number(u.platformFeePercent),
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
