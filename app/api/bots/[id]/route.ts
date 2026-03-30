import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { botUpdateSchema } from "@/lib/validations/bot"
import { encryptToken, decryptToken } from "@/lib/utils"

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      botProducts: {
        select: { productId: true },
        orderBy: { position: "asc" },
      },
    },
  })

  if (!bot) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    id: bot.id,
    name: bot.name,
    token: decryptToken(bot.tokenEncrypted),
    isActive: bot.isActive,
    productIds: bot.botProducts.map((bp) => bp.productId),
  })
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const existing = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = botUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, token, productIds, isActive } = parsed.data

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (token !== undefined) updateData.tokenEncrypted = encryptToken(token)
  if (isActive !== undefined) updateData.isActive = isActive

  const bot = await prisma.bot.update({
    where: { id: params.id },
    data: updateData,
  })

  if (productIds !== undefined) {
    await prisma.botProduct.deleteMany({ where: { botId: params.id } })
    if (productIds.length > 0) {
      await prisma.botProduct.createMany({
        data: productIds.map((productId, i) => ({
          botId: params.id,
          productId,
          position: i,
        })),
      })
    }
  }

  return NextResponse.json(bot)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!bot) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 })
  }

  if (bot.isActive) {
    return NextResponse.json(
      { error: "Desative o bot antes de excluir." },
      { status: 409 }
    )
  }

  await prisma.bot.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
