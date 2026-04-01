import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { CompleteRegistrationBanner } from "@/components/layout/CompleteRegistrationBanner"
import { SWRProvider } from "@/components/providers/SWRProvider"

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userId = session?.user?.id

  // Pre-fetch all dashboard data in parallel — runs once per session (layout stays
  // mounted during navigation, so SWR cache persists across all tab switches).
  const fallback: Record<string, unknown> = {}

  if (userId) {
    const startDate = thirtyDaysAgo()
    const endDate   = todayStr()
    const now       = new Date()
    const startDt   = new Date(startDate)
    const endDt     = new Date(endDate); endDt.setHours(23, 59, 59, 999)

    const [products, bots, approvedSales, withdrawals, user, bankAccounts, sales, salesTotal] =
      await Promise.all([
        // Products
        prisma.product.findMany({
          where: { userId }, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, description: true, priceInCents: true,
            paymentMethods: true, isRecurring: true, billingType: true, billingCycles: true },
        }),
        // Bots
        prisma.bot.findMany({
          where: { userId }, orderBy: { createdAt: "desc" },
          select: { id: true, name: true, isActive: true, createdAt: true,
            _count: { select: { botProducts: true } } },
        }),
        // Wallet — approved sales
        prisma.sale.findMany({
          where: { userId, status: "APPROVED" },
          select: { netAmountCents: true, availableAt: true },
        }),
        // Wallet — withdrawals
        prisma.withdrawal.findMany({
          where: { userId }, orderBy: { requestedAt: "desc" }, take: 10,
          select: { id: true, amountCents: true, status: true,
            requestedAt: true, processedAt: true, bankAccount: true },
        }),
        // Wallet — fees
        prisma.user.findUnique({
          where: { id: userId },
          select: { platformFeePercent: true, platformFeeCents: true },
        }),
        // Wallet — bank accounts
        prisma.bankAccount.findMany({
          where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        }),
        // Sales (default: last 30 days, page 1)
        prisma.sale.findMany({
          where: { userId, createdAt: { gte: startDt, lte: endDt } },
          orderBy: { createdAt: "desc" }, take: 50,
          include: { lead: { select: { name: true, email: true } }, product: { select: { name: true } } },
        }),
        // Sales total count
        prisma.sale.count({ where: { userId, createdAt: { gte: startDt, lte: endDt } } }),
      ])

    // ── /api/products ──────────────────────────────────────────────────────────
    fallback["/api/products"] = products

    // ── /api/bots ──────────────────────────────────────────────────────────────
    fallback["/api/bots"] = bots.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))

    // ── /api/wallet ────────────────────────────────────────────────────────────
    let availableCents = 0, pendingCents = 0
    for (const s of approvedSales) {
      if (s.availableAt && s.availableAt <= now) availableCents += s.netAmountCents
      else pendingCents += s.netAmountCents
    }
    const withdrawnCents = withdrawals
      .filter((w) => ["COMPLETED", "PROCESSING", "REQUESTED"].includes(w.status))
      .reduce((sum, w) => sum + w.amountCents, 0)

    fallback["/api/wallet"] = {
      balanceCents: Math.max(0, availableCents - withdrawnCents),
      availableCents, pendingCents, withdrawnCents,
      feePercent: Number(user?.platformFeePercent ?? 5.99),
      feeCents: user?.platformFeeCents ?? 100,
      recentWithdrawals: withdrawals.map((w) => ({
        ...w,
        requestedAt: w.requestedAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
        bankAccount: { ...w.bankAccount, createdAt: w.bankAccount.createdAt.toISOString() },
      })),
      bankAccounts: bankAccounts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    }

    // ── /api/sales (default key: last 30 days, page 1) ─────────────────────────
    const salesKey = `/api/sales?page=1&limit=50&startDate=${startDate}&endDate=${endDate}`
    fallback[salesKey] = {
      sales: sales.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        availableAt: s.availableAt?.toISOString() ?? null,
      })),
      total: salesTotal,
      pages: Math.ceil(salesTotal / 50),
      page: 1,
    }
    // Also expose the initial dates so SalesClient can build the matching key
    fallback["__salesInitialDates"] = { startDate, endDate }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <SWRProvider fallback={fallback}>
          <CompleteRegistrationBanner />
          <main className="flex-1 p-6">{children}</main>
        </SWRProvider>
      </div>
    </div>
  )
}
