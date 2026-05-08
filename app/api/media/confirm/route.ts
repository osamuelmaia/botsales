import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MAX_FILES_PER_USER, MAX_TOTAL_BYTES_PER_USER } from "@/lib/media-upload"

// ─── POST /api/media/confirm ──────────────────────────────────────────────────
// After a successful client-upload to Vercel Blob, the browser calls this
// route to register the resulting blob in the database. Runs in addition to
// the (production-only) signed webhook in /api/media/upload, so the flow
// also works in local development where webhooks can't reach localhost.

interface ConfirmBody {
  pathname?: string
  url?: string
  contentType?: string
  sizeBytes?: number
  originalName?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  let body: ConfirmBody
  try {
    body = (await req.json()) as ConfirmBody
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const { pathname, url, contentType, originalName } = body
  const sizeBytes = Number(body.sizeBytes ?? 0)

  if (!pathname || !url) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  // Pathname must belong to this user to prevent claiming someone else's blob
  const allowedPrefixes = [
    `bot-image/${userId}/`,
    `bot-video/${userId}/`,
    `bot-audio/${userId}/`,
    `bot-files/${userId}/`,
  ]
  if (!allowedPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 403 })
  }

  // Quota recheck (race-safe-ish — an attacker could parallelize but limits
  // are coarse and the worst case is a small overage).
  const [count, agg] = await Promise.all([
    prisma.botMedia.count({ where: { userId } }),
    prisma.botMedia.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ])

  // Don't double-count if the upsert is hitting an existing pathname
  const existing = await prisma.botMedia.findUnique({ where: { key: pathname } })
  const totalAfter = (agg._sum.sizeBytes ?? 0) - (existing?.sizeBytes ?? 0) + sizeBytes
  const countAfter = existing ? count : count + 1

  if (countAfter > MAX_FILES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${MAX_FILES_PER_USER} arquivos atingido` },
      { status: 429 }
    )
  }
  if (totalAfter > MAX_TOTAL_BYTES_PER_USER) {
    return NextResponse.json(
      { error: "Limite de armazenamento atingido (200 MB)" },
      { status: 429 }
    )
  }

  const media = await prisma.botMedia.upsert({
    where: { key: pathname },
    create: {
      userId,
      key: pathname,
      url,
      mimeType: contentType ?? "",
      sizeBytes,
      originalName: (originalName ?? pathname.split("/").pop() ?? "").slice(0, 200),
    },
    update: {
      url,
      mimeType: contentType ?? "",
      sizeBytes,
    },
  })

  // Guard against a different user trying to overwrite an existing record
  if (media.userId !== userId) {
    return NextResponse.json({ error: "Conflito de propriedade" }, { status: 409 })
  }

  return NextResponse.json({ id: media.id, url: media.url }, { status: 200 })
}
