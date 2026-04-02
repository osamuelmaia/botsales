import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeDecrypt } from "@/lib/utils"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const cuidRegex = /^c[a-z0-9]{24}$/

const updateSchema = z.object({
  platformFeePercent: z.number().min(0).max(50).optional(),
  platformFeeCents:   z.number().int().min(0).max(10000).optional(),
  withdrawalDays:     z.number().int().min(0).max(90).optional(),
  registrationStep:   z.union([z.literal(1), z.literal(2)]).optional(),
  role:               z.enum(["USER", "ADMIN"]).optional(),
}).refine((d) => Object.keys(d).length > 0, "Nenhum campo para atualizar")

// ─── GET /api/admin/users/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  if (!cuidRegex.test(params.id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  type AggRow = {
    approved: bigint; pending: bigint; refused: bigint; refunded: bigint; chargeback: bigint
    gmv: bigint; fee: bigint; net: bigint
    pixcount: bigint; pixgmv: bigint; cardcount: bigint; cardgmv: bigint
  }

  const [user, aggRows] = await Promise.all([
  prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, document: true, phone: true,
      registrationStep: true, role: true, personType: true,
      platformFeePercent: true, platformFeeCents: true, withdrawalDays: true,
      zipCode: true, street: true, number: true, complement: true,
      neighborhood: true, city: true, state: true,
      createdAt: true, updatedAt: true,
      bots: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, isActive: true, createdAt: true,
          _count: { select: { leads: true, flowNodes: true } },
        },
      },
      products: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, priceInCents: true, isRecurring: true },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, paymentMethod: true,
          grossAmountCents: true, feeAmountCents: true, netAmountCents: true,
          createdAt: true, paidAt: true,
          lead:    { select: { name: true } },
          product: { select: { name: true } },
        },
      },
      withdrawals: {
        orderBy: { requestedAt: "desc" },
        take: 5,
        select: {
          id: true, amountCents: true, status: true,
          requestedAt: true, processedAt: true, adminNote: true,
          bankAccount: true,
        },
      },
    },
  })

    }),
    prisma.$queryRaw<AggRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'APPROVED')::bigint                              AS approved,
        COUNT(*) FILTER (WHERE status = 'PENDING')::bigint                               AS pending,
        COUNT(*) FILTER (WHERE status = 'REFUSED')::bigint                               AS refused,
        COUNT(*) FILTER (WHERE status = 'REFUNDED')::bigint                              AS refunded,
        COUNT(*) FILTER (WHERE status = 'CHARGEBACK')::bigint                            AS chargeback,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE status = 'APPROVED'), 0)::bigint  AS gmv,
        COALESCE(SUM("feeAmountCents")   FILTER (WHERE status = 'APPROVED'), 0)::bigint  AS fee,
        COALESCE(SUM("netAmountCents")   FILTER (WHERE status = 'APPROVED'), 0)::bigint  AS net,
        COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'PIX')::bigint  AS pixcount,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'PIX'), 0)::bigint AS pixgmv,
        COUNT(*) FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'CREDIT_CARD')::bigint AS cardcount,
        COALESCE(SUM("grossAmountCents") FILTER (WHERE status = 'APPROVED' AND "paymentMethod" = 'CREDIT_CARD'), 0)::bigint AS cardgmv
      FROM "Sale"
      WHERE "userId" = ${params.id}
    `,
  ])

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

  const r = aggRows[0]
  const salesAggregate = r ? {
    approved:   Number(r.approved),
    pending:    Number(r.pending),
    refused:    Number(r.refused),
    refunded:   Number(r.refunded),
    chargeback: Number(r.chargeback),
    gmv:        Number(r.gmv),
    fee:        Number(r.fee),
    net:        Number(r.net),
    pixCount:   Number(r.pixcount),
    pixGmv:     Number(r.pixgmv),
    cardCount:  Number(r.cardcount),
    cardGmv:    Number(r.cardgmv),
  } : { approved: 0, pending: 0, refused: 0, refunded: 0, chargeback: 0, gmv: 0, fee: 0, net: 0, pixCount: 0, pixGmv: 0, cardCount: 0, cardGmv: 0 }

  return NextResponse.json({
    ...user,
    salesAggregate,
    platformFeePercent: Number(user.platformFeePercent),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    bots: user.bots.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })),
    sales: user.sales.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      paidAt:    s.paidAt?.toISOString() ?? null,
    })),
    withdrawals: user.withdrawals.map((w) => ({
      ...w,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      bankAccount: {
        ...w.bankAccount,
        agency:   safeDecrypt(w.bankAccount.agency),
        account:  safeDecrypt(w.bankAccount.account),
        document: safeDecrypt(w.bankAccount.document),
        pixKey:   w.bankAccount.pixKey ? safeDecrypt(w.bankAccount.pixKey) : null,
        createdAt: w.bankAccount.createdAt.toISOString(),
      },
    })),
  })
}

// ─── PATCH /api/admin/users/[id] ──────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  const adminId = session?.user?.id
  if (!adminId || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  if (!cuidRegex.test(params.id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 422 })
  }

  const { platformFeePercent, platformFeeCents, withdrawalDays, registrationStep, role } = parsed.data

  const data: Prisma.UserUpdateInput = {}
  if (platformFeePercent !== undefined) data.platformFeePercent = new Prisma.Decimal(platformFeePercent)
  if (platformFeeCents   !== undefined) data.platformFeeCents   = platformFeeCents
  if (withdrawalDays     !== undefined) data.withdrawalDays     = withdrawalDays
  if (registrationStep   !== undefined) data.registrationStep   = registrationStep
  if (role               !== undefined) data.role               = role

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true, name: true, platformFeePercent: true,
      platformFeeCents: true, withdrawalDays: true,
      registrationStep: true, role: true,
    },
  })

  console.log(`[admin] user ${params.id} updated by ${adminId}:`, parsed.data)

  return NextResponse.json({
    ...updated,
    platformFeePercent: Number(updated.platformFeePercent),
  })
}
