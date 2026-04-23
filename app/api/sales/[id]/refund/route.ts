import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GatewayService } from "@/lib/gateway"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sale = await prisma.sale.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, status: true, gatewayId: true },
  })

  if (!sale) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 })
  if (sale.status !== "APPROVED")
    return NextResponse.json({ error: "Apenas vendas aprovadas podem ser reembolsadas" }, { status: 400 })
  if (!sale.gatewayId)
    return NextResponse.json({ error: "Sem ID de gateway para reembolso" }, { status: 400 })

  try {
    await GatewayService.refundPayment(sale.gatewayId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no gateway"
    // Extract Asaas error description if available
    const asaasMatch = msg.match(/\d{3}: (.+)/)
    const userMsg = asaasMatch ? asaasMatch[1] : msg
    return NextResponse.json({ error: userMsg }, { status: 502 })
  }

  await prisma.sale.update({
    where: { id: sale.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
