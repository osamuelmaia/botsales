import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeDecrypt } from "@/lib/utils"

function requireAdmin(role: string | undefined) {
  return role === "ADMIN"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !requireAdmin((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") ?? "REQUESTED"
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit  = 50

  const where = status === "ALL" ? {} : { status: status as "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED" }

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        bankAccount: true,
      },
    }),
    prisma.withdrawal.count({ where }),
  ])

  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({
      id: w.id, amountCents: w.amountCents, status: w.status,
      adminNote:  (w as Record<string, unknown>).adminNote ?? null,
      reviewedBy: (w as Record<string, unknown>).reviewedBy ?? null,
      proofPath:  (w as Record<string, unknown>).proofPath ?? null,
      user: w.user,
      requestedAt: w.requestedAt.toISOString(),
      reviewedAt:  ((w as Record<string, unknown>).reviewedAt as Date | null)?.toISOString() ?? null,
      processedAt: w.processedAt?.toISOString() ?? null,
      bankAccount: {
        ...w.bankAccount,
        agency:    safeDecrypt(w.bankAccount.agency),
        account:   safeDecrypt(w.bankAccount.account),
        document:  safeDecrypt(w.bankAccount.document),
        pixKey:    w.bankAccount.pixKey ? safeDecrypt(w.bankAccount.pixKey) : null,
        createdAt: w.bankAccount.createdAt.toISOString(),
      },
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}
