import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

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

  const updated = await prisma.withdrawal.update({
    where: { id: params.id },
    data: { status: "FAILED", adminNote: parsed.data.adminNote, reviewedBy: adminId, reviewedAt: now } as WithdrawalUpdateData,
  })
  return NextResponse.json({ withdrawal: updated })
}

// Mark a PROCESSING withdrawal as COMPLETED — optionally accepts multipart with proof image
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

  // Try to save proof image if provided
  let proofPath: string | null = null
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData()
      const file = formData.get("proof") as File | null
      if (file && file.size > 0) {
        const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if (!ALLOWED.includes(file.type)) {
          return NextResponse.json({ error: "Apenas imagens JPEG, PNG, WebP ou GIF são aceitas" }, { status: 400 })
        }
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "Comprovante deve ter no máximo 5MB" }, { status: 400 })
        }
        const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
        const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt : "jpg"
        const dir = path.join(process.cwd(), "data", "proofs")
        await mkdir(dir, { recursive: true })
        const filename = `${params.id}.${safeExt}`
        await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
        proofPath = filename
      }
    } catch (err) {
      console.error("[proof-upload]", err)
      // Don't block completion if upload fails — log and continue
    }
  }

  const updated = await prisma.withdrawal.update({
    where: { id: params.id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      ...(proofPath ? { proofPath } : {}),
    },
  })
  return NextResponse.json({ withdrawal: updated })
}

