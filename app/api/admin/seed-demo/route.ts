import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Temporary endpoint — creates a demo buyer account for visualization
// Only accessible to ADMIN users

export async function POST() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const sellerId = session.user.id

  // Get or create a bot
  let bot = await prisma.bot.findFirst({
    where: { userId: sellerId },
    select: { id: true, name: true },
  })
  if (!bot) {
    bot = await prisma.bot.create({
      data: { userId: sellerId, name: "Bot Demo", tokenEncrypted: "demo", isActive: true },
      select: { id: true, name: true },
    })
  }

  // Get or create a recurring product
  let product = await prisma.product.findFirst({
    where: { userId: sellerId, isRecurring: true },
    select: { id: true, name: true, priceInCents: true },
  })
  if (!product) {
    product = await prisma.product.create({
      data: {
        userId: sellerId,
        name: "Plano Mensal Demo",
        priceInCents: 4990,
        paymentMethods: ["PIX", "CREDIT_CARD"],
        isRecurring: true,
        billingType: "MONTHLY",
      },
      select: { id: true, name: true, priceInCents: true },
    })
  }

  const demoEmail    = "comprador@demo.com"
  const demoPassword = "Demo1234"
  const passwordHash = await bcrypt.hash(demoPassword, 12)

  const lead = await prisma.lead.upsert({
    where: { botId_telegramId: { botId: bot.id, telegramId: "demo_buyer_seed" } },
    create: {
      botId: bot.id,
      telegramId: "demo_buyer_seed",
      name:  "João Silva (Demo)",
      email: demoEmail,
      portalPasswordHash: passwordHash,
    },
    update: { portalPasswordHash: passwordHash, email: demoEmail },
    select: { id: true },
  })

  // Create or update subscription
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + 22)

  await prisma.subscription.upsert({
    where: { botId_leadId_productId: { botId: bot.id, leadId: lead.id, productId: product.id } },
    create: {
      botId: bot.id,
      leadId: lead.id,
      productId: product.id,
      groupTgChatId: "-100000000000",
      tgUserId: "demo_buyer_seed",
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
    },
    update: { status: "ACTIVE", currentPeriodEnd: periodEnd },
  })

  return NextResponse.json({
    ok: true,
    credentials: { email: demoEmail, password: demoPassword },
    url: "/assinaturas/login",
  })
}
