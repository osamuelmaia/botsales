import { NextRequest, NextResponse } from "next/server"
import { GatewayService } from "@/lib/gateway"
import { prisma } from "@/lib/prisma"
import { executeFlow } from "@/lib/bot-runner"
import { TelegramService } from "@/lib/telegram"
import { decryptToken } from "@/lib/utils"
import { sendEmail, buildPortalAccessEmail, buildPurchaseConfirmationEmail } from "@/lib/email"
import bcrypt from "bcryptjs"
import crypto from "crypto"

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
  handle: "approved" | "refused" | "refunded" | "pending"
): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { botId: true, tgChatId: true, paymentNodeId: true },
  })

  if (!sale?.botId || !sale.tgChatId || !sale.paymentNodeId) return

  const chatId = parseInt(sale.tgChatId, 10)
  if (isNaN(chatId)) return

  const edge = await prisma.flowEdge.findFirst({
    where: {
      botId: sale.botId,
      sourceNodeId: sale.paymentNodeId,
      sourceHandle: handle,
    },
  })

  if (!edge) return

  await executeFlow(sale.botId, chatId, edge.targetNodeId)
}

// ─── Subscription lifecycle helpers ──────────────────────────────────────────

/**
 * Creates a Subscription record when a recurring product's first payment is confirmed.
 * Called only for card payments on recurring products.
 */
async function createSubscriptionRecord(
  sale: {
    id: string
    botId: string | null
    productId: string
    leadId: string | null
    tgChatId: string | null
    gatewayId: string | null
  },
  asaasSubscriptionId: string | null
): Promise<void> {
  if (!sale.botId || !sale.leadId || !sale.tgChatId) return

  // Check if subscription already exists for this sale
  const existing = await prisma.subscription.findFirst({
    where: { botId: sale.botId, leadId: sale.leadId, productId: sale.productId },
  })
  if (existing) return

  const bot = await prisma.bot.findUnique({ where: { id: sale.botId } })
  if (!bot?.channelId) return

  const now = new Date()
  const periodEnd = addCalendarDays(now, 30) // default 30 days for monthly

  await prisma.subscription.create({
    data: {
      botId: sale.botId,
      leadId: sale.leadId,
      productId: sale.productId,
      groupTgChatId: bot.channelId,
      tgUserId: sale.tgChatId,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
      gatewayChargeId: asaasSubscriptionId ?? sale.gatewayId,
    },
  })

  console.log(`[subscription] created for sale=${sale.id} lead=${sale.leadId}`)
}

/**
 * Called when a recurring charge is confirmed (renewal).
 * Uses the Asaas subscription ID to find our Subscription record.
 */
async function handleSubscriptionRenewal(
  asaasSubscriptionId: string,
  asaasPaymentId: string
): Promise<void> {
  // Find subscription by the Asaas subscription ID stored in gatewayChargeId
  const subscription = await prisma.subscription.findFirst({
    where: { gatewayChargeId: asaasSubscriptionId },
    include: { bot: true },
  })
  if (!subscription) {
    console.warn(`[subscription] renewal: no subscription found for asaas sub ${asaasSubscriptionId}`)
    return
  }

  const newPeriodEnd = new Date(subscription.currentPeriodEnd)
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

  const token = decryptToken(subscription.bot.tokenEncrypted)

  if (subscription.status === "KICKED") {
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
      gatewayChargeId: asaasSubscriptionId, // keep consistent
    },
  })

  console.log(`[subscription] renewed ${subscription.id} via payment ${asaasPaymentId} → new period end ${newPeriodEnd.toISOString()}`)
}

/**
 * Called when a recurring charge is refused.
 */
