import { NextResponse } from "next/server"
import { readFileSync } from "fs"

// Temporary diagnostic endpoint — delete after confirming env vars work
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== "diag-botflows-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const k = process.env.GATEWAY_API_KEY ?? ""
  const db = process.env.DATABASE_URL ?? ""

  // Read raw .env from disk to compare with process.env
  let envFileGatewayKey = "COULD_NOT_READ"
  let envFileExists = false
  try {
    const raw = readFileSync("/var/www/botsales/.env", "utf-8")
    envFileExists = true
    const match = raw.match(/^GATEWAY_API_KEY=(.*)$/m)
    if (match) {
      const val = match[1].replace(/^['"]|['"]$/g, "") // strip surrounding quotes
      envFileGatewayKey = val ? `${val.slice(0, 12)}... (${val.length} chars)` : "EMPTY_VALUE"
    } else {
      envFileGatewayKey = "KEY_NOT_FOUND_IN_FILE"
    }
  } catch {
    envFileGatewayKey = "FILE_READ_ERROR"
  }

  return NextResponse.json({
    process_env: {
      GATEWAY_API_KEY: k ? `${k.slice(0, 12)}... (${k.length} chars)` : "❌ NOT SET",
      DATABASE_URL: db ? `${db.slice(0, 25)}... (${db.length} chars)` : "❌ NOT SET",
      ASAAS_ENVIRONMENT: process.env.ASAAS_ENVIRONMENT ?? "❌ NOT SET",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "❌ NOT SET",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "❌ NOT SET",
      ENCRYPTION_KEY_set: !!process.env.ENCRYPTION_KEY,
      REDIS_URL_set: !!process.env.REDIS_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    dot_env_file: {
      exists: envFileExists,
      GATEWAY_API_KEY: envFileGatewayKey,
    },
  })
}
