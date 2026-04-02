import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { executeFlow } from "@/lib/bot-runner"

/**
 * GET /api/cron/pending-flows
 *
 * Runs every minute via Vercel Cron.
 * Finds sales that are:
 *   - Still PENDING
 *   - Created more than 5 minutes ago (user hasn't paid yet)
 *   - Originated from a bot flow (botId + tgChatId + paymentNodeId present)
 *   - Haven't had the pending flow triggered yet
 *
 * For each, resumes the flow from the PAYMENT node's "pending" output handle,
 * then marks pendingFlowFiredAt so it never fires twice.
 */
export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const staleSales = await prisma.sale.findMany({
    where: {
      status: "PENDING",
      pendingFlowFiredAt: null,
      createdAt: { lte: fiveMinutesAgo },
      botId: { not: null },
      tgChatId: { not: null },
      paymentNodeId: { not: null },
    },
    select: {
      id: true,
      botId: true,
      tgChatId: true,
      paymentNodeId: true,
    },
    take: 20,
  })

  if (staleSales.length === 0) {
    return NextResponse.json({ fired: 0 })
  }

  let fired = 0

  await Promise.allSettled(
    staleSales.map(async (sale) => {
      // Atomic: mark as fired first to prevent double-fire on concurrent runs
      const updated = await prisma.sale.updateMany({
        where: { id: sale.id, status: "PENDING", pendingFlowFiredAt: null },
        data: { pendingFlowFiredAt: new Date() },
      })

      if (updated.count === 0) return // another instance already handled it

      // Re-check status after acquiring the lock
      const current = await prisma.sale.findUnique({
        where: { id: sale.id },
        select: { status: true },
      })
      if (current?.status !== "PENDING") return

      // Find the edge from the PAYMENT node with handle "pending"
      const edge = await prisma.flowEdge.findFirst({
        where: {
          botId: sale.botId!,
          sourceNodeId: sale.paymentNodeId!,
          sourceHandle: "pending",
        },
        select: { targetNodeId: true },
      })

      if (!edge) return

      const chatId = parseInt(sale.tgChatId!, 10)
      if (isNaN(chatId)) return

      await executeFlow(sale.botId!, chatId, edge.targetNodeId)
      fired++

      console.log(`[cron/pending-flows] fired pending flow for sale ${sale.id}`)
    })
  )

  return NextResponse.json({ fired })
}
