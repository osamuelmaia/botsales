import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { productSchema } from "@/lib/validations/product"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { isRecurring, billingType, billingCycles, ...rest } = parsed.data

  const product = await prisma.product.create({
    data: {
      ...rest,
      userId: session.user.id,
      isRecurring,
      billingType: isRecurring ? (billingType ?? null) : null,
      billingCycles: isRecurring ? (billingCycles ?? null) : null,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
