import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createCustomerToken, CUSTOMER_COOKIE } from "@/lib/customer-auth"
import { z } from "zod"

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 422 })
  }

  const { email, password } = parsed.data

  // Find lead by email (may have multiple bots, pick the one with portal access)
  const lead = await prisma.lead.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, portalPasswordHash: { not: null } },
    select: { id: true, name: true, email: true, portalPasswordHash: true },
  })

  if (!lead || !lead.portalPasswordHash) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 })
  }

  const match = await bcrypt.compare(password, lead.portalPasswordHash)
  if (!match) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 })
  }

  const token = createCustomerToken({ leadId: lead.id, email: lead.email ?? email })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 30, // 30 days
  })
  return res
}
