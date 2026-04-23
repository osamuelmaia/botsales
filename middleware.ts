import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

const ROOT_DOMAIN = "botflows.com.br"
const DASH_HOST   = `dashboard.${ROOT_DOMAIN}`

export default auth((req) => {
  const { nextUrl } = req
  const hostname = req.headers.get("host") ?? ""

  // ─── Domain routing (production only) ──────────────────────────────
  const isLocal = hostname.includes("localhost") || hostname.includes("127.0.0.1")

  if (!isLocal) {
    const isDash = hostname === DASH_HOST || hostname.startsWith("dashboard.")
    const isRoot = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`

    // dashboard.botflows.com.br/ → /login
    if (isDash && nextUrl.pathname === "/") {
      return Response.redirect(new URL("/login", nextUrl))
    }

    // botflows.com.br/<qualquer rota exceto /> → dashboard subdomain
    if (isRoot && nextUrl.pathname !== "/") {
      const target = new URL(nextUrl.href)
      target.host = DASH_HOST
      return Response.redirect(target)
    }
  }

  // ─── Auth routing ───────────────────────────────────────────────────
  const isAuthenticated  = !!req.auth
  const role             = (req.auth?.user as { role?: string } | undefined)?.role
  const isAuthRoute      = nextUrl.pathname === "/login" || nextUrl.pathname === "/register"
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard")
  const isAdminRoute     = nextUrl.pathname.startsWith("/admin")

  if (isAdminRoute) {
    if (!isAuthenticated) return Response.redirect(new URL("/login", nextUrl))
    if (role !== "ADMIN")  return Response.redirect(new URL("/dashboard", nextUrl))
  }

  if (isDashboardRoute && !isAuthenticated) {
    return Response.redirect(new URL("/login", nextUrl))
  }

  if (isAuthRoute && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", nextUrl))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|fonts|favicon\\.ico|.*\\..*).*)" ],
}
