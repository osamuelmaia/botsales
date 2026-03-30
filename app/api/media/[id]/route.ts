import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── DELETE /api/media/[id] ───────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const media = await prisma.botMedia.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!media) {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })
  }

  // Delete from Vercel Blob first, then DB
  try {
    await del(media.url)
  } catch {
    // If blob deletion fails, still clean up the DB record
    // The orphaned blob will be cleaned up by a future admin task
  }

  await prisma.botMedia.delete({ where: { id: media.id } })

  return NextResponse.json({ ok: true })
}
