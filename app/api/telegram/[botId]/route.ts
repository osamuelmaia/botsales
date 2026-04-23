import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/utils"
import { handleStartCommand, resumeFlowFromButton } from "@/lib/bot-runner"

type Params = { params: { botId: string } }

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    from?: { id: number; first_name: string; username?: string }
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number; first_name: string }
    message?: { chat: { id: number } }
    data?: string
  }
}

export async function POST(request: Request, { params }: Params) {
  // Validate secret token set during webhook registration
  const secret = request.headers.get("x-telegram-bot-api-secret-token")
  if (secret !== params.botId) {
    return NextResponse.json({ ok: true })
  }

  const bot = await prisma.bot.findUnique({ where: { id: params.botId } })
  if (!bot || !bot.isActive) return NextResponse.json({ ok: true })

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  const token = decryptToken(bot.tokenEncrypted)

  // ── /start command ────────────────────────────────────────────────────────
  if (update.message?.text === "/start" && update.message.chat) {
    const chatId = update.message.chat.id
    const from = update.message.from
    const firstName = from?.first_name ?? "amigo"
    const username = from?.username

    await prisma.lead.upsert({
      where: { botId_telegramId: { botId: bot.id, telegramId: String(chatId) } },
      create: { botId: bot.id, telegramId: String(chatId), name: firstName, username },
      update: { name: firstName, username },
    })

    await handleStartCommand(bot.id, chatId)
  }

  // ── callback_query (inline button press) ──────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query
    const chatId = cq.message?.chat?.id

    // Answer immediately to dismiss the loading spinner
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cq.id }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})

    // Resume flow if this is a flow-mode button: data = "flow:<nodeId>:<btnId>"
    if (chatId && cq.data?.startsWith("flow:")) {
      await resumeFlowFromButton(bot.id, chatId, cq.data)
    }
  }

  return NextResponse.json({ ok: true })
}
