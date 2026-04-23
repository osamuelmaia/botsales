/**
 * bot-worker.ts — BullMQ worker for processing bot flow jobs.
 *
 * Run locally:
 *   npx ts-node -r tsconfig-paths/register workers/bot-worker.ts
 *
 * Job types:
 *   PROCESS_FLOW    — triggered by /start or external event, runs the full flow
 *   SEND_MESSAGE    — sends a single Telegram message (used internally)
 *   PROCESS_DELAY   — delayed job that resumes the flow after DELAY/SMART_DELAY nodes
 *   CREATE_PAYMENT  — creates Asaas charge and sends payment link to lead
 */

import "dotenv/config"
import { Worker, Queue, Job } from "bullmq"
import IORedis from "ioredis"
import { PrismaClient } from "@prisma/client"
import { TelegramService } from "../lib/telegram"
import { GatewayService } from "../lib/gateway"
import { handleStartCommand, executeFlow, executeRemarketingFlow, resumeFlowFromButton, registerWebhook } from "../lib/bot-runner"
import { decryptToken } from "../lib/utils"

// ─── Redis connection ─────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

// ─── Queue ────────────────────────────────────────────────────────────────────

export const botQueue = new Queue("bot-jobs", { connection: redis })

// ─── Prisma ───────────────────────────────────────────────────────────────────

const prisma = new PrismaClient()

// ─── Job type definitions ─────────────────────────────────────────────────────

export type ProcessFlowJob = {
  type: "PROCESS_FLOW"
  botId: string
  chatId: number
  startNodeId?: string // undefined = start from TRIGGER_START
}

export type SendMessageJob = {
  type: "SEND_MESSAGE"
  token: string
  chatId: number
  text: string
  imageUrl?: string
  caption?: string
}

export type ProcessDelayJob = {
  type: "PROCESS_DELAY"
  botId: string
  chatId: number
  nextNodeId: string
}

export type CreatePaymentJob = {
  type: "CREATE_PAYMENT"
  botId: string
  chatId: number
  productId: string
  paymentNodeId: string
  leadName?: string
  leadEmail?: string
  leadCpf?: string
  leadPhone?: string
}

export type KickMemberJob = {
  type: "KICK_MEMBER"
  botId: string
  subscriptionId: string
  tgUserId: string
  groupChatId: string
}

export type UnbanMemberJob = {
  type: "UNBAN_MEMBER"
  botId: string
  subscriptionId: string
  tgUserId: string
  groupChatId: string
}

export type ProcessRemarketingJob = {
  type: "PROCESS_REMARKETING"
  botId: string
  subscriptionId: string
  tgUserId: string          // subscriber DM chat ID
  startNodeId?: string      // resume from specific node (for DELAY nodes)
}

export type CheckRenewalsJob = {
  type: "CHECK_RENEWALS"
}

export type BotJob =
  | ProcessFlowJob
  | SendMessageJob
  | ProcessDelayJob
  | CreatePaymentJob
  | KickMemberJob
  | UnbanMemberJob
  | ProcessRemarketingJob
  | CheckRenewalsJob

// ─── Job handlers ─────────────────────────────────────────────────────────────

async function handleProcessFlow(data: ProcessFlowJob): Promise<void> {
  console.log(`[PROCESS_FLOW] bot=${data.botId} chat=${data.chatId} node=${data.startNodeId ?? "start"}`)
  await executeFlow(data.botId, data.chatId, data.startNodeId)
}

async function handleSendMessage(data: SendMessageJob): Promise<void> {
  console.log(`[SEND_MESSAGE] chat=${data.chatId}`)
  if (data.imageUrl) {
    await TelegramService.sendPhoto(data.token, data.chatId, data.imageUrl, data.caption)
  } else {
    await TelegramService.sendMessage(data.token, data.chatId, data.text)
  }
}

