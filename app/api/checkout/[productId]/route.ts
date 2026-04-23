import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ─── GET /api/checkout/[productId] — dados públicos do produto ────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { productId: string } }
) {
  if (!/^[A-Za-z0-9]{7,30}$/.test(params.productId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { OR: [{ id: params.productId }, { shortId: params.productId }] },
    select: {
      id: true,
      name: true,
      description: true,
      priceInCents: true,
      paymentMethods: true,
      isRecurring: true,
      billingType: true,
      billingCycles: true,
      user: { select: { name: true } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    id: product.id,
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    paymentMethods: product.paymentMethods,
    isRecurring: product.isRecurring,
    billingType: product.billingType,
    billingCycles: product.billingCycles,
    sellerName: product.user.name,
  })
}
