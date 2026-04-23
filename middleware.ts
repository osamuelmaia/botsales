import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

const ROOT_DOMAIN = "botflows.com.br"
const DASH_HOST   = `dashboard.${ROOT_DOMAIN}`

// Rotas que exigem autenticação
const PROTECTED_PREFIXES = ["/dashboard", "/sales", "/products", "/bots", "/wallet", "/settings"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  )
}

export default auth((req) => {
  const { nextUrl } = req
  const hostname = req.headers.get("host") ?? ""

  // ─── Domain routing (produção apenas) ──────────────────────────────
  const isLocal = hostname.includes("localhost") || hostname.includes("127.0.0.1")

  if (!isLocal) {
    const isDash = hostname === DASH_HOST || hostname.startsWith("dashboard.")
    const isRoot = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`

    // dashboard.botflows.com.br/ → /dashboard (auth check cuidará do redirect)
    if (isDash && nextUrl.pathname === "/") {
      return Response.redirect(
        new URL(`https://${DASH_HOST}/dashboard`),
        302,
      )
    }

    // botflows.com.br/<qualquer rota exceto /> → dashboard subdomain
    if (isRoot && nextUrl.pathname !== "/") {
      return Response.redirect(
        new URL(`https://${DASH_HOST}${nextUrl.pathname}${nextUrl.search}`),
        302,
      )
    }
  }

  // ─── Auth routing ───────────────────────────────────────────────────
  const isAuthenticated = !!req.auth
  const role            = (req.auth?.user as { role?: string } | undefined)?.role
  const isAuthRoute     = nextUrl.pathname === "/login" || nextUrl.pathname === "/register"
  const isAdminRoute    = nextUrl.pathname.startsWith("/admin")

  if (isAdminRoute) {
    if (!isAuthenticated) return Response.redirect(new URL("/login", nextUrl))
    if (role !== "ADMIN")  return Response.redirect(new URL("/dashboard", nextUrl))
  }

  if (isProtected(nextUrl.pathname) && !isAuthenticated) {
    return Response.redirect(new URL("/login", nextUrl))
  }

  if (isAuthRoute && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", nextUrl))
  }
})

export const config = {
  matcher: ["/((?!api|_next|fonts|favicon\\.ico|.*\\.[a-zA-Z]{2,4}$).*)"],
}
