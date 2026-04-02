import { redirect } from "next/navigation"
import { getCustomerSession } from "@/lib/customer-auth"
import { prisma } from "@/lib/prisma"
import { CustomerDashboard } from "./CustomerDashboard"

export default async function AssinaturasPage() {
  const session = await getCustomerSession()
  if (!session) redirect("/assinaturas/login")

  const lead = await prisma.lead.findUnique({
    where: { id: session.leadId },
    select: {
      id: true, name: true, email: true, username: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, priceInCents: true, isRecurring: true } },
          bot:     { select: { id: true, name: true } },
        },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, status: true, paymentMethod: true,
          grossAmountCents: true, createdAt: true, paidAt: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  if (!lead) redirect("/assinaturas/login")

  const data = {
    id:       lead.id,
    name:     lead.name ?? "Cliente",
    email:    lead.email ?? session.email,
    subscriptions: lead.subscriptions.map((s) => ({
      id:               s.id,
      status:           s.status,
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      createdAt:        s.createdAt.toISOString(),
      product:          s.product,
      bot:              s.bot,
    })),
    sales: lead.sales.map((s) => ({
      id:               s.id,
      status:           s.status,
      paymentMethod:    s.paymentMethod,
      grossAmountCents: s.grossAmountCents,
      createdAt:        s.createdAt.toISOString(),
      paidAt:           s.paidAt?.toISOString() ?? null,
      product:          s.product,
    })),
  }

  return <CustomerDashboard data={data} />
}
