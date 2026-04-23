import { NextResponse } from "next/server"
import { readFileSync, readdirSync, statSync } from "fs"
import os from "os"

export const dynamic = "force-dynamic"

// Temporary diagnostic endpoint — delete after confirming env vars work
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== "diag-botflows-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawKey = process.env.GATEWAY_API_KEY
  const db = process.env.DATABASE_URL ?? ""

  // List all .env* files in app dir
  const appDir = "/var/www/botsales"
  let envFilesOnDisk: Array<{ name: string; size: number }> = []
  try {
    envFilesOnDisk = readdirSync(appDir)
      .filter((f) => f.startsWith(".env"))
      .map((name) => {
        try {
          return { name, size: statSync(`${appDir}/${name}`).size }
        } catch {
          return { name, size: -1 }
        }
      })
  } catch {}

  // Read raw .env
  let envRaw = ""
  let envFileLines: string[] = []
  try {
    envRaw = readFileSync(`${appDir}/.env`, "utf-8")
    envFileLines = envRaw.split("\n").map((line) => {
      const eq = line.indexOf("=")
      if (eq === -1) return line
      const key = line.slice(0, eq)
      const val = line.slice(eq + 1)
      // Redact: show first 8 and last 3 chars of value, and length
      const clean = val.replace(/^['"]|['"]$/g, "")
      if (clean.length === 0) return `${key}=[EMPTY]`
      if (clean.length < 15) return `${key}=[${clean.length} chars, short]`
      return `${key}=${clean.slice(0, 8)}...${clean.slice(-3)} [${clean.length} chars]`
    })
  } catch (e) {
    envFileLines = [`READ_ERROR: ${(e as Error).message}`]
  }

  // Env vars related to gateway/asaas/auth
  const relevantEnvKeys = Object.keys(process.env)
    .filter((k) =>
      /GATEWAY|ASAAS|DATABASE|REDIS|NEXTAUTH|ENCRYPTION|BLOB|APP_URL|AUTH_TRUST/i.test(k),
    )
    .sort()

  const relevantEnv: Record<string, string> = {}
  for (const k of relevantEnvKeys) {
    const v = process.env[k] ?? ""
    if (v.length === 0) relevantEnv[k] = "[EMPTY STRING]"
    else if (v.length < 15) relevantEnv[k] = `[${v.length} chars, short]`
    else relevantEnv[k] = `${v.slice(0, 10)}...${v.slice(-3)} [${v.length} chars]`
  }

  return NextResponse.json({
    hostname: os.hostname(),
    pid: process.pid,
    node: process.version,
    cwd: process.cwd(),
    node_env: process.env.NODE_ENV,
    gateway_key_status: {
      typeof: typeof rawKey,
      is_undefined: rawKey === undefined,
      is_empty: rawKey === "",
      length: rawKey?.length ?? null,
      preview: rawKey ? `${rawKey.slice(0, 12)}...` : null,
    },
    database_url_preview: db ? `${db.slice(0, 25)}... (${db.length} chars)` : "❌ NOT SET",
    env_files_on_disk: envFilesOnDisk,
    env_file_parsed_lines: envFileLines,
    process_env_relevant: relevantEnv,
  })
}
