import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { GatewayService } from "@/lib/gateway"

// ─── Validation ──────────────────────────────────────────────────────────────

const cpfRegex = /^\d{11}$/
const cuidRegex = /^c[a-z0-9]{24}$/

const paymentBodySchema = z.object({
  method: z.enum(["PIX", "CREDIT_CARD"]),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(200),
  email: z.string().email("E-mail inválido").max(320),
  cpf: z.string().transform(v => v.replace(/\D/g, "")).pipe(
    z.string().regex(cpfRegex, "CPF deve ter 11 dígitos")
  ),
  phone: z.string().max(20).default(""),
  // Telegram context (optional)
  tgChatId: z.string().max(50).optional(),
  tgBotId: z.string().max(50).optional(),
  tgNodeId: z.string().max(50).optional(),
  // Card-only fields (validated conditionally below)
  cardHolderName: z.string().max(200).optional(),
  cardNumber: z.string().max(25).optional(),
  cardExpiryMonth: z.string().max(2).optional(),
  cardExpiryYear: z.string().max(4).optional(),
  cardCvv: z.string().max(4).optional(),
  cardPostalCode: z.string().max(10).optional(),
})

// ─── POST /api/checkout/[productId]/pay ───────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  // ── 0. Validate productId ───────────────────────────────────────────────
  if (!cuidRegex.test(params.productId)) {
    return NextResponse.json({ error: "ID de produto inválido" }, { status: 400 })
  }

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

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const parsed = paymentBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 422 }
    )
  }

  const { method, name, email, cpf, phone, tgChatId, tgBotId, tgNodeId } = parsed.data

  if (!product.paymentMethods.includes(method)) {
    return NextResponse.json({ error: "Método de pagamento não aceito" }, { status: 400 })
  }

  // Validate card fields when method is CREDIT_CARD
  if (method === "CREDIT_CARD") {
    const { cardHolderName, cardNumber, cardExpiryMonth, cardExpiryYear, cardCvv, cardPostalCode } = parsed.data
    if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv || !cardPostalCode) {
      return NextResponse.json({ error: "Dados do cartão incompletos" }, { status: 400 })
    }
  }

  // ── 3. Find or create Lead ───────────────────────────────────────────────
  let lead = null

  if (tgBotId && tgChatId) {
    lead = await prisma.lead.upsert({
      where: { botId_telegramId: { botId: tgBotId, telegramId: tgChatId } },
      create: { botId: tgBotId, telegramId: tgChatId, name, email, phone: phone || null },
      update: { name, email: email || undefined, phone: phone || null },
    })
  } else {
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
  const netAmountCents = Math.max(product.priceInCents - feeAmountCents, 0)

  // ── 5. Create Sale (PENDING) ─────────────────────────────────────────────
  const sale = await prisma.sale.create({
    data: {
      userId: product.userId,
      productId: product.id,
      leadId: lead?.id ?? null,
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
        customerCpfCnpj: cpf,
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
      const { cardHolderName, cardNumber, cardExpiryMonth, cardExpiryYear, cardCvv, cardPostalCode } = parsed.data

      // Normalise year to 4-digit for Asaas
      let expiryYear = cardExpiryYear!
      if (expiryYear.length === 2) {
        expiryYear = `20${expiryYear}`
      }

      const cardToken = await GatewayService.tokenizeCard({
        holderName: cardHolderName!,
        number: cardNumber!,
        expiryMonth: cardExpiryMonth!,
        expiryYear: expiryYear,
        ccv: cardCvv!,
        customerName: name,
        customerEmail: email,
        customerCpfCnpj: cpf,
        postalCode: cardPostalCode!,
        phone: phone?.replace(/\D/g, "") ?? "",
      })

      let gatewayId: string

      if (product.isRecurring && product.billingType) {
        // Produto recorrente → assinatura no Asaas
        const billingType = product.billingType as "MONTHLY" | "ANNUAL"
        const subscription = await GatewayService.createSubscription({
          customerName: name,
          customerEmail: email,
          customerCpfCnpj: cpf,
          amountCents: product.priceInCents,
          billingType,
          description: product.name,
          externalReference: sale.id,
          cardToken,
        })
        gatewayId = subscription.id
      } else {
        // Produto avulso → cobrança única no cartão
        const payment = await GatewayService.createOneTimeCardPayment({
          customerName: name,
          customerEmail: email,
          customerCpfCnpj: cpf,
          amountCents: product.priceInCents,
          description: product.name,
          externalReference: sale.id,
          cardToken,
        })
        gatewayId = payment.id
      }

      await prisma.sale.update({
        where: { id: sale.id },
        data: { gatewayId, gatewayStatus: "PENDING" },
      })

      return NextResponse.json({ saleId: sale.id, success: true })
    }
  } catch (err) {
    await prisma.sale.delete({ where: { id: sale.id } }).catch(() => {})
    const message = err instanceof Error ? err.message : "Erro ao processar pagamento"
    console.error("[checkout/pay] error:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ error: "Método inválido" }, { status: 400 })
}
