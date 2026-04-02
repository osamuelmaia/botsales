import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCustomerSession } from "@/lib/customer-auth"

export async function GET() {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const lead = await prisma.lead.findUnique({
    where: { id: session.leadId },
    select: {
      id: true, name: true, email: true, username: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, priceInCents: true, isRecurring: true, billingType: true } },
          bot:     { select: { id: true, name: true } },
        },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, status: true, paymentMethod: true,
          grossAmountCents: true, feeAmountCents: true, netAmountCents: true,
          createdAt: true, paidAt: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })

  return NextResponse.json({
    id:       lead.id,
    name:     lead.name,
    email:    lead.email,
    username: lead.username,
    subscriptions: lead.subscriptions.map((s) => ({
      id:               s.id,
      status:           s.status,
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      createdAt:        s.createdAt.toISOString(),
      product:          s.product,
      bot:              s.bot,
    })),
    sales: lead.sales.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      paidAt:    s.paidAt?.toISOString() ?? null,
    })),
  })
}
