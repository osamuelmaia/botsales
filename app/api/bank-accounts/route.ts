import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { encryptToken, safeDecrypt } from "@/lib/utils"

const createSchema = z.object({
  bankCode: z.string().min(3).max(10),
  agency: z.string().min(1).max(10),
  account: z.string().min(1).max(20),
  accountType: z.enum(["CHECKING", "SAVINGS"]),
  holderName: z.string().min(2).max(100),
  document: z.string().min(14).max(18),
  pixKey: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
})

// Decrypt sensitive fields for API response
function decryptAccount(a: {
  id: string; userId: string; bankCode: string; agency: string; account: string
  accountType: string; holderName: string; document: string; pixKey: string | null
  isDefault: boolean; createdAt: Date
}) {
  return {
    ...a,
    agency: safeDecrypt(a.agency),
    account: safeDecrypt(a.account),
    document: safeDecrypt(a.document),
    pixKey: a.pixKey ? safeDecrypt(a.pixKey) : null,
    createdAt: a.createdAt.toISOString(),
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ accounts: accounts.map(decryptAccount) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { isDefault, ...data } = parsed.data

  if (isDefault) {
    await prisma.bankAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const account = await prisma.bankAccount.create({
    data: {
      ...data,
      agency: encryptToken(data.agency),
      account: encryptToken(data.account),
      document: encryptToken(data.document),
      pixKey: data.pixKey ? encryptToken(data.pixKey) : null,
      userId,
      isDefault: isDefault ?? false,
    },
  })

  return NextResponse.json({ account: decryptAccount(account) }, { status: 201 })
}
