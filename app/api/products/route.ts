import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { productSchema } from "@/lib/validations/product"

function generateShortId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(16)
  let id = ""
  for (let i = 0; i < bytes.length && id.length < 8; i++) {
    const b = bytes[i]
    if (b < 186) id += chars[b % 62] // 186 = 62*3, uniform distribution
  }
  return id.padEnd(8, "A")
}

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

  const { isRecurring, billingType, ...rest } = parsed.data

  const product = await prisma.product.create({
    data: {
      ...rest,
      shortId: generateShortId(),
      userId: session.user.id,
      isRecurring,
      billingType: isRecurring ? (billingType ?? null) : null,
      billingCycles: null,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
