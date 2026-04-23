import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  Check,
  Package,
  Bot,
  ShoppingCart,
  TrendingUp,
  Wallet,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { PageHeader } from "@/components/ui/PageHeader"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuário"

  const [botsCount, productsCount, salesCount] = await prisma.$transaction([
    prisma.bot.count({ where: { userId } }),
    prisma.product.count({ where: { userId } }),
    prisma.sale.count({ where: { userId } }),
  ])

  const firstNonStartNode = await prisma.flowNode.findFirst({
    where: { type: { not: "TRIGGER_START" }, bot: { userId } },
    select: { id: true },
  })

  const hasProducts   = productsCount > 0
  const hasBots       = botsCount > 0
  const hasConfigFlow = firstNonStartNode !== null
  const hasSales      = salesCount > 0

  const steps = [
    { label: "Criar um produto",          done: hasProducts,   href: "/products" },
    { label: "Criar um bot",              done: hasBots,       href: "/bots" },
    { label: "Configurar o fluxo do bot", done: hasConfigFlow, href: "/bots" },
    { label: "Faça sua primeira venda",   done: hasSales,      href: null as string | null },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const totalSteps = steps.length
  const progressPct = (doneCount / totalSteps) * 100

  const stats = [
    { label: "Vendas hoje",          value: "R$ 0,00",             icon: TrendingUp },
    { label: "Vendas do mês",        value: "R$ 0,00",             icon: Wallet },
    { label: "Bots criados",         value: botsCount.toString(),     icon: Bot },
    { label: "Produtos cadastrados", value: productsCount.toString(), icon: Package },
  ]

  const quickActions = [
    { icon: Package,      title: "Novo Produto", desc: "Cadastre um produto digital para vender.", href: "/products", cta: "Criar produto" },
    { icon: Bot,          title: "Novo Bot",     desc: "Conecte um bot do Telegram à sua loja.",   href: "/bots",     cta: "Criar bot" },
    { icon: ShoppingCart, title: "Ver Vendas",   desc: "Acompanhe o histórico de transações.",     href: "/sales",    cta: "Ver vendas" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${firstName}!`}
        description="Aqui está o resumo da sua plataforma."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{value}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-blue-600" strokeWidth={2} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Getting started */}
      {!hasSales && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-blue-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Primeiros passos</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Complete os passos abaixo para começar a vender.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 tabular-nums">
                  {doneCount} de {totalSteps}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <ol className="border-t border-gray-100">
            {steps.map((step, i) => {
              const content = (
                <div
                  className={`flex items-center gap-3 px-6 py-3.5 border-b border-gray-100 last:border-0 transition-colors ${
                    step.href && !step.done ? "hover:bg-gray-50 cursor-pointer" : ""
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-xs font-bold transition-colors ${
                      step.done
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400 border border-gray-200"
                    }`}
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`text-sm flex-1 ${
                      step.done ? "text-gray-400 line-through" : "text-gray-700 font-medium"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.href && !step.done && (
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-600 transition-colors" />
                  )}
                </div>
              )
              return (
                <li key={i}>
                  {step.href && !step.done ? (
                    <Link href={step.href} className="group block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Ações rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <div
              key={action.href}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <action.icon className="h-4 w-4 text-blue-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{action.desc}</p>
              </div>
              <Link
                href={action.href}
                className="mt-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#111627] text-white text-xs font-semibold hover:bg-[#1c2434] transition-colors w-fit shadow-sm shadow-black/10"
              >
                {action.cta}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
