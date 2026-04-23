import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const SECRET = "botflows-setup-2025"
const ADMIN_EMAIL = "samuelcoprod@gmail.com"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  })

  return NextResponse.json({ ok: true, user })
}
