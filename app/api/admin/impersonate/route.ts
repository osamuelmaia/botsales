import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { encode } from "@auth/core/jwt"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const RETURN_COOKIE = "_admin_return"
const SESSION_COOKIE_HTTP  = "authjs.session-token"
const SESSION_COOKIE_HTTPS = "__Secure-authjs.session-token"

function getSessionCookieName(req: NextRequest): string {
  const url = req.url
  return url.startsWith("https://") ? SESSION_COOKIE_HTTPS : SESSION_COOKIE_HTTP
}

// POST — start impersonation
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { userId } = body as { userId?: string }
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, registrationStep: true },
  })
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Segredo de autenticação não configurado" }, { status: 503 })
  }

  const cookieName = getSessionCookieName(req)
  const secure = cookieName.startsWith("__Secure-")
  const cookieJar = await cookies()

  // Save current admin token for restoration
  const adminToken = cookieJar.get(cookieName)?.value ?? ""

  const now   = Math.floor(Date.now() / 1000)
  const maxAge = 30 * 24 * 60 * 60

  const newToken = await encode({
    salt: cookieName,
    secret,
    token: {
      sub: target.id,
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      registrationStep: target.registrationStep,
      iat: now,
      exp: now + maxAge,
      jti: crypto.randomUUID(),
    },
    maxAge,
  })

  const res = NextResponse.json({ ok: true })

  // Persist admin token so we can restore it
  res.cookies.set(RETURN_COOKIE, adminToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  })

  // Overwrite session with impersonated user
  res.cookies.set(cookieName, newToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  })

  return res
}

// DELETE — stop impersonation, restore admin session
export async function DELETE(req: NextRequest) {
  const cookieName = getSessionCookieName(req)
  const secure = cookieName.startsWith("__Secure-")
  const cookieJar = await cookies()
  const adminToken = cookieJar.get(RETURN_COOKIE)?.value

  if (!adminToken) {
    return NextResponse.json({ error: "Nenhuma sessão de impersonação ativa" }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })

  // Restore admin session
  res.cookies.set(cookieName, adminToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  })

  // Clear return cookie
  res.cookies.set(RETURN_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  return res
}
