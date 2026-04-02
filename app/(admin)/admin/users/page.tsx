import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UsersClient } from "./UsersClient"

export default async function AdminUsersPage() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard")

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        document: true,
        registrationStep: true,
        role: true,
        platformFeePercent: true,
        platformFeeCents: true,
        createdAt: true,
        _count: { select: { bots: true, products: true, sales: true } },
      },
    }),
    prisma.user.count(),
  ])

  const initialData = users.map((u) => ({
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    document:           u.document,
    registrationStep:   u.registrationStep,
    role:               u.role,
    platformFeePercent: Number(u.platformFeePercent),
    platformFeeCents:   u.platformFeeCents,
    createdAt:          u.createdAt.toISOString(),
    _count:             u._count,
  }))

  return <UsersClient initialData={initialData} initialTotal={total} />
}
