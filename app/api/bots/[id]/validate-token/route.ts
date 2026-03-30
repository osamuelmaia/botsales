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

  let token: string
  try {
    const body = await request.json()
    token = body.token ? String(body.token) : decryptToken(bot.tokenEncrypted)
  } catch {
    token = decryptToken(bot.tokenEncrypted)
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    })
    const json = await res.json()
    if (json.ok) {
      return NextResponse.json({ valid: true, botName: json.result.first_name })
    }
    return NextResponse.json({
      valid: false,
      error: json.description ?? "Token inválido",
    })
  } catch {
    return NextResponse.json({ valid: false, error: "Erro ao conectar com o Telegram" })
  }
}
