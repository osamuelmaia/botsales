import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { profileSchema } from "@/lib/validations/user"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      registrationStep: true,
      personType: true,
      document: true,
      phone: true,
      zipCode: true,
      street: true,
      number: true,
      complement: true,
      neighborhood: true,
      city: true,
      state: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const {
    personType,
    document,
    phone,
    zipCode,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
  } = parsed.data

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      personType,
      document,
      phone,
      zipCode,
      street,
      number,
      complement: complement || null,
      neighborhood,
      city,
      state,
      registrationStep: 2,
    },
    select: { registrationStep: true },
  })

  return NextResponse.json(user)
}
