import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"

type Params = { params: { id: string } }

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["start", "text", "image", "video", "audio", "file", "typing", "button", "delay", "smart_delay", "payment", "grant_access"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  label: z.string().optional(),
})

const saveFlowSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
})

// ─── Type map ─────────────────────────────────────────────────────────────────

const TYPE_TO_ENUM: Record<string, string> = {
  start: "TRIGGER_START",
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
  file: "FILE",
  typing: "TYPING",
  button: "BUTTON",
  delay: "DELAY",
  smart_delay: "SMART_DELAY",
  payment: "PAYMENT",
  grant_access: "GRANT_ACCESS",
}

const ENUM_TO_TYPE: Record<string, string> = {
  TRIGGER_START: "start",
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  FILE: "file",
  TYPING: "typing",
  BUTTON: "button",
  DELAY: "delay",
  SMART_DELAY: "smart_delay",
  PAYMENT: "payment",
  GRANT_ACCESS: "grant_access",
}

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
          id: `start-${params.id}`,
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
    sourceHandle: e.sourceHandle ?? null,
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

  const { nodes: rawNodes, edges: rawEdges } = parsed.data

  // Remap legacy "start-default" id to a bot-specific id to avoid unique constraint conflicts
  const defaultStartId = `start-${params.id}`
  const idRemap = new Map<string, string>()
  const nodes = rawNodes.map((n) => {
    if (n.id === "start-default") { idRemap.set("start-default", defaultStartId); return { ...n, id: defaultStartId } }
    return n
  })
  const edges = rawEdges.map((e) => ({
    ...e,
    source: idRemap.get(e.source) ?? e.source,
    target: idRemap.get(e.target) ?? e.target,
  }))

  // Ensure exactly one start node
  const startNodes = nodes.filter((n) => n.type === "start")
  if (startNodes.length !== 1) {
    return NextResponse.json(
      { error: "O fluxo deve ter exatamente um nó de início (/start)" },
      { status: 422 }
    )
  }

  // Sync channelId to Bot from the first configured grant_access node
  const grantNode = nodes.find((n) => n.type === "grant_access")
  const grantChannelId = grantNode
    ? ((grantNode.data as Record<string, unknown>).channelId as string | undefined)?.trim() ?? null
    : null

  // Block save if there's an unconfigured grant_access node
  const hasUnconfiguredGrant = nodes.some(
    (n) => n.type === "grant_access" && !((n.data as Record<string, unknown>).channelId as string | undefined)?.trim()
  )
  if (hasUnconfiguredGrant) {
    return NextResponse.json(
      { error: "Configure o ID do grupo/canal no nó 'Liberar acesso ao canal' antes de salvar" },
      { status: 422 }
    )
  }

  // Filter edges to only include those where both source and target exist in nodes
  const nodeIds = new Set(nodes.map((n) => n.id))
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  // Full replace inside a batch transaction (compatible with Neon's PgBouncer pooler)
  await prisma.$transaction([
    prisma.bot.update({
      where: { id: params.id },
      data: { channelId: grantChannelId },
    }),
    prisma.flowEdge.deleteMany({ where: { botId: params.id } }),
    prisma.flowNode.deleteMany({ where: { botId: params.id } }),
    prisma.flowNode.createMany({
      data: nodes.map((n) => ({
        id: n.id,
        botId: params.id,
        type: TYPE_TO_ENUM[n.type] as import("@prisma/client").FlowNodeType,
        posX: n.position.x,
        posY: n.position.y,
        data: n.data as Prisma.InputJsonValue,
      })),
    }),
    prisma.flowEdge.createMany({
      data: validEdges.map((e) => ({
        id: e.id,
        botId: params.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceHandle: e.sourceHandle ?? null,
        label: e.label,
      })),
    }),
  ])

  return NextResponse.json({ ok: true })
}
