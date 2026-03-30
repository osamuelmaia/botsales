import { prisma } from "./prisma"
import { decryptToken } from "./utils"

const TG = "https://api.telegram.org/bot"

interface Block {
  id: string
  type: "text" | "image" | "video"
  content: string
  button?: string
}

type NodeData = Record<string, unknown>

async function tg(token: string, method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${TG}${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })
    return res.json()
  } catch {
    // ignore individual send failures — continue flow
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function toMs(amount: number, unit: string): number {
  const map: Record<string, number> = {
    seconds: 1000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  }
  return amount * (map[unit] ?? 1000)
}

export async function executeFlow(botId: string, chatId: number, firstName: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { flowNodes: true, flowEdges: true },
  })
  if (!bot || !bot.isActive) return

  const token = decryptToken(bot.tokenEncrypted)
  const nodeMap = new Map(bot.flowNodes.map((n) => [n.id, n]))

  // Build adjacency: sourceNodeId → targetNodeId[]
  const adj = new Map<string, string[]>()
  for (const e of bot.flowEdges) {
    if (!adj.has(e.sourceNodeId)) adj.set(e.sourceNodeId, [])
    adj.get(e.sourceNodeId)!.push(e.targetNodeId)
  }

  const startNode = bot.flowNodes.find((n) => n.type === "TRIGGER_START")
  if (!startNode) return

  const visited = new Set<string>()
  let currentId: string | null = startNode.id

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)

    const node = nodeMap.get(currentId)
    if (!node) break

    const data = node.data as NodeData

    // ── MESSAGE ──────────────────────────────────────────────────────────────
    if (node.type === "MESSAGE") {
      const blocks = (data.blocks as Block[]) ?? []
      for (const block of blocks) {
        if (!block.content?.trim()) continue

        if (block.type === "text") {
          const payload: Record<string, unknown> = {
            chat_id: chatId,
            text: block.content,
            parse_mode: "HTML",
          }
          if (block.button?.trim()) {
            payload.reply_markup = {
              inline_keyboard: [
                [{ text: block.button, callback_data: `btn:${botId}:${currentId}` }],
              ],
            }
          }
          await tg(token, "sendMessage", payload)
        } else if (block.type === "image") {
          await tg(token, "sendPhoto", {
            chat_id: chatId,
            photo: block.content,
          })
        } else if (block.type === "video") {
          await tg(token, "sendVideo", {
            chat_id: chatId,
            video: block.content,
          })
        }
      }
    }

    // ── SMART_DELAY ───────────────────────────────────────────────────────────
    else if (node.type === "SMART_DELAY") {
      const ms = Math.min(
        toMs((data.amount as number) ?? 1, (data.unit as string) ?? "seconds"),
        8_000 // cap at 8s in serverless
      )
      if (ms > 0) await sleep(ms)
    }

    // ── PAYMENT ───────────────────────────────────────────────────────────────
    else if (node.type === "PAYMENT") {
      const productId = data.productId as string | undefined
      if (productId) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
        const paymentUrl = `${baseUrl}/pay/${productId}?chatId=${chatId}&botId=${botId}`
        const ctaText = (data.ctaText as string) || "Pagar agora"
        const salesText = (data.text as string) || ""
        const image = data.image as string | undefined

        if (image) {
          await tg(token, "sendPhoto", {
            chat_id: chatId,
            photo: image,
            caption: salesText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{ text: ctaText, url: paymentUrl }]],
            },
          })
        } else {
          await tg(token, "sendMessage", {
            chat_id: chatId,
            text: salesText || `Clique abaixo para adquirir o produto:`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{ text: ctaText, url: paymentUrl }]],
            },
          })
        }
      }
    }

    // Advance to next node (first outgoing edge)
    currentId = adj.get(currentId)?.[0] ?? null
  }
}

export async function registerWebhook(token: string, botId: string): Promise<{ ok: boolean; description?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const url = `${baseUrl}/api/telegram/${botId}`
  const res = await fetch(`${TG}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: botId,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
    signal: AbortSignal.timeout(10000),
  })
  return res.json()
}

export async function deleteWebhook(token: string): Promise<void> {
  await fetch(`${TG}${token}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: true }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {})
}
