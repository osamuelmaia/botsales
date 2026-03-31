import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { GatewayService } from "@/lib/gateway"

// ─── POST /api/checkout/[productId]/pay ───────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  // ── 1. Load product + owner ──────────────────────────────────────────────
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
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
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
  }

  if (product.user.registrationStep < 2) {
    return NextResponse.json(
      { error: "Vendedor ainda não está habilitado para receber pagamentos" },
      { status: 403 }
    )
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: {
    method: "PIX" | "CREDIT_CARD"
    name: string
    email: string
    cpf: string
    phone: string
    // Telegram context — present when checkout is opened from a bot flow
    tgChatId?: string
    tgBotId?: string
    tgNodeId?: string
    // Card-only fields
    cardHolderName?: string
    cardNumber?: string
    cardExpiryMonth?: string
    cardExpiryYear?: string
    cardCvv?: string
    cardPostalCode?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const { method, name, email, cpf, phone, tgChatId, tgBotId, tgNodeId } = body

  if (!method || !name || !email || !cpf) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 })
  }

  if (!product.paymentMethods.includes(method)) {
    return NextResponse.json({ error: "Método de pagamento não aceito" }, { status: 400 })
  }

  // ── 3. Find or create Lead ───────────────────────────────────────────────
  // When coming from the bot, tgBotId + tgChatId identify the lead precisely.
  // When coming from a direct web checkout, fall back to email as placeholder.
  let lead = null

  if (tgBotId && tgChatId) {
    // Real Telegram lead: upsert by botId + telegramId (chatId)
    lead = await prisma.lead.upsert({
      where: { botId_telegramId: { botId: tgBotId, telegramId: tgChatId } },
      create: { botId: tgBotId, telegramId: tgChatId, name, email, phone: phone || null },
      update: { name, email: email || undefined, phone: phone || null },
    })
  } else {
    // Web checkout: search by email across the seller's bots
    lead = await prisma.lead.findFirst({
      where: { bot: { userId: product.userId }, email },
    })

    if (!lead) {
      const anyBot = await prisma.bot.findFirst({ where: { userId: product.userId } })
      if (anyBot) {
        lead = await prisma.lead.upsert({
          where: { botId_telegramId: { botId: anyBot.id, telegramId: email } },
          create: { botId: anyBot.id, telegramId: email, name, email, phone: phone || null },
          update: { name, phone: phone || null },
        })
      }
    }
  }

  // ── 4. Calculate fees ────────────────────────────────────────────────────
  const feePercent = Number(product.user.platformFeePercent)
  const feeFixed = product.user.platformFeeCents
  const feeAmountCents = Math.round((product.priceInCents * feePercent) / 100) + feeFixed
  const netAmountCents = product.priceInCents - feeAmountCents

  // ── 5. Create Sale (PENDING) ─────────────────────────────────────────────
  const sale = await prisma.sale.create({
    data: {
      userId: product.userId,
      productId: product.id,
      leadId: lead?.id ?? null,
      // Telegram context (only when coming from bot)
      botId: tgBotId ?? null,
      tgChatId: tgChatId ?? null,
      paymentNodeId: tgNodeId ?? null,
      paymentMethod: method,
      status: "PENDING",
      grossAmountCents: product.priceInCents,
      feeAmountCents,
      netAmountCents,
    },
  })

  // ── 6. Create charge in Asaas ────────────────────────────────────────────
  try {
    if (method === "PIX") {
      const charge = await GatewayService.createPixCharge({
        customerName: name,
        customerEmail: email,
        customerCpfCnpj: cpf.replace(/\D/g, ""),
        amountCents: product.priceInCents,
        description: product.name,
        externalReference: sale.id,
      })

      await prisma.sale.update({
        where: { id: sale.id },
        data: { gatewayId: charge.id, gatewayStatus: "PENDING" },
      })

      return NextResponse.json({
        saleId: sale.id,
        pixCode: charge.pixCode,
        pixQrCodeBase64: charge.pixQrCodeBase64,
        expiresAt: charge.expiresAt,
      })
    }

    if (method === "CREDIT_CARD") {
      const { cardHolderName, cardNumber, cardExpiryMonth, cardExpiryYear, cardCvv, cardPostalCode } = body

      if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv || !cardPostalCode) {
        await prisma.sale.delete({ where: { id: sale.id } })
        return NextResponse.json({ error: "Dados do cartão incompletos" }, { status: 400 })
      }

      const cardToken = await GatewayService.tokenizeCard({
        holderName: cardHolderName,
        number: cardNumber,
        expiryMonth: cardExpiryMonth,
        expiryYear: cardExpiryYear,
        ccv: cardCvv,
        customerName: name,
        customerEmail: email,
        customerCpfCnpj: cpf.replace(/\D/g, ""),
        postalCode: cardPostalCode,
        phone: phone?.replace(/\D/g, "") ?? "",
      })

      const billingType = product.isRecurring && product.billingType ? product.billingType : "MONTHLY"

      const subscription = await GatewayService.createSubscription({
        customerName: name,
        customerEmail: email,
        customerCpfCnpj: cpf.replace(/\D/g, ""),
        amountCents: product.priceInCents,
        billingType,
        description: product.name,
        externalReference: sale.id,
        cardToken,
      })

      await prisma.sale.update({
        where: { id: sale.id },
        data: { gatewayId: subscription.id, gatewayStatus: "PENDING" },
      })

      return NextResponse.json({ saleId: sale.id, success: true })
    }
  } catch (err) {
    await prisma.sale.delete({ where: { id: sale.id } }).catch(() => {})
    const message = err instanceof Error ? err.message : "Erro ao processar pagamento"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ error: "Método inválido" }, { status: 400 })
}
