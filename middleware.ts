import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isAuthenticated = !!req.auth

  const isAuthRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/register"
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard")

  if (isDashboardRoute && !isAuthenticated) {
    return Response.redirect(new URL("/login", nextUrl))
  }

  if (isAuthRoute && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", nextUrl))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
}
