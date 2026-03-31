import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/utils"
import { registerWebhook, deleteWebhook } from "@/lib/bot-runner"

type Params = { params: { id: string } }

/**
 * PATCH /api/bots/:id/toggle
 * Body: { isActive: boolean }
 *
 * Toggles the bot's active state.
 * - Activating: registers Telegram webhook (production/Vercel mode)
 * - Deactivating: deletes Telegram webhook
 *
 * In local worker mode (npx ts-node workers/bot-worker.ts),
 * the worker itself manages grammy polling based on the `isActive` flag in the DB.
 */
export async function PATCH(request: Request, { params }: Params) {
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

  let body: { isActive: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive deve ser boolean" }, { status: 400 })
  }

  const { isActive } = body
  const token = decryptToken(bot.tokenEncrypted)

  if (isActive) {
    // Register Telegram webhook so updates reach /api/telegram/[botId]
    const result = await registerWebhook(token, params.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: `Não foi possível ativar o bot: ${result.description ?? "verifique o token"}` },
        { status: 400 }
      )
    }
  } else {
    await deleteWebhook(token)
  }

  const updated = await prisma.bot.update({
    where: { id: params.id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  })

  return NextResponse.json(updated)
}
