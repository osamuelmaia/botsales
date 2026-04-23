"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bot, Package, Zap, Wallet, ArrowRight, Check, Menu, X,
  CreditCard, Banknote, Users, RefreshCw, BarChart3, Shield,
  ChevronDown, MessageCircle,
} from "lucide-react"

// ─── Data ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Recursos",      href: "#recursos" },
  { label: "Taxas",         href: "#taxas" },
  { label: "FAQ",           href: "#faq" },
]

const STEPS = [
  {
    icon: Bot,
    step: 1,
    title: "Crie seu bot",
    desc: "Conecte um bot do Telegram à BotFlows com o token do BotFather. Em menos de 5 minutos.",
  },
  {
    icon: Package,
    step: 2,
    title: "Configure produtos",
    desc: "Defina produtos digitais com recorrência mensal via cartão ou pagamento único via PIX.",
  },
  {
    icon: Zap,
    step: 3,
    title: "Vendas no automático",
    desc: "O bot cobra, envia link de acesso ao grupo e faz remarketing para inadimplentes.",
  },
  {
    icon: Wallet,
    step: 4,
    title: "Saque quando quiser",
    desc: "Saldo disponível diretamente na sua conta bancária via PIX, sem taxa de transferência.",
  },
]

const FEATURES = [
  {
    icon: CreditCard,
    title: "Cartão recorrente",
    desc: "Cobranças mensais automáticas. Sem esquecer de cobrar, sem perder renovações.",
  },
  {
    icon: Banknote,
    title: "PIX instantâneo",
    desc: "Aprovação imediata com saldo disponível em até 1 dia útil após confirmação.",
  },
  {
    icon: Users,
    title: "Controle de grupos",
    desc: "Acesso liberado após pagamento. Remoção automática de inadimplentes pelo bot.",
  },
  {
    icon: RefreshCw,
    title: "Remarketing automático",
    desc: "Tentativas configuráveis de cobrança antes de remover o cliente do grupo.",
  },
  {
    icon: BarChart3,
    title: "Dashboard completo",
    desc: "Métricas de vendas, histórico de transações e exportação XLSX/CSV.",
  },
  {
    icon: Shield,
    title: "Seguro por padrão",
    desc: "Token do bot com AES-256, webhooks validados por HMAC, dados isolados por usuário.",
  },
]

const FEES = [
  { label: "Taxa percentual",   value: "4,99% por venda" },
  { label: "Taxa fixa",         value: "R$0,49 por venda" },
  { label: "Taxa de saque",     value: "Grátis" },
  { label: "Mensalidade",       value: "R$0,00" },
]

const AVAILABILITY = [
  { label: "PIX",                value: "1 dia útil" },
  { label: "Cartão de crédito",  value: "30 dias após aprovação" },
]

const INCLUSIONS = [
  "Sem mensalidade",
  "Sem taxa de setup",
  "Saque ilimitado grátis",
  "Suporte incluído",
  "Atualizações automáticas",
]