async function handleProcessDelay(data: ProcessDelayJob): Promise<void> {
  // The BullMQ delay option already handles the wait — when this job runs,
  // it's time to continue the flow from the next node.
  console.log(`[PROCESS_DELAY] bot=${data.botId} chat=${data.chatId} next=${data.nextNodeId}`)
  await executeFlow(data.botId, data.chatId, data.nextNodeId)
}

async function handleCreatePayment(data: CreatePaymentJob): Promise<void> {
  console.log(`[CREATE_PAYMENT] bot=${data.botId} product=${data.productId} chat=${data.chatId}`)

  // Load product + seller
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    include: {
      user: {
        select: {
          id: true,
          platformFeePercent: true,
          platformFeeCents: true,
          registrationStep: true,
        },
      },
    },
  })

  if (!product) {
    console.warn(`[CREATE_PAYMENT] product ${data.productId} not found`)
    return
  }

  if (product.user.registrationStep < 2) {
    console.warn(`[CREATE_PAYMENT] seller not fully registered`)
    return
  }

  // Find or create Lead
  const lead = await prisma.lead.upsert({
    where: { botId_telegramId: { botId: data.botId, telegramId: String(data.chatId) } },
    create: {
      botId: data.botId,
      telegramId: String(data.chatId),
      name: data.leadName ?? null,
      email: data.leadEmail ?? null,
      phone: data.leadPhone ?? null,
    },
    update: {
      ...(data.leadName ? { name: data.leadName } : {}),
      ...(data.leadEmail ? { email: data.leadEmail } : {}),
      ...(data.leadPhone ? { phone: data.leadPhone } : {}),
    },
  })

  // Calculate fees
  const feePercent = Number(product.user.platformFeePercent)
  const feeFixed = product.user.platformFeeCents
  const feeAmountCents = Math.round((product.priceInCents * feePercent) / 100) + feeFixed
  const netAmountCents = product.priceInCents - feeAmountCents

  // Create Sale (PENDING)
  const sale = await prisma.sale.create({
    data: {
      userId: product.userId,
      productId: product.id,
      leadId: lead.id,
      botId: data.botId,
      tgChatId: String(data.chatId),
      paymentNodeId: data.paymentNodeId,
      paymentMethod: "PIX", // default to PIX for bot-initiated payments
      status: "PENDING",
      grossAmountCents: product.priceInCents,
      feeAmountCents,
      netAmountCents,
    },
  })

  // Load bot to get token
  const bot = await prisma.bot.findUnique({ where: { id: data.botId } })
  if (!bot) return

  const token = decryptToken(bot.tokenEncrypted)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  // If we have GATEWAY_API_KEY, create a PIX charge directly
  if (process.env.GATEWAY_API_KEY && data.leadEmail && data.leadCpf) {
    try {
      const charge = await GatewayService.createPixCharge({
        customerName: data.leadName ?? "Lead",
        customerEmail: data.leadEmail,
        customerCpfCnpj: data.leadCpf.replace(/\D/g, ""),
        amountCents: product.priceInCents,
        description: product.name,
        externalReference: sale.id,
      })

      await prisma.sale.update({
        where: { id: sale.id },
        data: { gatewayId: charge.id, gatewayStatus: "PENDING" },
      })

      // Send QR code image first, then copia-e-cola as separate message for easy copy
      const brl = (product.priceInCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      await TelegramService.sendPhotoBuffer(
        token,
        data.chatId,
        charge.pixQrCodeBase64,
        `💳 *${product.name}* — ${brl}\n\nEscaneie o QR code ou use o código abaixo para pagar.`
      )
      await TelegramService.sendMessage(
        token,
        data.chatId,
        `📋 *PIX Copia e Cola* (toque para copiar):\n\`${charge.pixCode}\``
      )
      return
    } catch (err) {
      console.error("[CREATE_PAYMENT] gateway error:", err)
      // Fall back to checkout link
    }
  }

  // Fallback: send checkout link (opens Mini App WebView)
  const checkoutUrl = `${baseUrl}/checkout/${product.id}?chatId=${data.chatId}&botId=${data.botId}&nodeId=${data.paymentNodeId}`
  const ctaText = "Pagar agora"

  await TelegramService.sendInlineKeyboard(token, data.chatId, `Clique para pagar *${product.name}*:`, [
    { text: ctaText, url: checkoutUrl },
  ])
}

