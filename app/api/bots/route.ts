import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { botCreateSchema } from "@/lib/validations/bot"
import { encryptToken } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { botProducts: true } },
    },
  })

  return NextResponse.json(bots)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = botCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, token, channelId, productIds } = parsed.data

  const bot = await prisma.bot.create({
    data: {
      userId: session.user.id,
      name,
      tokenEncrypted: encryptToken(token),
      channelId: channelId || null,
    },
  })

  if (productIds && productIds.length > 0) {
    await prisma.botProduct.createMany({
      data: productIds.map((productId, i) => ({
        botId: bot.id,
        productId,
        position: i,
      })),
    })
  }

  return NextResponse.json(bot, { status: 201 })
}
