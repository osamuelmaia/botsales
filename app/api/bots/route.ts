import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { botCreateSchema } from "@/lib/validations/bot"
import { encryptToken } from "@/lib/utils"

function generateShortId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(16)
  let id = ""
  for (let i = 0; i < bytes.length && id.length < 8; i++) {
    const b = bytes[i]
    if (b < 186) id += chars[b % 62]
  }
  return id.padEnd(8, "A")
}

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
      shortId: true,
      name: true,
      isActive: true,
      createdAt: true,
      channelPermissionError: true,
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

  const { name, token, productIds } = parsed.data

  const bot = await prisma.bot.create({
    data: {
      userId: session.user.id,
      shortId: generateShortId(),
      name,
      tokenEncrypted: encryptToken(token),
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
