import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const

const IMAGE_MAX_SIZE = 4 * 1024 * 1024   // 4 MB
const VIDEO_MAX_SIZE = 50 * 1024 * 1024  // 50 MB

const MAX_FILES_PER_USER = 100
const MAX_TOTAL_BYTES_PER_USER = 200 * 1024 * 1024 // 200 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

// ─── Magic bytes validation ────────────────────────────────────────────────────

function detectMimeFromBytes(buf: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif"
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp"
  // MP4: bytes 4-7 = "ftyp"
  if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4"
  // WebM: EBML header 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm"
  return null
}

// ─── POST /api/media/upload ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const userId = session.user.id

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

  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 })
  }

  // ── Declared MIME type check ──────────────────────────────────────────────
  const declaredMime = file.type.toLowerCase()
  if (!ALLOWED_MIME_TYPES.includes(declaredMime as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido. Aceitos: JPEG, PNG, WebP, GIF, MP4, WebM" },
      { status: 422 }
    )
  }

  // ── File size check (per type) ────────────────────────────────────────────
  const isVideo = ALLOWED_VIDEO_TYPES.includes(declaredMime as typeof ALLOWED_VIDEO_TYPES[number])
  const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${maxSize / 1024 / 1024} MB para ${isVideo ? "vídeos" : "imagens"}` },
      { status: 413 }
    )
  }

  // ── Read file buffer ──────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const buffer = Buffer.from(arrayBuffer)

  // ── Magic bytes validation ────────────────────────────────────────────────
  const detectedMime = detectMimeFromBytes(bytes)
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Formato inválido. Aceitos: JPEG, PNG, WebP, GIF, MP4, WebM" },
      { status: 422 }
    )
  }
  if (detectedMime !== declaredMime) {
    return NextResponse.json(
      { error: "Conteúdo do arquivo não corresponde ao tipo declarado" },
      { status: 422 }
    )
  }

  // ── Per-user quota check ──────────────────────────────────────────────────
  const [fileCount, storageUsed] = await Promise.all([
    prisma.botMedia.count({ where: { userId } }),
    prisma.botMedia.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ])

  if (fileCount >= MAX_FILES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${MAX_FILES_PER_USER} arquivos atingido` },
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
  const folder = isVideo ? "bot-video" : "bot-media"
  const ext = MIME_TO_EXT[detectedMime]
  const blobKey = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`

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
