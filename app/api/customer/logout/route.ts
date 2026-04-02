import { NextResponse } from "next/server"
import { CUSTOMER_COOKIE } from "@/lib/customer-auth"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(CUSTOMER_COOKIE, "", { maxAge: 0, path: "/" })
  return res
}
