import { prisma } from "./prisma"
import { decryptToken } from "./utils"

const TG = "https://api.telegram.org/bot"

type FlowNode = { id: string; type: string; data: unknown }
type FlowEdge = { sourceNodeId: string; targetNodeId: string; sourceHandle?: string | null }
type BotWithFlow = {
  id: string
  isActive: boolean
  tokenEncrypted: string
  flowNodes: FlowNode[]
  flowEdges: FlowEdge[]
}

async function loadBot(botId: string): Promise<BotWithFlow | null> {
  return prisma.bot.findUnique({
    where: { id: botId },
    include: { flowNodes: true, flowEdges: true },
  })
}

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

// ─── Execute a single node ───────────────────────────────────────────────────

async function executeNode(
  token: string,
  botId: string,
  chatId: number,
  node: FlowNode
): Promise<void> {
  const data = node.data as Record<string, unknown>

  switch (node.type) {
    case "TEXT": {
      const content = (data.content as string) ?? ""
      if (content.trim()) {
        await tg(token, "sendMessage", {
          chat_id: chatId,
          text: content,
          parse_mode: "Markdown",
        })
      }
      break
    }

    case "IMAGE": {
      const url = (data.url as string) ?? ""
      if (url) {
        const caption = (data.caption as string) ?? ""
        await tg(token, "sendPhoto", {
          chat_id: chatId,
          photo: url,
          ...(caption ? { caption, parse_mode: "Markdown" } : {}),
        })
      }
      break
    }

    case "VIDEO": {
      const url = (data.url as string) ?? ""
      if (url) {
        const caption = (data.caption as string) ?? ""
        await tg(token, "sendVideo", {
          chat_id: chatId,
          video: url,
          ...(caption ? { caption, parse_mode: "Markdown" } : {}),
        })
      }
      break
    }

    case "AUDIO": {
      const url = (data.url as string) ?? ""
      if (url) {
        await tg(token, "sendAudio", { chat_id: chatId, audio: url })
      }
      break
    }

    case "FILE": {
      const url = (data.url as string) ?? ""
      if (url) {
        const caption = (data.caption as string) ?? ""
        await tg(token, "sendDocument", {
          chat_id: chatId,
          document: url,
          ...(caption ? { caption, parse_mode: "Markdown" } : {}),
        })
      }
      break
    }

    case "TYPING": {
      const duration = (data.duration as number) ?? 3
      const unit = (data.unit as string) ?? "seconds"
      const ms = Math.min(toMs(duration, unit), 8_000) // cap at 8s for serverless
      // Telegram clears typing after ~5s, so re-send every 4s
      let remaining = ms
      while (remaining > 0) {
        await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" })
        const chunk = Math.min(remaining, 4000)
        await sleep(chunk)
        remaining -= chunk
      }
      break
    }

    case "BUTTON": {
      type BtnItem = { id: string; label: string; mode: "url" | "flow"; url: string }
      const buttons: BtnItem[] = Array.isArray(data.buttons) ? (data.buttons as BtnItem[]) : []
      if (buttons.length > 0) {
        const keyboard = buttons
          .filter((b) => b.label)
          .map((b) =>
            b.mode === "url" && b.url
              ? [{ text: b.label, url: b.url }]
              : [{ text: b.label, callback_data: `flow:${node.id}:${b.id}` }]
          )
        if (keyboard.length > 0) {
          const msgText = (data.text as string) || "Escolha uma opção:"
          const image = data.image as string | undefined
          if (image) {
            await tg(token, "sendPhoto", {
              chat_id: chatId,
              photo: image,
              caption: msgText,
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: keyboard },
            })
          } else {
            await tg(token, "sendMessage", {
              chat_id: chatId,
              text: msgText,
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: keyboard },
            })
          }
        }
      }
      // Flow stops here when there are flow-mode buttons; continues via callback_query handling
      break
    }

    case "DELAY": {
      const ms = Math.min(
        toMs((data.amount as number) ?? 1, (data.unit as string) ?? "seconds"),
        8_000
      )
      if (ms > 0) await sleep(ms)
      break
    }

    case "SMART_DELAY": {
      const minMs = toMs((data.minAmount as number) ?? 1, (data.unit as string) ?? "seconds")
      const maxMs = toMs((data.maxAmount as number) ?? 5, (data.unit as string) ?? "seconds")
      const randomMs = Math.min(
        minMs + Math.random() * (maxMs - minMs),
        8_000
      )
      if (data.showTyping) {
        await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" })
      }
      if (randomMs > 0) await sleep(randomMs)
      break
    }

    case "PAYMENT": {
      const productId = data.productId as string | undefined
      if (productId) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
        const paymentUrl = `${baseUrl}/checkout/${productId}?chatId=${chatId}&botId=${botId}&nodeId=${node.id}`
        const ctaText = (data.ctaText as string) || "Pagar agora"
        const salesText = (data.text as string) || ""
        const image = data.image as string | undefined

        // web_app opens the URL as an in-app WebView popup inside Telegram (Mini App)
        // This is better for conversion than opening an external browser
        const webAppButton = { text: ctaText, web_app: { url: paymentUrl } }

        if (image) {
          await tg(token, "sendPhoto", {
            chat_id: chatId,
            photo: image,
            caption: salesText,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[webAppButton]] },
          })
        } else {
          await tg(token, "sendMessage", {
            chat_id: chatId,
            text: salesText || "Clique abaixo para adquirir o produto:",
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[webAppButton]] },
          })
        }
      }
      break
    }
  }
}

