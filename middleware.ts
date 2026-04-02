import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isAuthenticated = !!req.auth
  const role = (req.auth?.user as { role?: string } | undefined)?.role

  const isAuthRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/register"
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard")
  const isAdminRoute = nextUrl.pathname.startsWith("/admin")

  // Admin routes: must be authenticated AND have ADMIN role
  if (isAdminRoute) {
    if (!isAuthenticated) return Response.redirect(new URL("/login", nextUrl))
    if (role !== "ADMIN") return Response.redirect(new URL("/dashboard", nextUrl))
  }

  if (isDashboardRoute && !isAuthenticated) {
    return Response.redirect(new URL("/login", nextUrl))
  }

  if (isAuthRoute && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", nextUrl))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
}
