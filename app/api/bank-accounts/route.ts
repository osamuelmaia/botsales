import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  bankCode: z.string().min(3).max(10),
  agency: z.string().min(1).max(10),
  account: z.string().min(1).max(20),
  accountType: z.enum(["CHECKING", "SAVINGS"]),
  holderName: z.string().min(2).max(100),
  document: z.string().min(11).max(18),
  pixKey: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { isDefault, ...data } = parsed.data

  // If setting as default, unset existing defaults
  if (isDefault) {
    await prisma.bankAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const account = await prisma.bankAccount.create({
    data: { ...data, userId, isDefault: isDefault ?? false },
  })

  return NextResponse.json({ account }, { status: 201 })
}