// ─── Flow traversal ──────────────────────────────────────────────────────────

async function runFlow(
  bot: BotWithFlow,
  chatId: number,
  startNodeId: string
) {
  const token = decryptToken(bot.tokenEncrypted)
  const nodeMap = new Map(bot.flowNodes.map((n) => [n.id, n]))

  // adjacency: sourceNodeId -> [{targetNodeId, sourceHandle}]
  const adj = new Map<string, { targetNodeId: string; sourceHandle?: string | null }[]>()
  for (const e of bot.flowEdges) {
    if (!adj.has(e.sourceNodeId)) adj.set(e.sourceNodeId, [])
    adj.get(e.sourceNodeId)!.push({
      targetNodeId: e.targetNodeId,
      sourceHandle: e.sourceHandle ?? null,
    })
  }

  const visited = new Set<string>()
  let currentId: string | null = startNodeId

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)

    const node = nodeMap.get(currentId)
    if (!node) break

    await executeNode(token, bot.id, chatId, node)

    // Payment node: stop here — flow continues via webhook
    if (node.type === "PAYMENT") break

    // Button node with flow-mode buttons: stop here — resumes on callback_query
    if (node.type === "BUTTON") {
      type BtnItem = { mode: string }
      const btns: BtnItem[] = Array.isArray((node.data as Record<string, unknown>).buttons)
        ? ((node.data as Record<string, unknown>).buttons as BtnItem[])
        : []
      if (btns.some((b) => b.mode === "flow")) break
    }

    // Follow first edge (non-payment nodes have a single output)
    const edges = adj.get(currentId)
    currentId = edges?.[0]?.targetNodeId ?? null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called when a user clicks a flow-mode inline button.
 * callback_data format: "flow:<buttonNodeId>:<buttonId>"
 */
export async function resumeFlowFromButton(botId: string, chatId: number, callbackData: string) {
  const [, nodeId, btnId] = callbackData.split(":")
  if (!nodeId || !btnId) return

  const bot = await loadBot(botId)
  if (!bot || !bot.isActive) return

  // Find the edge from this button node with the matching sourceHandle (= btnId)
  const edge = bot.flowEdges.find(
    (e) => e.sourceNodeId === nodeId && e.sourceHandle === btnId
  )
  if (!edge) return

  await runFlow(bot, chatId, edge.targetNodeId)
}

export async function executeFlow(botId: string, chatId: number, startNodeId?: string) {
  const bot = await loadBot(botId)
  if (!bot || !bot.isActive) return

  let firstNodeId: string | undefined = startNodeId

  if (!firstNodeId) {
    // Default: start from the node after TRIGGER_START
    const startNode = bot.flowNodes.find((n) => n.type === "TRIGGER_START")
    if (!startNode) return
    firstNodeId = bot.flowEdges.find((e) => e.sourceNodeId === startNode.id)?.targetNodeId
  }

  if (!firstNodeId) return
  await runFlow(bot, chatId, firstNodeId)
}

export async function registerWebhook(
  token: string,
  botId: string
): Promise<{ ok: boolean; description?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const res = await fetch(`${TG}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${baseUrl}/api/telegram/${botId}`,
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
