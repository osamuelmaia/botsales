import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const MIN_WITHDRAWAL_CENTS = 1000 // R$ 10,00

const createSchema = z.object({
  amountCents: z.number().int().min(MIN_WITHDRAWAL_CENTS, {
    message: `Valor mínimo para saque é R$ ${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2).replace(".", ",")}`,
  }),
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
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const { amountCents, bankAccountId } = parsed.data

  // Verify bank account belongs to user
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, userId },
  })
  if (!bankAccount) {
    return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 })
  }

  // Duplicate detection — block identical request within 60 seconds
  const recentDuplicate = await prisma.withdrawal.findFirst({
    where: {
      userId,
      bankAccountId,
      amountCents,
      status: "REQUESTED",
      requestedAt: { gte: new Date(Date.now() - 60_000) },
    },
  })
  if (recentDuplicate) {
    return NextResponse.json(
      { error: "Solicitação duplicada. Aguarde antes de tentar novamente." },
      { status: 429 },
    )
  }

  // Balance check — reserves REQUESTED + PROCESSING + COMPLETED to prevent double-spending
  const now = new Date()
  const [approvedSales, existingWithdrawals] = await Promise.all([
    prisma.sale.findMany({
      where: { userId, status: "APPROVED", availableAt: { lte: now } },
      select: { netAmountCents: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId, status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] } },
      select: { amountCents: true },
    }),
  ])

  const availableCents = approvedSales.reduce((s, x) => s + x.netAmountCents, 0)
  const reservedCents  = existingWithdrawals.reduce((s, x) => s + x.amountCents, 0)
  const balanceCents   = Math.max(0, availableCents - reservedCents)

  if (amountCents > balanceCents) {
    return NextResponse.json(
      { error: `Saldo insuficiente. Disponível: R$ ${(balanceCents / 100).toFixed(2).replace(".", ",")}` },
      { status: 422 },
    )
  }

  const withdrawal = await prisma.withdrawal.create({
    data: { userId, bankAccountId, amountCents, status: "REQUESTED" },
    include: { bankAccount: true },
  })

  return NextResponse.json({ withdrawal }, { status: 201 })
}
