import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const MAX_IMAGES_PER_USER = 100
const MAX_TOTAL_BYTES_PER_USER = 200 * 1024 * 1024 // 200 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

// ─── Magic bytes validation ────────────────────────────────────────────────────
// Validates the actual file content regardless of the declared MIME type

function detectMimeFromBytes(buf: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  // GIF: 47 49 46 38 (GIF8)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif"
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF....WEBP)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp"
  return null
}

// ─── POST /api/media/upload ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  // ── Parse multipart ───────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 })
  }

  // ── File size check ───────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB` },
      { status: 413 }
    )
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 })
  }

  // ── Read file buffer ──────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const buffer = Buffer.from(arrayBuffer)

  // ── Magic bytes validation ────────────────────────────────────────────────
  const detectedMime = detectMimeFromBytes(bytes)
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Formato inválido. Aceitos: JPEG, PNG, WebP, GIF" },
      { status: 422 }
    )
  }

  // ── MIME type cross-check ─────────────────────────────────────────────────
  const declaredMime = file.type.toLowerCase()
  if (!ALLOWED_MIME_TYPES.includes(declaredMime as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido" },
      { status: 422 }
    )
  }
  if (detectedMime !== declaredMime) {
    // Content doesn't match declared MIME — reject (potential spoofing)
    return NextResponse.json(
      { error: "Conteúdo do arquivo não corresponde ao tipo declarado" },
      { status: 422 }
    )
  }

  // ── Per-user quota check ──────────────────────────────────────────────────
  const [imageCount, storageUsed] = await Promise.all([
    prisma.botMedia.count({ where: { userId } }),
    prisma.botMedia.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ])

  if (imageCount >= MAX_IMAGES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${MAX_IMAGES_PER_USER} imagens atingido` },
      { status: 429 }
    )
  }

  const totalBytes = (storageUsed._sum.sizeBytes ?? 0) + file.size
  if (totalBytes > MAX_TOTAL_BYTES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de armazenamento atingido (${MAX_TOTAL_BYTES_PER_USER / 1024 / 1024} MB)` },
      { status: 429 }
    )
  }

  // ── Upload to Vercel Blob ─────────────────────────────────────────────────
  const ext = MIME_TO_EXT[detectedMime]
  const blobKey = `bot-media/${userId}/${crypto.randomUUID()}.${ext}`

  let blobUrl: string
  try {
    const blob = await put(blobKey, buffer, {
      access: "public",
      contentType: detectedMime,
      addRandomSuffix: false,
    })
    blobUrl = blob.url
  } catch {
    return NextResponse.json(
      { error: "Erro ao fazer upload. Tente novamente." },
      { status: 502 }
    )
  }

  // ── Save metadata to DB ───────────────────────────────────────────────────
  const media = await prisma.botMedia.create({
    data: {
      userId,
      key: blobKey,
      url: blobUrl,
      mimeType: detectedMime,
      sizeBytes: file.size,
      originalName: file.name.slice(0, 200),
    },
  })

  return NextResponse.json({ id: media.id, url: media.url }, { status: 201 })
}
