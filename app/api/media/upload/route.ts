import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
] as const

const ALLOWED_VIDEO_TYPES = [
  "video/mp4", "video/webm", "video/quicktime",  // quicktime = iPhone .mov (same container as MP4)
  "video/x-mp4", "video/x-m4v",
] as const

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac",
  "audio/x-m4a", "audio/x-wav", "audio/x-mpeg", "audio/mp3",
  "audio/webm",
] as const

const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES] as const

const IMAGE_MAX_SIZE = 4  * 1024 * 1024  // 4 MB
const VIDEO_MAX_SIZE = 50 * 1024 * 1024  // 50 MB
const AUDIO_MAX_SIZE = 20 * 1024 * 1024  // 20 MB

const MAX_FILES_PER_USER  = 100
const MAX_TOTAL_BYTES_PER_USER = 200 * 1024 * 1024 // 200 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",  "image/png": "png",  "image/webp": "webp",  "image/gif": "gif",
  "video/mp4": "mp4",   "video/webm": "webm", "video/quicktime": "mov",
  "video/x-mp4": "mp4", "video/x-m4v": "m4v",
  "audio/mpeg": "mp3",  "audio/mp3": "mp3",   "audio/ogg": "ogg",
  "audio/wav": "wav",   "audio/x-wav": "wav", "audio/mp4": "m4a",
  "audio/x-m4a": "m4a","audio/aac": "aac",   "audio/x-mpeg": "mp3",
  "audio/webm": "webm",
}

// ─── Magic bytes detection ─────────────────────────────────────────────────────
// Lenient: scan first 64 bytes to handle non-standard atom ordering in MP4

function detectMimeFromBytes(buf: Uint8Array): string | null {
  if (buf.length < 4) return null

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif"
  // WebP: RIFF....WEBP
  if (buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp"

  // MP4 / MOV / M4V family: look for 'ftyp' atom within first 64 bytes
  // Standard offset is 4, but some files have other atoms first
  const searchLen = Math.min(buf.length - 4, 64)
  for (let i = 0; i <= searchLen; i++) {
    if (buf[i] === 0x66 && buf[i+1] === 0x74 && buf[i+2] === 0x79 && buf[i+3] === 0x70) {
      return "video/mp4"
    }
  }
  // QuickTime MOV: may have 'moov' atom without 'ftyp'
  for (let i = 0; i <= searchLen; i++) {
    if (buf[i] === 0x6d && buf[i+1] === 0x6f && buf[i+2] === 0x6f && buf[i+3] === 0x76) {
      return "video/mp4"
    }
    // 'wide' atom header also common in MOV
    if (buf[i] === 0x77 && buf[i+1] === 0x69 && buf[i+2] === 0x64 && buf[i+3] === 0x65) {
      return "video/mp4"
    }
  }

  // WebM: EBML header 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm"

  return null
}

function isVideoMime(mime: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(mime as typeof ALLOWED_VIDEO_TYPES[number])
}
function isAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_TYPES.includes(mime as typeof ALLOWED_AUDIO_TYPES[number])
}

// ─── POST /api/media/upload ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Check Blob token early to give a clear error
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[media/upload] BLOB_READ_WRITE_TOKEN is not configured")
    return NextResponse.json(
      { error: "Armazenamento não configurado. Configure BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    )
  }

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
  const isKnown   = ALLOWED_MIME_TYPES.includes(declaredMime as typeof ALLOWED_MIME_TYPES[number])
  const isGeneric = !isKnown  // file node: accept anything, size-capped at 50 MB
  const isVideo   = isVideoMime(declaredMime)
  const isAudio   = isAudioMime(declaredMime)

  // ── File size check ───────────────────────────────────────────────────────
  const maxSize = isVideo ? VIDEO_MAX_SIZE : isAudio ? AUDIO_MAX_SIZE : IMAGE_MAX_SIZE
  const effectiveMax = isGeneric ? VIDEO_MAX_SIZE : maxSize
  if (file.size > effectiveMax) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${effectiveMax / 1024 / 1024} MB` },
      { status: 413 }
    )
  }

  // ── Read buffer ───────────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const bytes  = new Uint8Array(arrayBuffer)
  const buffer = Buffer.from(arrayBuffer)

  // ── Magic bytes validation (images and video only; skip audio/generic) ────
  const detectedMime = detectMimeFromBytes(bytes)

  if (!isAudio && !isGeneric) {
    const isImage = !isVideo
    if (isImage && !detectedMime) {
      return NextResponse.json({ error: "Formato de imagem inválido" }, { status: 422 })
    }
    if (isImage && detectedMime && !detectedMime.startsWith("image/")) {
      return NextResponse.json({ error: "O arquivo não é uma imagem válida" }, { status: 422 })
    }
    // For video: detected "video/mp4" but declared might be "video/quicktime" — both are valid
    if (isVideo && detectedMime && !detectedMime.startsWith("video/")) {
      return NextResponse.json({ error: "O arquivo não é um vídeo válido" }, { status: 422 })
    }
    // If detection fails for video, trust the declared type (some formats are complex)
  }

  // Use detected MIME for images (more reliable), declared for everything else
  const effectiveMime = (!isAudio && !isGeneric && detectedMime) ? detectedMime : declaredMime

  // ── Per-user quota ────────────────────────────────────────────────────────
  const [fileCount, storageAgg] = await Promise.all([
    prisma.botMedia.count({ where: { userId } }),
    prisma.botMedia.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ])

  if (fileCount >= MAX_FILES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${MAX_FILES_PER_USER} arquivos atingido` },
      { status: 429 }
    )
  }
  if ((storageAgg._sum.sizeBytes ?? 0) + file.size > MAX_TOTAL_BYTES_PER_USER) {
    return NextResponse.json(
      { error: "Limite de armazenamento atingido (200 MB)" },
      { status: 429 }
    )
  }

  // ── Upload to Vercel Blob ─────────────────────────────────────────────────
  const folder = isVideo ? "bot-video" : isAudio ? "bot-audio" : isGeneric ? "bot-files" : "bot-media"
  const ext = MIME_TO_EXT[effectiveMime] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin"
  const blobKey = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`

  let blobUrl: string
  try {
    const blob = await put(blobKey, buffer, {
      access: "public",
      contentType: effectiveMime,
      addRandomSuffix: false,
    })
    blobUrl = blob.url
  } catch (err) {
    console.error("[media/upload] Vercel Blob error:", err)
    return NextResponse.json(
      { error: "Erro ao fazer upload. Verifique a configuração do armazenamento." },
      { status: 502 }
    )
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const media = await prisma.botMedia.create({
    data: {
      userId,
      key:          blobKey,
      url:          blobUrl,
      mimeType:     effectiveMime,
      sizeBytes:    file.size,
      originalName: file.name.slice(0, 200),
    },
  })

  return NextResponse.json({ id: media.id, url: media.url }, { status: 201 })
}
