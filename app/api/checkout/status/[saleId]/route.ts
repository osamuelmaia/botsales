import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const cuidRegex = /^c[a-z0-9]{24}$/

// ─── GET /api/checkout/status/[saleId] — rota pública para polling ───────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { saleId: string } }
) {
  if (!cuidRegex.test(params.saleId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const sale = await prisma.sale.findUnique({
    where: { id: params.saleId },
    select: { status: true },
  })

  if (!sale) {
    return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 })
  }

  return NextResponse.json({ status: sale.status })
}
