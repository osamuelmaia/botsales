import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const [sales, leads] = await Promise.all([
    prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        grossAmountCents: true,
        createdAt: true,
        lead:    { select: { name: true, username: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { bot: { userId } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
        bot: { select: { name: true } },
      },
    }),
  ])

  type Event = {
    id: string
    type: "approved_pix" | "approved_card" | "pending_pix" | "refused_card" | "refused_pix" | "refunded" | "new_contact"
    actor: string
    description: string
    amountCents: number | null
    sellerName: null
    at: string
  }

  const events: Event[] = []

  for (const s of sales) {
    const actor   = s.lead?.name ?? s.lead?.username ?? "Desconhecido"
    const product = s.product.name
    const isCard  = s.paymentMethod === "CREDIT_CARD"
    const isPix   = s.paymentMethod === "PIX"

    if (s.status === "APPROVED" && isPix)
      events.push({ id: `sale-${s.id}`, type: "approved_pix",  actor, description: `Comprou ${product} via PIX`,    amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
    else if (s.status === "APPROVED" && isCard)
      events.push({ id: `sale-${s.id}`, type: "approved_card", actor, description: `Comprou ${product} via Cartão`, amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
    else if (s.status === "PENDING" && isPix)
      events.push({ id: `sale-${s.id}`, type: "pending_pix",   actor, description: `Gerou PIX para ${product}`,    amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
    else if (s.status === "REFUSED" && isCard)
      events.push({ id: `sale-${s.id}`, type: "refused_card",  actor, description: `Cartão recusado — ${product}`, amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
    else if (s.status === "REFUSED" && isPix)
      events.push({ id: `sale-${s.id}`, type: "refused_pix",   actor, description: `PIX expirou — ${product}`,     amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
    else if (s.status === "REFUNDED")
      events.push({ id: `sale-${s.id}`, type: "refunded",      actor, description: `Reembolso — ${product}`,       amountCents: s.grossAmountCents, sellerName: null, at: s.createdAt.toISOString() })
  }

  for (const l of leads) {
    events.push({
      id: `lead-${l.id}`,
      type: "new_contact",
      actor: l.name ?? l.username ?? "Usuário",
      description: `Iniciou conversa com ${l.bot?.name ?? "bot"}`,
      amountCents: null,
      sellerName: null,
      at: l.createdAt.toISOString(),
    })
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return NextResponse.json(events.slice(0, 60))
}
