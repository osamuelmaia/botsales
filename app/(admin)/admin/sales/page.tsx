import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SalesAdmin } from "./SalesAdmin"

export default async function AdminSalesPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user:    { select: { id: true, name: true, email: true } },
        lead:    { select: { name: true, email: true, phone: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.sale.count(),
  ])

  const initialData = sales.map((s) => ({
    id:               s.id,
    createdAt:        s.createdAt.toISOString(),
    paidAt:           s.paidAt?.toISOString()      ?? null,
    availableAt:      s.availableAt?.toISOString() ?? null,
    gatewayId:        s.gatewayId                  ?? null,
    status:           s.status,
    paymentMethod:    s.paymentMethod,
    grossAmountCents: s.grossAmountCents,
    feeAmountCents:   s.feeAmountCents,
    netAmountCents:   s.netAmountCents,
    user:             s.user,
    lead:             s.lead,
    product:          s.product,
  }))

  return <SalesAdmin initialData={initialData} initialTotal={total} />
}
