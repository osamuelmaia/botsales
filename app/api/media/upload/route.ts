import { NextRequest, NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  allowedTypesFor,
  maxBytesFor,
  type MediaKind,
  MAX_FILES_PER_USER,
  MAX_TOTAL_BYTES_PER_USER,
} from "@/lib/media-upload"

// ─── POST /api/media/upload ───────────────────────────────────────────────────
// Implements Vercel Blob client-upload pattern: the browser uploads directly
// to Blob storage, bypassing this app server's body-size limit (4.5MB on
// Vercel, 1MB on Nginx default). This route only issues short-lived tokens
// and reacts to upload completion via a signed webhook.

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[media/upload] BLOB_READ_WRITE_TOKEN is not configured")
    return NextResponse.json(
      { error: "Armazenamento não configurado. Configure BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    )
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadStr) => {
        const session = await auth()
        if (!session?.user?.id) {
          throw new Error("Não autorizado")
        }
        const userId = session.user.id

        let payload: { kind?: string; sizeBytes?: number; originalName?: string }
        try {
          payload = JSON.parse(clientPayloadStr ?? "{}")
        } catch {
          throw new Error("clientPayload inválido")
        }

        const kind = payload.kind as MediaKind | undefined
        if (!kind || !["image", "video", "audio", "file"].includes(kind)) {
          throw new Error("Tipo de mídia inválido")
        }

        // Pathname must live under the per-user folder to prevent overwrites
        const folder = kind === "file" ? "bot-files" : `bot-${kind}`
        const expectedPrefix = `${folder}/${userId}/`
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Caminho de upload inválido")
        }

        const declaredSize = Number(payload.sizeBytes ?? 0)
        const maxBytes = maxBytesFor(kind)
        if (declaredSize > 0 && declaredSize > maxBytes) {
          throw new Error(`Arquivo muito grande. Máximo: ${maxBytes / 1024 / 1024} MB`)
        }

        // Quota: file count + total storage
        const [count, agg] = await Promise.all([
          prisma.botMedia.count({ where: { userId } }),
          prisma.botMedia.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
        ])
        if (count >= MAX_FILES_PER_USER) {
          throw new Error(`Limite de ${MAX_FILES_PER_USER} arquivos atingido`)
        }
        if ((agg._sum.sizeBytes ?? 0) + declaredSize > MAX_TOTAL_BYTES_PER_USER) {
          throw new Error("Limite de armazenamento atingido (200 MB)")
        }

        const allowed = allowedTypesFor(kind)

        return {
          // For "file" kind, allow any content type. Otherwise enforce whitelist.
          allowedContentTypes: allowed ? [...allowed] : undefined,
          maximumSizeInBytes: maxBytes,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            userId,
            kind,
            originalName: (payload.originalName ?? "").slice(0, 200),
            sizeBytes: declaredSize,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Runs as a webhook signed by Vercel Blob (production only).
        // Local dev relies on /api/media/confirm instead.
        if (!tokenPayload) return
        let parsed: { userId?: string; originalName?: string; sizeBytes?: number }
        try { parsed = JSON.parse(tokenPayload) } catch { return }

        const { userId, originalName, sizeBytes } = parsed
        if (!userId) return

        await prisma.botMedia.upsert({
          where: { key: blob.pathname },
          create: {
            userId,
            key: blob.pathname,
            url: blob.url,
            mimeType: blob.contentType ?? "",
            sizeBytes: Number(sizeBytes ?? 0),
            originalName: (originalName ?? blob.pathname.split("/").pop() ?? "").slice(0, 200),
          },
          update: {
            url: blob.url,
            mimeType: blob.contentType ?? "",
            sizeBytes: Number(sizeBytes ?? 0),
          },
        })
      },
    })

    return NextResponse.json(json)
  } catch (error) {
    const message = (error as Error).message ?? "Erro no upload"
    console.error("[media/upload] handleUpload error:", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
