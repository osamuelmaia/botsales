import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  amountCents: z.number().int().positive(),
  bankAccountId: z.string().cuid(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.user.id },
    include: { bankAccount: true },
    orderBy: { requestedAt: "desc" },
  })

  return NextResponse.json({ withdrawals })
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
  const { amountCents, bankAccountId } = parsed.data

  // Verify bank account belongs to user
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, userId },
  })
  if (!bankAccount) {
    return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 })
  }

  // Calculate available balance
  const now = new Date()
  const [approvedSales, existingWithdrawals] = await Promise.all([
    prisma.sale.findMany({
      where: { userId, status: "APPROVED", availableAt: { lte: now } },
      select: { netAmountCents: true },
    }),
    prisma.withdrawal.findMany({
      where: {
        userId,
        status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] },
      },
      select: { amountCents: true },
    }),
  ])

  const availableCents = approvedSales.reduce((s, x) => s + x.netAmountCents, 0)
  const withdrawnCents = existingWithdrawals.reduce((s, x) => s + x.amountCents, 0)
  const balanceCents = Math.max(0, availableCents - withdrawnCents)

  if (amountCents > balanceCents) {
    return NextResponse.json(
      { error: `Saldo insuficiente. Disponível: R$ ${(balanceCents / 100).toFixed(2)}` },
      { status: 422 },
    )
  }

  const withdrawal = await prisma.withdrawal.create({
    data: { userId, bankAccountId, amountCents, status: "REQUESTED" },
    include: { bankAccount: true },
  })

  return NextResponse.json({ withdrawal }, { status: 201 })
}
