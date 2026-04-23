import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Check, Package, Bot, ShoppingCart } from "lucide-react"

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

  const hasProducts  = productsCount > 0
  const hasBots      = botsCount > 0
  const hasConfigFlow = firstNonStartNode !== null
  const hasSales     = salesCount > 0

  const steps = [
    { label: "Criar um produto",          done: hasProducts,   href: "/dashboard/products" },
    { label: "Criar um bot",              done: hasBots,       href: "/dashboard/bots" },
    { label: "Configurar o fluxo do bot", done: hasConfigFlow, href: "/dashboard/bots" },
    { label: "Faça sua primeira venda.",  done: hasSales,      href: null },
  ]

  const quickActions = [
    { icon: Package,      title: "Novo Produto", desc: "Cadastre um produto digital para vender.", href: "/dashboard/products", cta: "Criar produto" },
    { icon: Bot,          title: "Novo Bot",     desc: "Conecte um bot do Telegram à sua loja.",   href: "/dashboard/bots",     cta: "Criar bot" },
    { icon: ShoppingCart, title: "Ver Vendas",   desc: "Acompanhe o histórico de transações.",     href: "/dashboard/sales",    cta: "Ver vendas" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Olá, {firstName}!</h1>
        <p className="text-zinc-400 mt-1">Aqui está o resumo da sua plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendas hoje",          value: "R$ 0,00" },
          { label: "Vendas do mês",        value: "R$ 0,00" },
          { label: "Bots criados",         value: botsCount.toString() },
          { label: "Produtos cadastrados", value: productsCount.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0d1526] rounded-xl border border-white/[0.06] p-5">
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Getting started */}
      {!hasSales && (
        <div className="bg-[#0d1526] rounded-xl border border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-white mb-1">Primeiros passos</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Siga estes passos para começar a vender pelo Telegram.
          </p>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-xs font-bold ${
                    step.done
                      ? "bg-blue-600/20 text-blue-400"
                      : "bg-white/[0.06] text-zinc-500"
                  }`}
                >
                  {step.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {step.href && !step.done ? (
                  <Link href={step.href} className="text-sm text-zinc-300 hover:text-white transition-colors hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={`text-sm ${step.done ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
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
            className="bg-[#0d1526] rounded-xl border border-white/[0.06] p-5 flex flex-col gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
              <action.icon className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{action.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{action.desc}</p>
            </div>
            <Link
              href={action.href}
              className="mt-auto inline-flex items-center h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors w-fit"
            >
              {action.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
