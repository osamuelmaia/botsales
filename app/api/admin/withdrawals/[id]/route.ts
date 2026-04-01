import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), adminNote: z.string().min(1, "Informe o motivo da recusa") }),
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  const adminId = session.user.id

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: params.id } })
  if (!withdrawal) {
    return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 })
  }
  if (withdrawal.status !== "REQUESTED") {
    return NextResponse.json(
      { error: `Este saque já foi ${withdrawal.status === "COMPLETED" ? "aprovado" : withdrawal.status === "FAILED" ? "recusado" : "processado"}` },
      { status: 422 },
    )
  }

  const now = new Date()

  type WithdrawalUpdateData = Record<string, unknown>

  if (parsed.data.action === "approve") {
    const updated = await prisma.withdrawal.update({
      where: { id: params.id },
      data: { status: "PROCESSING", reviewedBy: adminId, reviewedAt: now } as WithdrawalUpdateData,
    })
    return NextResponse.json({ withdrawal: updated })
  }

  // Reject — balance is automatically restored since we exclude FAILED from reserved
  const updated = await prisma.withdrawal.update({
    where: { id: params.id },
    data: { status: "FAILED", adminNote: parsed.data.adminNote, reviewedBy: adminId, reviewedAt: now } as WithdrawalUpdateData,
  })
  return NextResponse.json({ withdrawal: updated })
}

// Mark a PROCESSING withdrawal as COMPLETED (payment sent)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: params.id } })
  if (!withdrawal) {
    return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 })
  }
  if (withdrawal.status !== "PROCESSING") {
    return NextResponse.json({ error: "Apenas saques em processamento podem ser marcados como concluídos" }, { status: 422 })
  }

  const updated = await prisma.withdrawal.update({
    where: { id: params.id },
    data: { status: "COMPLETED", processedAt: new Date() },
  })
  return NextResponse.json({ withdrawal: updated })
}
