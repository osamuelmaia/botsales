/**
 * Customer portal JWT authentication
 * Uses HMAC-SHA256 with NEXTAUTH_SECRET — no extra dependencies
 */

import crypto from "crypto"
import { cookies } from "next/headers"

export const CUSTOMER_COOKIE = "customer_session"
const EXPIRES_DAYS = 30

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error("NEXTAUTH_SECRET not set")
  return s
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf
  return b.toString("base64url")
}

function sign(payload: object): string {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body    = b64url(JSON.stringify(payload))
  const data    = `${header}.${body}`
  const sig     = crypto.createHmac("sha256", secret()).update(data).digest()
  return `${data}.${b64url(sig)}`
}

function verify(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(`${header}.${body}`).digest()
  )
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}

export interface CustomerPayload {
  leadId: string
  email:  string
}

export function createCustomerToken(payload: CustomerPayload): string {
  return sign({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + EXPIRES_DAYS * 86400,
  })
}

export function verifyCustomerToken(token: string): CustomerPayload | null {
  const p = verify(token)
  if (!p || typeof p.leadId !== "string" || typeof p.email !== "string") return null
  return { leadId: p.leadId as string, email: p.email as string }
}

/** Server-component helper: reads & verifies the cookie, returns payload or null */
export async function getCustomerSession(): Promise<CustomerPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  return verifyCustomerToken(token)
}
