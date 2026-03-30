import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { productSchema } from "@/lib/validations/product"

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const existing = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { isRecurring, billingType, billingCycles, ...rest } = parsed.data

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...rest,
      isRecurring,
      billingType: isRecurring ? (billingType ?? null) : null,
      billingCycles: isRecurring ? (billingCycles ?? null) : null,
    },
  })

  return NextResponse.json(product)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
  }

  const linkedToActiveBot = await prisma.botProduct.findFirst({
    where: { productId: params.id, bot: { isActive: true } },
  })
  if (linkedToActiveBot) {
    return NextResponse.json(
      { error: "Produto vinculado a um bot ativo. Desative o bot antes de deletar." },
      { status: 409 }
    )
  }

  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
