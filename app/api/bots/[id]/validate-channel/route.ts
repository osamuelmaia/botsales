import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/utils"

type Params = { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
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

  let channelId: string
  try {
    const body = await request.json()
    channelId = String(body.channelId ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!channelId) {
    return NextResponse.json({ error: "ID do grupo é obrigatório" }, { status: 422 })
  }

  let token: string
  try {
    token = decryptToken(bot.tokenEncrypted)
  } catch {
    return NextResponse.json({ error: "Erro ao descriptografar token do bot" }, { status: 500 })
  }

  // First get the bot's own ID via getMe
  let botTelegramId: number
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    const meJson = await meRes.json()
    if (!meJson.ok) {
      return NextResponse.json({ valid: false, error: "Token do bot inválido" })
    }
    botTelegramId = meJson.result.id
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError"
      ? "Tempo limite atingido ao conectar com o Telegram. Tente novamente."
      : "Erro ao conectar com o Telegram"
    return NextResponse.json({ valid: false, error: msg })
  }

  // Check if the bot is admin in the group with can_restrict_members
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${channelId}&user_id=${botTelegramId}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    )
    const json = await res.json()

    if (!json.ok) {
      return NextResponse.json({
        valid: false,
        error: json.description ?? "Grupo não encontrado ou bot não é membro",
      })
    }

    const member = json.result
    const isAdmin =
      member.status === "administrator" || member.status === "creator"
    const canRestrict = member.can_restrict_members === true || member.status === "creator"

    if (!isAdmin) {
      return NextResponse.json({
        valid: false,
        error: "O bot não é administrador neste grupo",
      })
    }

    if (!canRestrict) {
      return NextResponse.json({
        valid: false,
        error: "O bot precisa da permissão 'Banir membros' no grupo",
      })
    }

    // Get chat info for name
    let chatTitle = channelId
    try {
      const chatRes = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${channelId}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) }
      )
      const chatJson = await chatRes.json()
      if (chatJson.ok) chatTitle = chatJson.result.title ?? channelId
    } catch {
      // non-critical
    }

    return NextResponse.json({ valid: true, chatTitle })
  } catch {
    return NextResponse.json({ valid: false, error: "Erro ao validar grupo no Telegram" })
  }
}
