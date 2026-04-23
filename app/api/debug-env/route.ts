import { NextResponse } from "next/server"

// Temporary diagnostic endpoint — delete after confirming env vars work
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== "diag-botflows-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const k = process.env.GATEWAY_API_KEY ?? ""
  const db = process.env.DATABASE_URL ?? ""

  return NextResponse.json({
    GATEWAY_API_KEY: k ? `${k.slice(0, 10)}... (${k.length} chars)` : "❌ NOT SET",
    DATABASE_URL:    db ? `${db.slice(0, 25)}... (${db.length} chars)` : "❌ NOT SET",
    ASAAS_ENVIRONMENT:      process.env.ASAAS_ENVIRONMENT      ?? "❌ NOT SET",
    AUTH_TRUST_HOST:        process.env.AUTH_TRUST_HOST         ?? "❌ NOT SET",
    NEXTAUTH_URL:           process.env.NEXTAUTH_URL            ?? "❌ NOT SET",
    ENCRYPTION_KEY_set:     !!process.env.ENCRYPTION_KEY,
    REDIS_URL_set:          !!process.env.REDIS_URL,
    NODE_ENV: process.env.NODE_ENV,
  })
}