async function handleKickMember(data: KickMemberJob): Promise<void> {
  console.log(`[KICK_MEMBER] subscription=${data.subscriptionId} user=${data.tgUserId}`)

  const subscription = await prisma.subscription.findUnique({ where: { id: data.subscriptionId } })

  // If user already renewed (ACTIVE) or was cancelled, skip the kick
  if (!subscription || subscription.status !== "REMARKETING") {
    console.log(`[KICK_MEMBER] skipping — status=${subscription?.status ?? "not found"}`)
    return
  }

  const bot = await prisma.bot.findUnique({ where: { id: data.botId } })
  if (!bot) return

  const token = decryptToken(bot.tokenEncrypted)

  const isPermissionError = (msg: string) =>
    msg.includes("CHAT_ADMIN_REQUIRED") ||
    msg.includes("not enough rights") ||
    msg.includes("bot was kicked") ||
    msg.includes("bot is not a member") ||
    msg.includes("need administrator rights")

  try {
    await TelegramService.banChatMember(token, data.groupChatId, data.tgUserId)
    console.log(`[KICK_MEMBER] banned user ${data.tgUserId} from group ${data.groupChatId}`)

    await prisma.subscription.update({
      where: { id: data.subscriptionId },
      data: { status: "KICKED" },
    })

    // Clear any previous permission error on this bot
    await prisma.bot.update({
      where: { id: data.botId },
      data: { channelPermissionError: null, channelPermissionErrorAt: null } as Record<string, unknown>,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[KICK_MEMBER] ban failed for user ${data.tgUserId}:`, errorMsg)

    if (isPermissionError(errorMsg)) {
      // Bot lost admin — record error and queue for retry, do NOT mark as KICKED
      await prisma.bot.update({
        where: { id: data.botId },
        data: {
          channelPermissionError: `Sem permissão no grupo ${data.groupChatId}: ${errorMsg}`,
          channelPermissionErrorAt: new Date(),
        } as Record<string, unknown>,
      })

      // Store as pending kick (avoid duplicate)
      const existing = await prisma.pendingKick.findFirst({
        where: { botId: data.botId, subscriptionId: data.subscriptionId },
      })
      if (!existing) {
        await prisma.pendingKick.create({
          data: {
            botId: data.botId,
            subscriptionId: data.subscriptionId,
            tgUserId: data.tgUserId,
            groupChatId: data.groupChatId,
            errorMessage: errorMsg,
          },
        })
      }
    } else {
      // Non-permission error (user left, network, etc.) — mark as KICKED anyway to avoid infinite retry
      await prisma.subscription.update({
        where: { id: data.subscriptionId },
        data: { status: "KICKED" },
      })
    }
  }
}

async function handleUnbanMember(data: UnbanMemberJob): Promise<void> {
  console.log(`[UNBAN_MEMBER] subscription=${data.subscriptionId} user=${data.tgUserId}`)

  const bot = await prisma.bot.findUnique({ where: { id: data.botId } })
  if (!bot) return

  const token = decryptToken(bot.tokenEncrypted)

  try {
    await TelegramService.unbanChatMember(token, data.groupChatId, data.tgUserId)
    // Send a fresh single-use invite link so the user can rejoin
    const inviteLink = await TelegramService.createChatInviteLink(token, data.groupChatId)
    await TelegramService.sendMessage(
      token,
      parseInt(data.tgUserId, 10),
      `✅ Sua assinatura foi renovada! Use o link abaixo para acessar o grupo:\n${inviteLink}`
    )
    console.log(`[UNBAN_MEMBER] unbanned user ${data.tgUserId} and sent invite`)
  } catch (err) {
    console.error(`[UNBAN_MEMBER] unban failed:`, err)
  }

  await prisma.subscription.update({
    where: { id: data.subscriptionId },
    data: { status: "ACTIVE", remarketingStart: null },
  })
}

async function handleProcessRemarketing(data: ProcessRemarketingJob): Promise<void> {
  console.log(`[PROCESS_REMARKETING] subscription=${data.subscriptionId} user=${data.tgUserId}`)

  const subscription = await prisma.subscription.findUnique({
    where: { id: data.subscriptionId },
    include: { bot: true },
  })

  // Only proceed if subscription is still in REMARKETING state.
  // If the user already renewed (ACTIVE) or was cancelled/kicked, stop immediately.
  if (!subscription || subscription.status !== "REMARKETING") {
    console.log(`[PROCESS_REMARKETING] skipping — status=${subscription?.status ?? "not found"}`)
    return
  }

  const chatId = parseInt(data.tgUserId, 10)
  if (!isNaN(chatId)) {
    await executeRemarketingFlow(data.botId, chatId, data.startNodeId, {
      subscriptionId: data.subscriptionId,
      // Long DELAY nodes (> 30s) schedule a new BullMQ delayed job so the worker
      // handles day-long gaps instead of blocking the thread or being capped at 8s.
      scheduleResume: async (nextNodeId, delayMs) => {
        await botQueue.add(
          "process-remarketing",
          {
            type: "PROCESS_REMARKETING" as const,
            botId: data.botId,
            subscriptionId: data.subscriptionId,
            tgUserId: data.tgUserId,
            startNodeId: nextNodeId,
          },
          { delay: delayMs, jobId: `remarketing-${data.subscriptionId}-${nextNodeId}` }
        )
        console.log(`[PROCESS_REMARKETING] scheduled resume at node ${nextNodeId} in ${Math.round(delayMs / 3600000 * 10) / 10}h`)
      },
    })
  }
}

async function handleCheckRenewals(): Promise<void> {
  console.log("[CHECK_RENEWALS] scanning subscriptions...")

  const now = new Date()

  // Find ACTIVE subscriptions past their period end
  const expiredActive = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
    include: { bot: true },
  })

  for (const sub of expiredActive) {
    const gracePeriodEnd = new Date(sub.currentPeriodEnd)
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + sub.bot.gracePeriodDays)

    if (now < gracePeriodEnd) {
      // Within grace period — transition to REMARKETING and fire remarketing flow.
      // Status must be updated BEFORE enqueuing so handleProcessRemarketing
      // doesn't skip the job (it requires status === "REMARKETING").
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "REMARKETING", remarketingStart: new Date() },
      })
      // jobId prevents duplicate jobs if cron fires again before job is processed
      await botQueue.add(
        "process-remarketing",
        { type: "PROCESS_REMARKETING" as const, botId: sub.botId, subscriptionId: sub.id, tgUserId: sub.tgUserId },
        { jobId: `remarketing-${sub.id}` }
      )
    } else {
      // Grace period also expired — transition to REMARKETING then kick.
      // Status must be REMARKETING for handleKickMember to execute the ban.
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "REMARKETING", remarketingStart: sub.remarketingStart ?? new Date() },
      })
      await botQueue.add(
        "kick-member",
        { type: "KICK_MEMBER" as const, botId: sub.botId, subscriptionId: sub.id, tgUserId: sub.tgUserId, groupChatId: sub.groupTgChatId },
        { jobId: `kick-${sub.id}` }
      )
    }
  }

  // Find REMARKETING subscriptions whose grace period expired — kick them
  const expiredRemarketing = await prisma.subscription.findMany({
    where: { status: "REMARKETING" },
    include: { bot: true },
  })

  for (const sub of expiredRemarketing) {
    const gracePeriodEnd = new Date(sub.currentPeriodEnd)
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + sub.bot.gracePeriodDays)

    if (now >= gracePeriodEnd) {
      // jobId prevents enqueuing the same kick multiple times across cron runs
      await botQueue.add(
        "kick-member",
        { type: "KICK_MEMBER" as const, botId: sub.botId, subscriptionId: sub.id, tgUserId: sub.tgUserId, groupChatId: sub.groupTgChatId },
        { jobId: `kick-${sub.id}` }
      )
    }
  }

  console.log(`[CHECK_RENEWALS] processed ${expiredActive.length} expired active, ${expiredRemarketing.length} remarketing`)
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<BotJob>(
  "bot-jobs",
  async (job: Job<BotJob>) => {
    const data = job.data
    switch (data.type) {
      case "PROCESS_FLOW":
        await handleProcessFlow(data)
        break
      case "SEND_MESSAGE":
        await handleSendMessage(data)
        break
      case "PROCESS_DELAY":
        await handleProcessDelay(data)
        break
      case "CREATE_PAYMENT":
        await handleCreatePayment(data)
        break
      case "KICK_MEMBER":
        await handleKickMember(data)
        break
      case "UNBAN_MEMBER":
        await handleUnbanMember(data)
        break
      case "PROCESS_REMARKETING":
        await handleProcessRemarketing(data)
        break
      case "CHECK_RENEWALS":
        await handleCheckRenewals()
        break
      default:
        console.warn("[worker] unknown job type:", (data as { type: string }).type)
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
)

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} (${job.data.type}) completed`)
})

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} (${job?.data?.type}) failed:`, err.message)
})

// ─── Startup: load active bots and start polling ──────────────────────────────

async function startActiveBots(): Promise<void> {
  const bots = await prisma.bot.findMany({ where: { isActive: true } })
  console.log(`[worker] found ${bots.length} active bot(s)`)

  for (const bot of bots) {
    try {
      const token = decryptToken(bot.tokenEncrypted)
      TelegramService.startPolling(
        token,
        bot.id,
        async (ctx) => {
          const chatId = ctx.from?.id
          if (!chatId) return

          // Upsert Lead
          await prisma.lead.upsert({
            where: { botId_telegramId: { botId: bot.id, telegramId: String(chatId) } },
            create: {
              botId: bot.id,
              telegramId: String(chatId),
              name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || null,
              username: ctx.from?.username ?? null,
            },
            update: {
              name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || undefined,
              username: ctx.from?.username ?? undefined,
            },
          })

          // Run /start logic: sends fresh invite if already subscribed, else full flow
          await handleStartCommand(bot.id, chatId)
        },
        // callback_query: resume flow-mode button presses in polling mode
        async (ctx, data) => {
          const chatId = ctx.from?.id
          if (chatId && data.startsWith("flow:")) {
            await resumeFlowFromButton(bot.id, chatId, data)
          }
        }
      )
    } catch (err) {
      console.error(`[worker] failed to start polling for bot ${bot.id}:`, err)
    }
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log("\n[worker] shutting down…")
  await worker.close()
  await TelegramService.stopAll()
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

// ─── Recurring jobs ───────────────────────────────────────────────────────────

async function scheduleRecurringJobs(): Promise<void> {
  // Run CHECK_RENEWALS every hour
  await botQueue.add(
    "check-renewals",
    { type: "CHECK_RENEWALS" as const },
    { repeat: { every: 60 * 60 * 1000 } }
  )
  console.log("[worker] scheduled CHECK_RENEWALS every 1h")
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

startActiveBots()
  .then(() => scheduleRecurringJobs())
  .then(() => console.log("[worker] ready — listening for jobs on queue: bot-jobs"))
  .catch((err) => {
    console.error("[worker] startup error:", err)
    process.exit(1)
  })
