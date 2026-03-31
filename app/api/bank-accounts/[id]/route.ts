import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  isDefault: z.boolean().optional(),
  pixKey: z.string().max(100).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = params

  const account = await prisma.bankAccount.findFirst({ where: { id, userId } })
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { isDefault, ...rest } = parsed.data

  if (isDefault) {
    await prisma.bankAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: { ...rest, ...(isDefault !== undefined ? { isDefault } : {}) },
  })

  return NextResponse.json({ account: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }

  // Prevent deletion if there are pending/processing withdrawals using this account
  const activeWithdrawals = await prisma.withdrawal.count({
    where: {
      bankAccountId: params.id,
      status: { in: ["REQUESTED", "PROCESSING"] },
    },
  })
  if (activeWithdrawals > 0) {
    return NextResponse.json(
      { error: "Não é possível remover conta com saques pendentes" },
      { status: 422 },
    )
  }

  await prisma.bankAccount.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
