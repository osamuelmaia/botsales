import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCustomerSession } from "@/lib/customer-auth"

const ASAAS_BASE =
  process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await params

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    select: { id: true, leadId: true, status: true, gatewayChargeId: true },
  })

  if (!subscription || subscription.leadId !== session.leadId) {
    return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })
  }

  if (subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Apenas assinaturas ativas podem ser pausadas" }, { status: 400 })
  }

  // Pause in Asaas — set subscription to INACTIVE (no new charges generated)
  if (subscription.gatewayChargeId && process.env.GATEWAY_API_KEY) {
    try {
      await fetch(`${ASAAS_BASE}/subscriptions/${subscription.gatewayChargeId}`, {
        method:  "PUT",
        headers: {
          "Content-Type": "application/json",
          access_token: process.env.GATEWAY_API_KEY,
        },
        body: JSON.stringify({ status: "INACTIVE" }),
      })
    } catch (err) {
      console.error("[pause] Asaas call failed:", err)
    }
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data:  { status: "PAUSED" },
  })

  return NextResponse.json({ ok: true })
}
