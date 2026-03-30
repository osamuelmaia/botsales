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
11. **Group ID** NÃO é campo de configuração do bot — pertence ao nó "Liberar acesso ao canal" no flow builder
12. Ao salvar um nó com Group ID: validar via `getChatMember` que o bot é **administrador** do grupo com permissão de banir membros — bloquear salvamento se não for admin
13. **Ciclo de vida do cliente recorrente:**
    - Pagamento aprovado → bot envia link do grupo → cliente entra
    - Renovação aprovada → permanece no grupo
    - Renovação recusada → inicia fluxo de remarketing (N tentativas configuráveis)
    - Remarketing esgotado sem pagamento → `bot-worker.ts` chama `kickChatMember` via Telegram API para remover o cliente do grupo
14. O bot deve ser **admin do grupo** com permissão `can_restrict_members` para executar a remoção automática — verificar isso antes de qualquer operação de kick

## Fases de implementação
- ✅ **Fase 3** — Auth (login, register, NextAuth v5)
- ✅ **Fase 4** — Dashboard layout (sidebar, topbar, banner)
- ✅ **Fase 5** — Módulo de Produtos (CRUD + form)
- ✅ **Fase 6** — Módulo de Bots — configuração inicial (token, produtos, ativo/inativo)
- ⬜ **Fase 7** — Flow Builder (`/dashboard/bots/[id]/flow`, @xyflow/react, nó /start fixo)
- ⬜ **Fase 8** — Módulo de Vendas (tabela, filtros, exportação)
- ⬜ **Fase 9** — Carteira (saldo, saques, conta bancária)
- ⬜ **Fase 10** — Gateway de pagamento (webhook HMAC, PIX, cartão recorrente)
- ⬜ **Fase 11** — Bot worker (grammy, BullMQ, fluxo de remarketing, kick por inadimplência)

## Git / Deploy
- **Token GitHub:** armazenado em `~/.git-credentials` ou configurado via `git remote set-url`
- Sempre fazer push em **ambas** as branches:
  ```
  git push origin claude/setup-saas-base-files-TLr9M
  git push origin HEAD:main
  ```
- Branch de desenvolvimento: `claude/setup-saas-base-files-TLr9M`
- Branch de produção (Vercel): `main`

## Padrões de código
- Validação Zod em **todo input**, client-side E server-side
- Senhas com bcrypt mínimo **12 rounds**
- IDs validados como CUID antes de qualquer query
- Loading states com **Skeleton** em toda lista/tabela
- Empty states com ilustração + CTA em toda listagem vazia
- Feedback de ação sempre com **toast** (sucesso e erro)
- Mobile-first, sidebar colapsável em < 768px
