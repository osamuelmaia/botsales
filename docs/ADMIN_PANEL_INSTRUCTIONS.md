# Instruções para o Claude Code — Painel Administrativo

> Leia `docs/ADMIN_PANEL_DOCS.md` antes de começar. Toda a lógica de negócio, modelos e padrões estão documentados lá.

---

## Contexto do Projeto

Stack: Next.js 14 App Router, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, NextAuth v5, SWR, TanStack Table, Recharts, Radix UI, Zod, sonner.

O projeto já tem um dashboard completo para sellers em `app/(dashboard)/`. O painel admin será uma área separada em `app/(admin)/` com layout e sidebar próprios.

---

## Regras Obrigatórias de Implementação

1. **Toda rota `/api/admin/*`** deve verificar `session.user.role === "ADMIN"` e retornar `{ error: "Acesso negado" }` com status 403 se não for admin
2. **Todo input** deve ser validado com Zod antes de qualquer operação no banco
3. **IDs** devem ser validados como CUID com regex `/^c[a-z0-9]{24}$/` antes de qualquer query
4. **Campos de conta bancária** (`agency`, `account`, `document`, `pixKey`) são criptografados — sempre usar `safeDecrypt()` de `lib/utils.ts`
5. **Token do bot** (`tokenEncrypted`) nunca deve ser exposto ou descriptografado no contexto admin
6. **`platformFeePercent`** é `Decimal` no Prisma — ao salvar: `new Prisma.Decimal(value)`
7. **Loading states** com Skeleton em toda lista/tabela
8. **Empty states** com ilustração + CTA em toda listagem vazia
9. **Toda ação** (aprovar, rejeitar, editar) deve ter feedback com `toast.success` ou `toast.error`
10. **Não criar pull request** — apenas commitar e fazer push para a branch `claude/setup-saas-base-files-TLr9M` E para `main`

---

## Fase 1 — Middleware e Layout Base

### 1.1 Middleware de proteção (`middleware.ts`)

Verificar se existe um `middleware.ts` na raiz do projeto. Se não existir, criar. Adicionar proteção para rotas `/admin/*`:
- Sem sessão → redirecionar para `/login`
- Com sessão mas `role !== "ADMIN"` → redirecionar para `/dashboard`

```typescript
// Padrão de verificação no middleware:
// Usar NextAuth getToken() para verificar role sem chamar DB
import { getToken } from "next-auth/jwt"
```

### 1.2 Layout do admin (`app/(admin)/layout.tsx`)

Server component. Verificar `session.user.role === "ADMIN"`. Se não, redirect para `/dashboard`.

Estrutura visual:
```
<div class="flex min-h-screen bg-gray-950">
  <AdminSidebar />  // sidebar com fundo escuro, diferente do seller
  <div class="flex flex-col flex-1">
    <AdminTopBar />
    <main class="flex-1 p-6 bg-gray-50">{children}</main>
  </div>
</div>
```

### 1.3 AdminSidebar (`components/admin/AdminSidebar.tsx`)

Client component. Fundo `bg-gray-900`, texto `text-gray-300`, item ativo `bg-gray-800 text-white`.

Links de navegação (com ícones lucide-react):
- `/admin` → LayoutDashboard — "Visão Geral"
- `/admin/withdrawals` → Wallet — "Saques" (com badge de pendentes)
- `/admin/users` → Users — "Usuários"
- `/admin/sales` → ShoppingCart — "Vendas"
- `/admin/bots` → Bot — "Bots"

Badge de saques pendentes: buscar contagem via SWR de `/api/admin/withdrawals?status=REQUESTED&limit=1` (usar o campo `total` retornado).

### 1.4 AdminTopBar (`components/admin/AdminTopBar.tsx`)

Simples: mostrar "Painel Admin", nome do admin logado, botão logout. Fundo branco, border-b.

---

## Fase 2 — APIs

Criar todos os endpoints antes de criar as páginas.

### 2.1 `GET /api/admin/stats/route.ts`

