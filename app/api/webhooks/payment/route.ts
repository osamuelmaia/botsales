import { NextRequest, NextResponse } from "next/server"
import { GatewayService } from "@/lib/gateway"
import { prisma } from "@/lib/prisma"
import { executeFlow } from "@/lib/bot-runner"
import { TelegramService } from "@/lib/telegram"
import { decryptToken } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// ─── Continue flow from PAYMENT node after a payment event ──────────────────

async function resumeFlowFromPayment(
  saleId: string,
  handle: "approved" | "refused" | "refunded"
): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { botId: true, tgChatId: true, paymentNodeId: true },
  })

  // Only resume if the sale was created from a bot flow (has context)
  if (!sale?.botId || !sale.tgChatId || !sale.paymentNodeId) return

  const chatId = parseInt(sale.tgChatId, 10)
  if (isNaN(chatId)) return

  // Find the edge leaving the PAYMENT node via the appropriate handle
  const edge = await prisma.flowEdge.findFirst({
    where: {
      botId: sale.botId,
      sourceNodeId: sale.paymentNodeId,
      sourceHandle: handle,
    },
  })

  if (!edge) return

  // Resume the flow from the target node
  await executeFlow(sale.botId, chatId, edge.targetNodeId)
}

// ─── Subscription lifecycle helpers ──────────────────────────────────────────

/**
 * Called when a recurring charge is confirmed.
 * - If subscription is ACTIVE: extends currentPeriodEnd by 30 days (monthly)
 * - If subscription is REMARKETING or KICKED: lift ban, send invite link, mark ACTIVE
 */
async function handleSubscriptionRenewal(gatewayChargeId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { gatewayChargeId },
    include: { bot: true },
  })
  if (!subscription) return

  const newPeriodEnd = new Date(subscription.currentPeriodEnd)
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

  const token = decryptToken(subscription.bot.tokenEncrypted)

  if (subscription.status === "KICKED") {
    // User was banned — lift ban and send fresh invite link
    try {
      await TelegramService.unbanChatMember(token, subscription.groupTgChatId, subscription.tgUserId)
      const inviteLink = await TelegramService.createChatInviteLink(token, subscription.groupTgChatId)
      await TelegramService.sendMessage(
        token,
        parseInt(subscription.tgUserId, 10),
        `✅ Sua assinatura foi renovada! Use o link abaixo para acessar o grupo:\n${inviteLink}`
      )
    } catch (err) {
      console.error("[handleSubscriptionRenewal] unban failed:", err)
    }
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      currentPeriodEnd: newPeriodEnd,
      remarketingStart: null,
    },
  })

  console.log(`[subscription] renewed ${subscription.id} → new period end ${newPeriodEnd.toISOString()}`)
}

/**
 * Called when a recurring charge is refused.
 * Marks subscription as REMARKETING (worker handles the grace period kick).
 */
async function handleSubscriptionRefused(gatewayChargeId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { gatewayChargeId, status: "ACTIVE" },
  })
  if (!subscription) return

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "REMARKETING", remarketingStart: new Date() },
  })

  console.log(`[subscription] refused ${subscription.id} → REMARKETING`)
}

// ─── POST /api/webhooks/payment ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Read raw body (before any parsing)
  const rawBody = await req.text()

  // 2. Validate signature — Asaas sends configured token in `asaas-access-token`
  const signature = req.headers.get("asaas-access-token") ?? ""

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  let event
  try {
    event = GatewayService.parseWebhook(parsed, signature)
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  // Ignore unknown events
  if (event.type === "UNKNOWN" || !event.saleId) {
    return NextResponse.json({ ok: true })
  }

  // Find sale by externalReference (= Sale.id)
  const sale = await prisma.sale.findUnique({ where: { id: event.saleId } })
  if (!sale) {
    // Not our sale — return 200 so Asaas stops retrying
    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  if (event.type === "PAYMENT_CONFIRMED") {
    // availableAt: PIX = +1 dia útil / Cartão = +30 dias corridos
    const availableAt =
      event.paymentMethod === "PIX"
        ? addBusinessDays(now, 1)
        : addCalendarDays(now, 30)

    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: "APPROVED",
        gatewayId: event.gatewayId,
        gatewayStatus: "CONFIRMED",
        paidAt: now,
        availableAt,
      },
    })

    // Continue bot flow from "approved" handle — fire-and-forget
    resumeFlowFromPayment(sale.id, "approved").catch(console.error)

    // If this charge belongs to a recurring subscription, renew it
    if (event.gatewayId) {
      handleSubscriptionRenewal(event.gatewayId).catch(console.error)
    }

  } else if (event.type === "PAYMENT_REFUSED") {
    await prisma.sale.update({
      where: { id: sale.id },
      data: { status: "REFUSED", gatewayId: event.gatewayId, gatewayStatus: "REFUSED" },
    })

    resumeFlowFromPayment(sale.id, "refused").catch(console.error)

    // If this is a recurring subscription charge that was refused, start remarketing
    if (event.gatewayId) {
      handleSubscriptionRefused(event.gatewayId).catch(console.error)
    }

  } else if (event.type === "PAYMENT_REFUNDED") {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: "REFUNDED",
        gatewayId: event.gatewayId,
        gatewayStatus: "REFUNDED",
        refundedAt: now,
      },
    })

    resumeFlowFromPayment(sale.id, "refunded").catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
