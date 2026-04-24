import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: params.id } })
  if (!withdrawal) {
    return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 })
  }

  const proofPath = (withdrawal as Record<string, unknown>).proofPath as string | null
  if (!proofPath) {
    return NextResponse.json({ error: "Comprovante não disponível" }, { status: 404 })
  }

  // Prevent directory traversal — only use the basename
  const safeFilename = path.basename(proofPath)
  const filePath = path.join(process.cwd(), "data", "proofs", safeFilename)

  let fileBuffer: Buffer
  try {
    fileBuffer = await readFile(filePath)
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 })
  }

  const ext = safeFilename.split(".").pop()?.toLowerCase() ?? "jpg"
  const MIME: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", gif: "image/gif",
  }
  const contentType = MIME[ext] ?? "application/octet-stream"

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "Content-Disposition": `inline; filename="${safeFilename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
