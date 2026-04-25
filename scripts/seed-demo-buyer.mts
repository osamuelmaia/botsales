import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Get first user (seller)
  const seller = await prisma.user.findFirst({ select: { id: true, name: true } })
  if (!seller) { console.error("Nenhum usuário encontrado. Crie uma conta de vendedor primeiro."); process.exit(1) }
  console.log("Usando vendedor:", seller.name, seller.id)

  // Get or create a bot
  let bot = await prisma.bot.findFirst({ where: { userId: seller.id }, select: { id: true, name: true } })
  if (!bot) {
    bot = await prisma.bot.create({
      data: { userId: seller.id, name: "Bot Demo", tokenEncrypted: "demo", isActive: true },
      select: { id: true, name: true },
    })
    console.log("Bot criado:", bot.name)
  } else {
    console.log("Usando bot:", bot.name)
  }

  // Get or create a product
  let product = await prisma.product.findFirst({
    where: { userId: seller.id, isRecurring: true },
    select: { id: true, name: true, priceInCents: true },
  })
  if (!product) {
    product = await prisma.product.create({
      data: {
        userId: seller.id,
        name: "Plano Mensal Demo",
        priceInCents: 4990,
        paymentMethods: ["PIX", "CREDIT_CARD"],
        isRecurring: true,
        billingType: "MONTHLY",
      },
      select: { id: true, name: true, priceInCents: true },
    })
    console.log("Produto criado:", product.name)
  } else {
    console.log("Usando produto:", product.name)
  }

  // Create demo lead (buyer)
  const demoEmail    = "comprador@demo.com"
  const demoPassword = "Demo1234"
  const passwordHash = await bcrypt.hash(demoPassword, 12)

  const lead = await prisma.lead.upsert({
    where: { botId_telegramId: { botId: bot.id, telegramId: "demo_buyer_1" } },
    create: {
      botId: bot.id,
      telegramId: "demo_buyer_1",
      name:  "João Silva (Demo)",
      email: demoEmail,
      portalPasswordHash: passwordHash,
    },
    update: { portalPasswordHash: passwordHash, email: demoEmail },
    select: { id: true },
  })
  console.log("Lead criado/atualizado:", lead.id)

  // Create subscription
  const existing = await prisma.subscription.findFirst({ where: { leadId: lead.id } })
  if (!existing) {
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 22)

    await prisma.subscription.create({
      data: {
        botId: bot.id,
        leadId: lead.id,
        productId: product.id,
        groupTgChatId: "-100000000000",
        tgUserId: "demo_buyer_1",
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
      },
    })
    console.log("Assinatura criada!")
  } else {
    console.log("Assinatura já existe:", existing.id, existing.status)
  }

  console.log("\n✅ Pronto! Acesse:")
  console.log("   URL:   /assinaturas/login")
  console.log("   Email: " + demoEmail)
  console.log("   Senha: " + demoPassword)
}

main().catch(console.error).finally(() => prisma.$disconnect())
