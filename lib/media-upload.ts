// Shared constants/helpers for the bot-flow media upload pipeline.
// Used by both the API route (server) and NodeConfigPanel (client).

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
] as const

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4", "video/webm", "video/quicktime",
  "video/x-mp4", "video/x-m4v", "video/3gpp", "video/x-matroska",
] as const

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/mpeg3",
  "audio/ogg", "audio/wav", "audio/x-wav",
  "audio/mp4", "audio/x-m4a", "audio/aac", "audio/x-aac",
  "audio/webm", "audio/flac",
] as const

export const IMAGE_MAX_SIZE = 4  * 1024 * 1024   // 4 MB
export const AUDIO_MAX_SIZE = 20 * 1024 * 1024   // 20 MB
export const VIDEO_MAX_SIZE = 50 * 1024 * 1024   // 50 MB (also used for "file")

export const MAX_FILES_PER_USER       = 100
export const MAX_TOTAL_BYTES_PER_USER = 200 * 1024 * 1024 // 200 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "video/x-mp4": "mp4", "video/x-m4v": "m4v", "video/3gpp": "3gp",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/x-mpeg": "mp3",
  "audio/mpeg3": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
  "audio/aac": "aac", "audio/x-aac": "aac", "audio/webm": "webm",
  "audio/flac": "flac",
}

export type MediaKind = "image" | "video" | "audio" | "file"

export function allowedTypesFor(kind: MediaKind): readonly string[] | undefined {
  if (kind === "image") return ALLOWED_IMAGE_TYPES
  if (kind === "video") return ALLOWED_VIDEO_TYPES
  if (kind === "audio") return ALLOWED_AUDIO_TYPES
  return undefined
}

export function maxBytesFor(kind: MediaKind): number {
  if (kind === "image") return IMAGE_MAX_SIZE
  if (kind === "audio") return AUDIO_MAX_SIZE
  return VIDEO_MAX_SIZE
}

export function folderFor(kind: MediaKind): string {
  return kind === "file" ? "bot-files" : `bot-${kind}`
}

export function extFromMimeOrName(mime: string, name: string): string {
  const fromMime = MIME_TO_EXT[mime.toLowerCase()]
  if (fromMime) return fromMime
  const fromName = name.split(".").pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  return "bin"
}

// Loose client-side check: accept by type prefix when the kind matches,
// since browsers report the same file with varying MIME strings across
// platforms (e.g. audio/mp3 vs audio/mpeg, video/quicktime vs video/mp4).
export function isAcceptableType(kind: MediaKind, fileType: string): boolean {
  const t = (fileType ?? "").toLowerCase()
  if (kind === "file") return true
  if (!t) return true // some browsers report empty type — let server decide
  if (kind === "image" && t.startsWith("image/")) return true
  if (kind === "video" && (t.startsWith("video/") || t === "application/mp4")) return true
  if (kind === "audio" && t.startsWith("audio/")) return true
  return (allowedTypesFor(kind) ?? []).includes(t)
}
