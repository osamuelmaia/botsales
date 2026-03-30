import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"

type Params = { params: { id: string } }

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["start", "message", "delay", "payment"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
})

const saveFlowSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
})

// ─── Type map ─────────────────────────────────────────────────────────────────

const TYPE_TO_ENUM = {
  start: "TRIGGER_START",
  message: "MESSAGE",
  delay: "SMART_DELAY",
  payment: "PAYMENT",
} as const

const ENUM_TO_TYPE = {
  TRIGGER_START: "start",
  MESSAGE: "message",
  SMART_DELAY: "delay",
  PAYMENT: "payment",
} as const

// ─── GET /api/bots/[id]/flow ──────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      flowNodes: true,
      flowEdges: true,
    },
  })

  if (!bot) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 })
  }

  // If no nodes exist yet, return a default /start node
  if (bot.flowNodes.length === 0) {
    return NextResponse.json({
      nodes: [
        {
          id: "start-default",
          type: "start",
          position: { x: 250, y: 100 },
          data: { label: "/start" },
          deletable: false,
        },
      ],
      edges: [],
    })
  }

  const nodes = bot.flowNodes.map((n) => ({
    id: n.id,
    type: ENUM_TO_TYPE[n.type],
    position: { x: n.posX, y: n.posY },
    data: n.data as Record<string, unknown>,
    ...(n.type === "TRIGGER_START" ? { deletable: false } : {}),
  }))

  const edges = bot.flowEdges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "deletable",
    ...(e.label ? { label: e.label } : {}),
  }))

  return NextResponse.json({ nodes, edges })
}

// ─── POST /api/bots/[id]/flow ─────────────────────────────────────────────────

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const parsed = saveFlowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 422 }
    )
  }

  const { nodes, edges } = parsed.data

  // Ensure exactly one start node
  const startNodes = nodes.filter((n) => n.type === "start")
  if (startNodes.length !== 1) {
    return NextResponse.json(
      { error: "O fluxo deve ter exatamente um nó de início (/start)" },
      { status: 422 }
    )
  }

  // Ensure start node has channelId configured
  const startNodeChannelId = (startNodes[0].data as Record<string, unknown>).channelId as string | undefined
  if (!startNodeChannelId?.trim()) {
    return NextResponse.json(
      { error: "Configure o ID do grupo/canal no nó de Início antes de salvar" },
      { status: 422 }
    )
  }

  // Filter edges to only include those where both source and target exist in nodes
  const nodeIds = new Set(nodes.map((n) => n.id))
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  // Full replace inside a sequential transaction + sync channelId to bot
  await prisma.$transaction(async (tx) => {
    await tx.bot.update({
      where: { id: params.id },
      data: { channelId: startNodeChannelId.trim() },
    })
    await tx.flowEdge.deleteMany({ where: { botId: params.id } })
    await tx.flowNode.deleteMany({ where: { botId: params.id } })
    await tx.flowNode.createMany({
      data: nodes.map((n) => ({
        id: n.id,
        botId: params.id,
        type: TYPE_TO_ENUM[n.type],
        posX: n.position.x,
        posY: n.position.y,
        data: n.data as Prisma.InputJsonValue,
      })),
    })
    await tx.flowEdge.createMany({
      data: validEdges.map((e) => ({
        id: e.id,
        botId: params.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        label: e.label,
      })),
    })
  })

  return NextResponse.json({ ok: true })
}
