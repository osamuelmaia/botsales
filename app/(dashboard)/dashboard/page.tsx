import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Check, Package, Bot, ShoppingCart } from "lucide-react"

// ─── Gamification ─────────────────────────────────────────────────────────────

const LEVELS = [
  { name: "Iniciante",    min: 0 },
  { name: "Vendedor",     min: 50000 },
  { name: "Profissional", min: 200000 },
  { name: "Especialista", min: 1000000 },
  { name: "Sênior",       min: 5000000 },
  { name: "Autoridade",   min: 10000000 },
  { name: "Elite",        min: 100000000 },
] // valores em centavos

function getLevel(totalCents: number) {
  let current = LEVELS[0]
  let next = LEVELS[1]
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalCents >= LEVELS[i].min) {
      current = LEVELS[i]
      next = LEVELS[i + 1] ?? null
      break
    }
  }
  const progress = next
    ? Math.min(((totalCents - current.min) / (next.min - current.min)) * 100, 100)
    : 100
  return { current, next, progress }
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuário"

  const [botsCount, productsCount, salesCount, revenueAgg] = await prisma.$transaction([
    prisma.bot.count({ where: { userId } }),
    prisma.product.count({ where: { userId } }),
    prisma.sale.count({ where: { userId } }),
    prisma.sale.aggregate({
      where: { userId, status: "APPROVED" },
      _sum: { netAmountCents: true },
    }),
  ])

  const firstNonStartNode = await prisma.flowNode.findFirst({
    where: { type: { not: "TRIGGER_START" }, bot: { userId } },
    select: { id: true },
  })

  const totalRevenueCents = revenueAgg._sum.netAmountCents ?? 0
  const { current: currentLevel, next: nextLevel, progress } = getLevel(totalRevenueCents)

  const hasProducts = productsCount > 0
  const hasBots = botsCount > 0
  const hasConfigFlow = firstNonStartNode !== null
  const hasSales = salesCount > 0

  const steps = [
    { label: "Criar um produto",        done: hasProducts,   href: "/dashboard/products" },
    { label: "Criar um bot",            done: hasBots,       href: "/dashboard/bots" },
    { label: "Configurar o fluxo do bot", done: hasConfigFlow, href: "/dashboard/bots" },
    { label: "Faça sua primeira venda.", done: hasSales,     href: null },
  ]

  const quickActions = [
    { icon: Package,      title: "Novo Produto", desc: "Cadastre um produto digital para vender.", href: "/dashboard/products", cta: "Criar produto" },
    { icon: Bot,          title: "Novo Bot",     desc: "Conecte um bot do Telegram à sua loja.",   href: "/dashboard/bots",     cta: "Criar bot" },
    { icon: ShoppingCart, title: "Ver Vendas",   desc: "Acompanhe o histórico de transações.",     href: "/dashboard/sales",    cta: "Ver vendas" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Olá, {firstName}!</h1>
        <p className="text-gray-500 mt-1">Aqui está o resumo da sua plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendas hoje",          value: "R$ 0,00" },
          { label: "Vendas do mês",        value: "R$ 0,00" },
          { label: "Bots criados",         value: botsCount.toString() },
          { label: "Produtos cadastrados", value: productsCount.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Level card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Seu nível
            </p>
            <p className="text-2xl font-bold text-gray-900">{currentLevel.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatBRL(totalRevenueCents)} faturados
            </p>
          </div>
          {nextLevel && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">Próximo nível</p>
              <p className="text-sm font-semibold text-gray-700">{nextLevel.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatBRL(nextLevel.min)}</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-gray-900 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {nextLevel && (
          <p className="text-xs text-gray-400 mt-2">
            Falta {formatBRL(nextLevel.min - totalRevenueCents)} para {nextLevel.name}
          </p>
        )}

        {/* All levels */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {LEVELS.map((level, i) => {
            const reached = totalRevenueCents >= level.min
            const isCurrent = level.name === currentLevel.name
            return (
              <div key={level.name} className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                    isCurrent
                      ? "bg-gray-900 text-white border-gray-900"
                      : reached
                      ? "bg-gray-100 text-gray-600 border-gray-200"
                      : "bg-white text-gray-300 border-gray-200"
                  }`}
                >
                  {level.name}
                </span>
                {i < LEVELS.length - 1 && (
                  <span className="text-gray-200 text-xs">›</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Getting started */}
      {!hasSales && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Primeiros passos</h2>
          <p className="text-sm text-gray-500 mb-5">
            Siga estes passos para começar a vender pelo Telegram.
          </p>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-xs font-bold ${
                    step.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {step.href && !step.done ? (
                  <Link href={step.href} className="text-sm text-gray-700 hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={`text-sm ${step.done ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    {step.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <div
            key={action.href}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <action.icon className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{action.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
            </div>
            <Link
              href={action.href}
              className="mt-auto inline-flex items-center h-8 px-3 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors w-fit"
            >
              {action.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
