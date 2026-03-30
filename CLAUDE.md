# CLAUDE.md — Contexto permanente do projeto

## O que é este projeto
SaaS de bot de vendas no Telegram. Usuários criam bots que vendem produtos via PIX e cartão recorrente. A plataforma é o gateway, cobra taxa por venda.

## Stack
- **Frontend/Backend:** Next.js 14+ App Router
- **UI:** Tailwind CSS + shadcn/ui + Framer Motion
- **Formulários:** React Hook Form + Zod
- **Estado:** Zustand
- **ORM:** Prisma
- **Banco:** PostgreSQL
- **Cache/Filas:** Redis + BullMQ
- **Auth:** NextAuth.js v5
- **Bot Telegram:** grammy
- **Gráficos:** Recharts
- **Flow Builder:** @xyflow/react
- **Tabelas:** TanStack Table
- **Notificações:** sonner (toasts)

## Estrutura de pastas
```
app/
  (auth)/login | register
  (dashboard)/
    layout.tsx          ← sidebar + topbar + banner cadastro
    dashboard/
    products/
    bots/[id]/ + [id]/flow/
    sales/
    wallet/
  api/
    auth/[...nextauth]/
    users/ | products/ | bots/ | sales/ | withdrawals/
    webhooks/payment/
components/
  ui/          ← shadcn
  layout/      ← Sidebar, TopBar, CompleteRegistrationBanner
  dashboard/   ← StatsCard, SalesChart, DateRangePicker
  products/    ← ProductCard, ProductForm
  bots/        ← BotCard, BotConfigForm, flow/
  sales/       ← SalesTable, ExportButton
  wallet/      ← BalanceCard, WithdrawalForm, BankAccountForm, FeeInfo
lib/
  prisma.ts | auth.ts | gateway.ts | telegram.ts | utils.ts
  validations/ ← schemas Zod por domínio
workers/
  bot-worker.ts
prisma/
  schema.prisma
```

## Variáveis de ambiente (.env)
```
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GATEWAY_API_KEY=
GATEWAY_WEBHOOK_SECRET=
ENCRYPTION_KEY=     # 32 bytes AES-256
NEXT_PUBLIC_APP_URL=
```

## Regras de negócio — NUNCA violar
1. Máximo **3 produtos** por bot
2. Saldo de **cartão**: bloqueado 30 dias após aprovação
3. Saldo de **PIX**: disponível em 1 dia útil
4. Usuário só recebe pagamentos se `registrationStep === 2`
5. Token do bot: armazenar **criptografado** (AES-256), nunca expor no frontend
6. Nó `/start` no flow builder é **fixo, não pode ser deletado**
7. Saque só liberado se saldo disponível > 0 E conta bancária cadastrada
8. Taxa calculada como: `(valorBruto * percentual / 100) + taxaFixa`
9. Usuário só acessa **seus próprios recursos** — sempre filtrar por `userId`
10. Webhook de pagamento: validar **assinatura HMAC** antes de processar

## Padrões de código
- Validação Zod em **todo input**, client-side E server-side
- Senhas com bcrypt mínimo **12 rounds**
- IDs validados como CUID antes de qualquer query
- Loading states com **Skeleton** em toda lista/tabela
- Empty states com ilustração + CTA em toda listagem vazia
- Feedback de ação sempre com **toast** (sucesso e erro)
- Mobile-first, sidebar colapsável em < 768px
