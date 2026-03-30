import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.registrationStep = (user as any).registrationStep
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).registrationStep = token.registrationStep
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