```typescript
// Queries a executar em paralelo com Promise.all:
// 1. Soma de grossAmountCents + feeAmountCents de sales APPROVED (all time)
// 2. Soma de grossAmountCents + feeAmountCents de sales APPROVED do mês atual
// 3. Count de todos os users
// 4. Count de users com registrationStep === 2
// 5. Count de bots com isActive === true
// 6. Count + soma de withdrawals com status REQUESTED
// 7. Série diária: últimos 30 dias de GMV e taxas
//    → usar prisma.$queryRaw para agrupar por data (DATE(createdAt))
//    → retornar Array<{ date: string; gmvCents: number; feesCents: number }>

// Para a série diária via queryRaw:
const series = await prisma.$queryRaw`
  SELECT 
    DATE("createdAt") as date,
    SUM("grossAmountCents")::int as "gmvCents",
    SUM("feeAmountCents")::int as "feesCents"
  FROM "Sale"
  WHERE status = 'APPROVED'
    AND "createdAt" >= NOW() - INTERVAL '30 days'
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`
```

### 2.2 `GET /api/admin/users/route.ts`

```typescript
// Query params: search (string), page (default 1), limit (default 50)
// WHERE: name CONTAINS search OR email CONTAINS search (case insensitive)
// include: _count { bots, products, sales }
// Não retornar passwordHash
// Ordenar por createdAt DESC
```

### 2.3 `GET /api/admin/users/[id]/route.ts`

```typescript
// Retornar:
// - dados do user (sem passwordHash)
// - bots: id, name, isActive, createdAt, _count(leads, flowNodes)
// - products: id, name, priceInCents, isRecurring
// - últimas 10 sales: id, status, paymentMethod, grossAmountCents, feeAmountCents, netAmountCents, createdAt, paidAt + lead.name + product.name
// - últimos 5 withdrawals: id, amountCents, status, requestedAt, processedAt + bankAccount (descriptografado)
```

### 2.4 `PATCH /api/admin/users/[id]/route.ts`

```typescript
// Schema Zod:
const schema = z.object({
  platformFeePercent: z.number().min(0).max(50).optional(),
  platformFeeCents: z.number().int().min(0).max(10000).optional(),
  withdrawalDays: z.number().int().min(0).max(90).optional(),
  registrationStep: z.literal(1).or(z.literal(2)).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
}).refine(data => Object.keys(data).length > 0, "Nenhum campo para atualizar")

// Ao salvar platformFeePercent, usar: new Prisma.Decimal(value)
// Logar a ação em console.log com adminId + userId + campos alterados
```

### 2.5 `GET /api/admin/sales/route.ts`

```typescript
// Query params: userId, status, paymentMethod, startDate, endDate, page, limit (50)
// NÃO filtrar por userId do admin — admin vê tudo
// include: user (id, name, email), lead (name, email), product (name)
// Ordenar por createdAt DESC
```

### 2.6 `GET /api/admin/bots/route.ts`

```typescript
// Query params: userId, isActive, page, limit (50)
// select: id, name, isActive, createdAt, channelId, gracePeriodDays, userId
// NÃO incluir tokenEncrypted em nenhuma circunstância
// include: user (id, name, email), _count(leads, flowNodes, flowEdges)
// Ordenar por createdAt DESC
```

---

## Fase 3 — Página: Dashboard (`/admin`)

Server component que busca stats iniciais e passa como fallback SWR.

**Layout da página:**
```
Linha 1: 4 cards de KPI em grid
  - GMV Total (all time) — ícone TrendingUp
  - Taxas Arrecadadas (all time) — ícone DollarSign  
  - Usuários Ativos — ícone Users
  - Bots Ativos — ícone Bot

Linha 2: 2 cards de KPI
  - GMV Este Mês
  - Saques Pendentes (contagem + valor total) — com botão "Ver fila" → /admin/withdrawals

Linha 3: Gráfico de linha (Recharts LineChart)
  - Eixo X: datas (últimos 30 dias)
  - Duas linhas: GMV (cinza escuro) e Taxas (verde)
  - Valores em R$ no tooltip
  - Título: "Volume e Taxas — últimos 30 dias"
```

Componente `AdminStatsCard`: igual ao `StatsCard` do dashboard do seller mas sem trend indicator.

---

## Fase 4 — Página: Saques (`/admin/withdrawals`)

Esta é a página mais crítica do painel. Client component com SWR.

**Estrutura:**
```
Header: título "Fila de Saques" + tabs de status (Solicitados | Em Processamento | Concluídos | Falhos | Todos)

Tabela (TanStack Table):
Colunas: Data | Seller | Valor | Banco | Conta | PIX | Status | Ações

Coluna Ações (condicional por status):
  - REQUESTED: botões "Aprovar" (verde) e "Rejeitar" (vermelho)
  - PROCESSING: botão "Confirmar Envio" (azul)
  - COMPLETED / FAILED: apenas visualização
```

