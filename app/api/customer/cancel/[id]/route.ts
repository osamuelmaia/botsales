import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCustomerSession } from "@/lib/customer-auth"

const BASE_URL =
  process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const subscription = await prisma.subscription.findUnique({
    where: { id: params.id },
    select: { id: true, leadId: true, status: true, gatewayChargeId: true },
  })

  if (!subscription || subscription.leadId !== session.leadId) {
    return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })
  }

  if (subscription.status === "CANCELLED") {
    return NextResponse.json({ error: "Assinatura já cancelada" }, { status: 400 })
  }

  // Cancel in Asaas (stop future charges)
  if (subscription.gatewayChargeId && process.env.GATEWAY_API_KEY) {
    try {
      await fetch(`${BASE_URL}/subscriptions/${subscription.gatewayChargeId}`, {
        method:  "DELETE",
        headers: { access_token: process.env.GATEWAY_API_KEY },
      })
    } catch (err) {
      console.error("[cancel] Asaas cancellation failed:", err)
      // Don't block cancellation if Asaas call fails
    }
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data:  { status: "CANCELLED" },
  })

  return NextResponse.json({ ok: true })
}
