import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { remarketingFlow: true, gracePeriodDays: true },
  })

  if (!bot) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    remarketingFlow: bot.remarketingFlow ?? { nodes: [], edges: [] },
    gracePeriodDays: bot.gracePeriodDays,
  })
}

export async function POST(request: Request, { params }: Params) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  const { nodes, edges } = body as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return NextResponse.json({ error: "nodes e edges são obrigatórios" }, { status: 400 })
  }

  const bot = await prisma.bot.update({
    where: { id: params.id },
    data: { remarketingFlow: { nodes, edges } },
    select: { remarketingFlow: true, gracePeriodDays: true },
  })

  return NextResponse.json({
    remarketingFlow: bot.remarketingFlow,
    gracePeriodDays: bot.gracePeriodDays,
  })
}