async function handleSubscriptionRefused(asaasSubscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { gatewayChargeId: asaasSubscriptionId, status: "ACTIVE" },
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
  const rawBody = await req.text()

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

  if (event.type === "UNKNOWN" || !event.saleId) {
    return NextResponse.json({ ok: true })
  }

  // Find sale by externalReference (= Sale.id)
  const sale = await prisma.sale.findUnique({ where: { id: event.saleId } })
  if (!sale) {
    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  // ── Idempotency: skip if already processed ─────────────────────────────
  if (event.type === "PAYMENT_CONFIRMED" && sale.status === "APPROVED") {
    return NextResponse.json({ ok: true })
  }
  if (event.type === "PAYMENT_REFUSED" && sale.status === "REFUSED") {
    return NextResponse.json({ ok: true })
  }
  if (event.type === "PAYMENT_REFUNDED" && sale.status === "REFUNDED") {
    return NextResponse.json({ ok: true })
  }

  if (event.type === "PAYMENT_CONFIRMED") {
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

    // Continue bot flow from "approved" handle
    resumeFlowFromPayment(sale.id, "approved").catch((err) =>
      console.error("[webhook] resumeFlowFromPayment failed:", err)
    )

    // Send portal access email to customer (fire-and-forget)
    ;(async () => {
      try {
        const fullSale = await prisma.sale.findUnique({
          where: { id: sale.id },
          select: {
            lead:    { select: { id: true, name: true, email: true, portalPasswordHash: true } },
            product: { select: { name: true } },
          },
        })
        if (!fullSale?.lead?.email) return

        const { lead, product } = fullSale
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://botsales.app"

        if (!lead.portalPasswordHash) {
          // First time: generate password, save hashed, send credentials email
          const password = crypto.randomBytes(5).toString("base64url").substring(0, 8)
          const hash     = await bcrypt.hash(password, 12)
          await prisma.lead.update({ where: { id: lead.id }, data: { portalPasswordHash: hash } })
          await sendEmail({
            to:      lead.email,
            subject: `Acesso liberado — ${product?.name ?? "seu produto"}`,
            html:    buildPortalAccessEmail({
              customerName: lead.name ?? "Cliente",
              email:        lead.email,
              password,
              productName:  product?.name ?? "produto",
              appUrl,
            }),
          })
        } else {
          // Returning customer: just confirm the payment
          await sendEmail({
            to:      lead.email,
            subject: `Pagamento confirmado — ${product?.name ?? "seu produto"}`,
            html:    buildPurchaseConfirmationEmail({
              customerName: lead.name ?? "Cliente",
              productName:  product?.name ?? "produto",
              appUrl,
            }),
          })
        }
      } catch (err) {
        console.error("[webhook] email send failed:", err)
      }
    })()

    // If this is a recurring product, create or renew Subscription
    if (event.subscriptionId) {
      // Check if this is the first payment (create) or renewal
      const existingSub = await prisma.subscription.findFirst({
        where: { gatewayChargeId: event.subscriptionId },
      })

      if (existingSub) {
        handleSubscriptionRenewal(event.subscriptionId, event.gatewayId).catch(console.error)
      } else {
        // First payment — create the Subscription record
        const fullSale = await prisma.sale.findUnique({
          where: { id: sale.id },
          select: { id: true, botId: true, productId: true, leadId: true, tgChatId: true, gatewayId: true },
        })
        if (fullSale) {
          createSubscriptionRecord(fullSale, event.subscriptionId).catch(console.error)
        }
      }
    }
  } else if (event.type === "PAYMENT_REFUSED") {
    await prisma.sale.update({
      where: { id: sale.id },
      data: { status: "REFUSED", gatewayId: event.gatewayId, gatewayStatus: "REFUSED" },
    })

    // Skip refused flow if lead already has a newer PENDING or APPROVED sale
    // (user tried to pay again — don't spam them with refused remarketing)
    const shouldFireRefused = !sale.leadId ? true : !(await prisma.sale.findFirst({
      where: {
        leadId: sale.leadId,
        productId: sale.productId,
        status: { in: ["PENDING", "APPROVED"] },
        createdAt: { gt: sale.createdAt },
      },
      select: { id: true },
    }))

    if (shouldFireRefused) {
      resumeFlowFromPayment(sale.id, "refused").catch((err) =>
        console.error("[webhook] resumeFlowFromPayment refused:", err)
      )
      if (event.subscriptionId) {
        handleSubscriptionRefused(event.subscriptionId).catch(console.error)
      }
    } else {
      console.log(`[webhook] skipping refused flow for sale ${sale.id} — lead has newer sale`)
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

    resumeFlowFromPayment(sale.id, "refunded").catch((err) =>
      console.error("[webhook] resumeFlowFromPayment refunded:", err)
    )
  }

  return NextResponse.json({ ok: true })
}