const FAQS = [
  {
    q: "Funciona com qualquer bot do Telegram?",
    a: "Sim. Você cria um bot no BotFather do Telegram, obtém o token e conecta à BotFlows. O processo leva menos de 5 minutos.",
  },
  {
    q: "Como funciona a cobrança recorrente por cartão?",
    a: "Após a primeira compra, a plataforma tenta renovar automaticamente o cartão do cliente a cada 30 dias. Em caso de falha, inicia o fluxo de remarketing com N tentativas configuráveis antes de remover o acesso.",
  },
  {
    q: "Quando meu saldo fica disponível para saque?",
    a: "Vendas via PIX ficam disponíveis em 1 dia útil. Vendas por cartão ficam bloqueadas por 30 dias após aprovação para proteção contra chargebacks.",
  },
  {
    q: "Existe taxa para sacar meu saldo?",
    a: "Não. O saque é gratuito e processado via PIX para a conta bancária cadastrada, sem valor mínimo de saque.",
  },
  {
    q: "Posso vender mais de um produto por bot?",
    a: "Sim, cada bot suporta até 3 produtos. Você pode combinar PIX e cartão recorrente no mesmo bot.",
  },
  {
    q: "O bot precisa ser administrador do grupo?",
    a: "Sim. Para liberar e remover acessos automaticamente, o bot precisa ser admin do grupo com permissão de banir membros. A plataforma valida isso antes de ativar o nó.",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white scroll-smooth">

      {/* ─── NAV ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1121]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-white tracking-tight">BotFlows</span>
            <span className="w-2 h-2 rounded-full bg-blue-500 mb-0.5 flex-shrink-0" />
          </div>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}
                className="text-sm text-zinc-400 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link href="/register"
              className="h-9 px-5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors flex items-center">
              Começar grátis
            </Link>
          </div>

          <button
            className="md:hidden text-zinc-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0b1121] px-4 py-4 space-y-3">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="block text-sm text-zinc-400 hover:text-white py-1 transition-colors">
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link href="/login" className="text-sm text-zinc-400 hover:text-white py-1 transition-colors">
                Entrar
              </Link>
              <Link href="/register"
                className="h-10 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors flex items-center justify-center">
                Começar grátis
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative bg-[#0b1121] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[300px] bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 pt-24 pb-0 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            Bot de vendas para Telegram · PIX + Cartão recorrente
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-white tracking-tight leading-[1.06] mb-6">
            Vendas recorrentes
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
              no Telegram,
            </span>
            <br />
            no piloto automático.
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Conecte um bot, configure seus produtos e deixe a BotFlows cobrar seus clientes, gerenciar acessos e recuperar inadimplentes — sem você precisar mover um dedo.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link href="/register"
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#como-funciona"
              className="w-full sm:w-auto h-12 px-8 rounded-xl border border-white/15 text-sm font-semibold text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
              Como funciona <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          {/* Pills */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mb-20">
            {[
              "Sem mensalidade",
              "Setup em 5 minutos",
              "Saque grátis",
              "PIX + Cartão recorrente",
            ].map((item) => (
              <span key={item} className="text-xs text-zinc-600 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* bottom fade */}
        <div className="h-20 bg-gradient-to-b from-transparent to-white" />
      </section>

      {/* ─── COMO FUNCIONA ────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Do zero às vendas em 4 passos</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto text-lg">
              Sem código, sem complexidade. Configure pelo painel e ative seu bot em minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 relative">
            {/* connector line desktop */}
            <div className="hidden md:block absolute top-10 left-[calc(12.5%+16px)] right-[calc(12.5%+16px)] h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent pointer-events-none" />

            {STEPS.map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-4">
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shadow-sm">
                    <Icon className="h-8 w-8 text-blue-600" strokeWidth={1.5} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-md shadow-blue-600/30">
                    {step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── RECURSOS ─────────────────────────────────────────────────── */}
      <section id="recursos" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Recursos</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Tudo que você precisa para vender</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto text-lg">
              Uma plataforma completa para automatizar vendas digitais no Telegram — do checkout ao saque.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <Icon className="h-5 w-5 text-blue-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TAXAS ────────────────────────────────────────────────────── */}
      <section id="taxas" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Preços</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simples e transparente</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto text-lg">
              Sem planos, sem mensalidade. Você paga uma taxa por venda processada — e só isso.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-blue-600 shadow-xl shadow-blue-600/10 overflow-hidden">
            {/* card header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-7">
              <p className="text-xs font-bold text-blue-100 uppercase tracking-widest mb-1">Plano único</p>
              <h3 className="text-2xl font-bold text-white">Taxa por venda</h3>
              <p className="text-blue-100 text-sm mt-1.5">Você só paga quando vende. Sem surpresas.</p>
            </div>

            {/* card body */}
            <div className="p-8 grid md:grid-cols-2 gap-10">
              {/* fees */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Por transação</h4>
                <div className="space-y-0 divide-y divide-gray-100">
                  {FEES.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-3">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 mt-7">Disponibilidade de saldo</h4>
                <div className="divide-y divide-gray-100">
                  {AVAILABILITY.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-3">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-sm font-semibold text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* inclusions */}
              <div className="flex flex-col gap-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Incluso gratuitamente</h4>
                  <ul className="space-y-3">
                    {INCLUSIONS.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-700 leading-relaxed">
                    <span className="font-semibold">Exemplo:</span> venda de R$100,00 via cartão → taxa de R$5,48 → você recebe R$94,52 líquidos.
                  </p>
                </div>
              </div>
            </div>

            {/* card footer */}
            <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
              <Link href="/register"
                className="w-full sm:w-auto h-11 px-8 rounded-xl bg-[#111627] text-white text-sm font-semibold hover:bg-[#1c2434] transition-colors flex items-center justify-center gap-2 shadow-sm shadow-black/10">
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-gray-400">Sem cartão de crédito para começar.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Perguntas frequentes</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors gap-4"
                >
                  <span className="text-sm font-semibold text-gray-900">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <div className="h-px bg-gray-100 mb-4" />
                    <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="py-28 bg-gradient-to-br from-blue-600 to-blue-700 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute left-1/3 top-1/4 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para automatizar suas vendas?
          </h2>
          <p className="text-blue-100 mb-10 text-lg max-w-lg mx-auto">
            Crie sua conta agora e configure seu primeiro bot em menos de 10 minutos. Grátis para começar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-white text-[#111627] text-sm font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto h-12 px-8 rounded-xl border border-white/30 text-white text-sm font-semibold hover:border-white/50 hover:bg-white/10 transition-colors flex items-center justify-center">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="bg-[#0b1121]">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-base font-bold text-white tracking-tight">BotFlows</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Plataforma de bots de vendas para Telegram com cartão recorrente e PIX. Automatize cobranças e gerencie acessos sem esforço.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Produto</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Como funciona", href: "#como-funciona" },
                  { label: "Recursos",      href: "#recursos" },
                  { label: "Taxas",         href: "#taxas" },
                  { label: "FAQ",           href: "#faq" },
                ].map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Conta</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Entrar",      href: "/login" },
                  { label: "Criar conta", href: "/register" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
            <p>© {new Date().getFullYear()} BotFlows. Todos os direitos reservados.</p>
            <p>Feito para empreendedores brasileiros.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
