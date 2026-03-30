import { NextRequest, NextResponse } from "next/server"
import { GatewayService } from "@/lib/gateway"
import { prisma } from "@/lib/prisma"

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

  // 3. Ignore unknown events
  if (event.type === "UNKNOWN" || !event.saleId) {
    return NextResponse.json({ ok: true })
  }

  // 4. Find sale by externalReference (= Sale.id)
  const sale = await prisma.sale.findUnique({ where: { id: event.saleId } })
  if (!sale) {
    // Not our sale — return 200 so Asaas stops retrying
    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  // 5. Update sale based on event type
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
  } else if (event.type === "PAYMENT_REFUSED") {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: "REFUSED",
        gatewayId: event.gatewayId,
        gatewayStatus: "REFUSED",
      },
    })
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
  }

  return NextResponse.json({ ok: true })
}