**Drawer de detalhe** (ao clicar na linha — mesmo padrão do SaleDrawer):
- Dados do seller: nome, email, documento
- Conta bancária: banco, agência, conta, tipo, titular, documento, PIX key
- Histórico de status com timestamps

**Modal de rejeição** (Radix AlertDialog):
- Campo de textarea para `adminNote` (motivo da recusa)
- Validação: mínimo 10 caracteres
- Botões: "Cancelar" e "Confirmar Rejeição"

**Modal de aprovação** (Radix AlertDialog):
- Confirmação simples: "Confirma a aprovação do saque de R$ X para [nome]?"
- Após aprovar → toast "Saque aprovado. Faça a transferência e marque como Concluído."

**Modal de confirmar envio** (Radix AlertDialog):
- "Confirma que a transferência de R$ X foi enviada para [nome]?"
- Após confirmar → toast "Saque marcado como concluído."

---

## Fase 5 — Página: Usuários (`/admin/users`)

### Lista (`/admin/users`)
Client component com SWR + debounce de busca.

```
Header: "Usuários" + input de busca (nome ou email) + badge de total

Tabela:
Colunas: Nome | Email | Documento | Cadastro | Bots | Vendas | Status | Taxa | Ações
  - Status: badge "Ativo" (registrationStep=2) ou "Incompleto" (registrationStep=1)
  - Taxa: mostrar "X% + R$Y"
  - Ações: botão "Ver" → abre drawer de detalhe
```

### Drawer de detalhe do usuário

Ao clicar em "Ver", abrir drawer pela direita (mesmo padrão do `BotConfigModal`).

**Seções do drawer:**
1. **Dados pessoais:** nome, email, documento, telefone, endereço, tipo de pessoa, data de cadastro
2. **Configurações financeiras** (editável inline):
   - Taxa percentual: input numérico (0.00–50.00)
   - Taxa fixa: input em R$ (0–R$100)
   - Dias de bloqueio (cartão): input inteiro (0–90)
   - Botão "Salvar alterações" → `PATCH /api/admin/users/[id]`
3. **Status de cadastro:** toggle `registrationStep` 1↔2 com confirmação
4. **Bots:** lista com nome, status (ativo/inativo)
5. **Últimas vendas:** tabela compacta (5 linhas)
6. **Últimos saques:** lista compacta (3 itens)

---

## Fase 6 — Página: Vendas (`/admin/sales`)

Praticamente idêntica à página de vendas do seller (`app/(dashboard)/dashboard/sales/`) mas:
- Não filtra por `userId` — busca todas as vendas da plataforma
- Adicionar coluna "Seller" (nome + email)
- Adicionar coluna "Lead" (nome do comprador)
- Reusar o `SaleDrawer` existente de `components/sales/SaleDrawer.tsx`
- Adicionar campo "Seller" no drawer
- Filtro adicional: busca por seller (nome/email)

---

## Fase 7 — Página: Bots (`/admin/bots`)

```
Header: "Bots" + filtro de status (Todos | Ativos | Inativos)

Tabela:
Colunas: Bot | Seller | Status | Leads | Criado em | Canal configurado
  - Status: badge Ativo (verde) / Inativo (cinza)
  - Canal configurado: ✓ / ✗ (baseado em channelId !== null)
  - Leads: _count.leads
  - NÃO mostrar token, nem botão de edição do token
```

---

## Ordem de Implementação Recomendada

```
1. middleware.ts (proteção de rotas)
2. Layout + Sidebar + TopBar admin
3. Todas as APIs (Fase 2) — validar com tsc --noEmit
4. Dashboard (Fase 3)
5. Saques (Fase 4) — prioridade máxima, é a função principal do admin
6. Usuários (Fase 5)
7. Vendas (Fase 6)
8. Bots (Fase 7)
```

---

## Checklist Final Antes de Fazer Push

- [ ] `npx tsc --noEmit` sem erros
- [ ] Nenhuma rota admin aceita requests sem verificação de `role === "ADMIN"`
- [ ] `tokenEncrypted` não aparece em nenhuma resposta de API admin
- [ ] Campos de conta bancária sempre passam por `safeDecrypt()`
- [ ] `platformFeePercent` salvo com `new Prisma.Decimal(value)`
- [ ] Loading states (Skeleton) em todas as tabelas
- [ ] Empty states em todas as listagens
- [ ] Toasts em todas as ações (sucesso e erro)
- [ ] Push para `claude/setup-saas-base-files-TLr9M` E para `main`
