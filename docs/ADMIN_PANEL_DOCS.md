# Documentação — Painel Administrativo BotSales

## 1. Visão Geral da Plataforma

SaaS de bot de vendas no Telegram. Usuários (sellers) criam bots que vendem produtos digitais via PIX e cartão de crédito recorrente. A plataforma atua como gateway intermediário, cobrando uma taxa configurável por transação.

**Fluxo macro:**
```
Seller cria bot + produto → configura flow builder → bot ativo no Telegram
→ Lead interage com bot → bot envia link de checkout (Mini App)
→ Lead paga (PIX ou cartão) → Asaas processa → webhook confirma
→ Sale aprovada → saldo creditado para seller → seller solicita saque
→ Admin aprova saque → PROCESSING → Admin confirma envio → COMPLETED
```

---

## 2. Modelos de Dados Relevantes para o Admin

### 2.1 User
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | Chave primária |
| `name` | String | Nome completo |
| `email` | String | Único |
| `registrationStep` | Int | 1 = cadastro incompleto, 2 = habilitado para receber pagamentos |
| `personType` | INDIVIDUAL \| COMPANY | Tipo de pessoa |
| `document` | String? | CPF (11 dígitos) ou CNPJ (14 dígitos) — não criptografado |
| `phone` | String? | Telefone |
| `platformFeePercent` | Decimal | Taxa percentual cobrada por venda (default: 5.99) |
| `platformFeeCents` | Int | Taxa fixa em centavos por venda (default: 100 = R$1,00) |
| `withdrawalDays` | Int | Dias de bloqueio para cartão (default: 30) |
| `role` | USER \| ADMIN | Papel no sistema |
| `createdAt` | DateTime | Data de cadastro |

**Fórmula da taxa:** `feeAmountCents = round(grossAmountCents * feePercent / 100) + feeCents`

### 2.2 Sale
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | Também usado como `externalReference` no Asaas |
| `userId` | String | Seller dono da venda |
| `productId` | String | Produto vendido |
| `leadId` | String? | Lead do Telegram (se originado de bot) |
| `botId` | String? | Bot que gerou a venda |
| `paymentMethod` | PIX \| CREDIT_CARD | Método de pagamento |
| `status` | SaleStatus | Ver tabela abaixo |
| `grossAmountCents` | Int | Valor bruto em centavos |
| `feeAmountCents` | Int | Taxa da plataforma em centavos |
| `netAmountCents` | Int | Valor líquido para o seller |
| `gatewayId` | String? | ID do pagamento no Asaas |
| `paidAt` | DateTime? | Quando o pagamento foi confirmado |
| `availableAt` | DateTime? | Quando o saldo fica disponível para saque |

**Status de Sale:**
| Status | Descrição |
|---|---|
| `PENDING` | Aguardando pagamento |
| `APPROVED` | Pagamento confirmado → saldo disponível após `availableAt` |
| `REFUSED` | Cartão recusado |
| `REFUNDED` | Reembolsado |
| `CHARGEBACK` | Chargeback (disputa) |

### 2.3 Withdrawal
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | Chave primária |
| `userId` | String | Seller que solicitou |
| `bankAccountId` | String | Conta bancária de destino |
| `amountCents` | Int | Valor solicitado em centavos |
| `status` | WithdrawalStatus | Ver tabela abaixo |
| `adminNote` | String? | Motivo de recusa (preenchido pelo admin) |
| `reviewedBy` | String? | ID do admin que revisou |
| `requestedAt` | DateTime | Quando foi solicitado |
| `reviewedAt` | DateTime? | Quando o admin atuou |
| `processedAt` | DateTime? | Quando o pagamento foi enviado |

**Status de Withdrawal e transições:**
```
REQUESTED → (admin aprova) → PROCESSING → (admin confirma envio) → COMPLETED
REQUESTED → (admin rejeita) → FAILED
```

**Regras de saque (nunca violar):**
- Saldo disponível = soma de `netAmountCents` de sales `APPROVED` com `availableAt <= now`
- Menos saques já em `COMPLETED` e `PROCESSING`
- Menos saques em `REQUESTED` (reservado)
- Saldo deve ser > 0 E conta bancária deve estar cadastrada

### 2.4 BankAccount (campos criptografados)
| Campo | Criptografado | Descrição |
|---|---|---|
| `bankCode` | Não | Código do banco |
| `agency` | **Sim** (AES-256) | Agência |
| `account` | **Sim** (AES-256) | Número da conta |
| `document` | **Sim** (AES-256) | CPF/CNPJ do titular |
| `pixKey` | **Sim** (AES-256) | Chave PIX (opcional) |
| `holderName` | Não | Nome do titular |
| `accountType` | Não | CHECKING \| SAVINGS |

**Sempre usar `safeDecrypt()` de `lib/utils.ts` para ler esses campos.**

### 2.5 Bot
| Campo | Descrição |
|---|---|
| `tokenEncrypted` | Token do Telegram — sempre criptografado, NUNCA expor no frontend |
| `isActive` | Se o bot está respondendo no Telegram |
| `channelId` | ID do grupo/canal vinculado (para liberar acesso) |
| `gracePeriodDays` | Dias de remarketing antes de kickar assinante inadimplente |

### 2.6 Subscription
| Campo | Descrição |
|---|---|
| `status` | ACTIVE / REMARKETING / KICKED / CANCELLED |
| `currentPeriodEnd` | Vencimento do período atual |
| `tgUserId` | Telegram user ID do assinante |
| `gatewayChargeId` | ID da assinatura no Asaas |

---

## 3. APIs Admin Já Existentes

### `GET /api/admin/withdrawals`
Lista saques com filtro por status e paginação (50 por página).
- Query: `status` (REQUESTED | PROCESSING | COMPLETED | FAILED | ALL), `page`
- Retorna dados da conta bancária já descriptografados
- **Requer:** `session.user.role === "ADMIN"`

### `PATCH /api/admin/withdrawals/[id]`
Aprovar ou rejeitar um saque em `REQUESTED`.
```json
// Aprovar → PROCESSING
{ "action": "approve" }

// Rejeitar → FAILED
{ "action": "reject", "adminNote": "Dados bancários inválidos" }
```

### `PUT /api/admin/withdrawals/[id]`
Marcar saque `PROCESSING` como `COMPLETED` (pagamento enviado).
- Sem body necessário

---

## 4. O Que o Painel Admin Precisa Fazer

### 4.1 Dashboard (KPIs da plataforma)
- Volume total de vendas (GMV) — soma de `grossAmountCents` de sales `APPROVED`
- Total de taxas arrecadadas — soma de `feeAmountCents` de sales `APPROVED`
- Número de sellers ativos (users com `registrationStep = 2`)
- Total de usuários cadastrados
- Total de bots ativos (`isActive = true`)
- Saques pendentes aguardando aprovação (contagem + valor total)
- Gráfico de GMV e taxas por dia/semana/mês

### 4.2 Gestão de Usuários
- Listar todos os usuários com paginação e busca (nome/email)
- Ver detalhes: dados pessoais, bots, produtos, vendas, saques
- **Editar taxas individualmente:** `platformFeePercent` e `platformFeeCents`
- **Editar `withdrawalDays`:** dias de bloqueio de cartão
- **Alterar `registrationStep`:** forçar habilitação/desabilitação de pagamentos
- **Promover a admin:** alterar `role` para `ADMIN`

### 4.3 Gestão de Saques (fila principal do admin)
- Listar saques `REQUESTED` com dados bancários descriptografados
- Ver: seller, valor, banco, agência, conta, tipo, documento, PIX key
- **Aprovar** → muda para `PROCESSING` (admin vai fazer a transferência)
- **Rejeitar** com motivo → muda para `FAILED` (saldo retorna automaticamente)
- **Confirmar envio** → muda de `PROCESSING` para `COMPLETED`
- Histórico completo com filtros por status

### 4.4 Visão Global de Vendas
- Todas as vendas da plataforma com filtros (seller, status, método, data)
- Ver: seller, produto, buyer, valor bruto, taxa, líquido, gateway ID
- Exportação CSV

### 4.5 Visão Global de Bots
- Todos os bots com: seller, nome, status (ativo/inativo), leads, vendas
- (Não expor token — apenas confirmar se está configurado)

### 4.6 Gestão de Configurações da Plataforma (futuro)
- Taxa padrão para novos usuários (hoje hardcoded como 5.99% + R$1,00)

---

## 5. Autenticação e Segurança do Admin

### Verificação de role
```typescript
const session = await auth()
const role = (session?.user as { role?: string })?.role
if (role !== "ADMIN") {
  return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
}
```

### Middleware de proteção
Todas as rotas `/admin/*` devem ser protegidas no `middleware.ts`. Qualquer acesso sem `role === "ADMIN"` redireciona para `/dashboard`.

### Princípios de segurança para o painel
- Nunca expor `tokenEncrypted` dos bots, nem descriptografar no frontend
- Sempre usar `safeDecrypt()` para campos de conta bancária
- Toda ação administrativa deve logar `reviewedBy = session.user.id`
- Validar todos os inputs com Zod antes de qualquer query
- Filtrar por escopo correto — admin vê tudo, mas as queries não devem vazar dados entre sellers

---

## 6. Estrutura de Pastas Sugerida

```
app/
  (admin)/
    layout.tsx              ← sidebar admin + topbar + guard de role
    admin/
      page.tsx              ← dashboard com KPIs
      users/
        page.tsx            ← lista de usuários
        [id]/
          page.tsx          ← detalhe do usuário
      withdrawals/
        page.tsx            ← fila de saques (principal)
      sales/
        page.tsx            ← todas as vendas
      bots/
        page.tsx            ← todos os bots

app/api/admin/
  stats/route.ts            ← KPIs do dashboard
  users/route.ts            ← GET (lista) 
  users/[id]/route.ts       ← GET (detalhe) + PATCH (editar taxas/role)
  withdrawals/route.ts      ← já existe
  withdrawals/[id]/route.ts ← já existe
  sales/route.ts            ← GET (todas as vendas)
  bots/route.ts             ← GET (todos os bots)
```

---

## 7. Endpoints Admin a Criar

### `GET /api/admin/stats`
```typescript
// Retorno esperado:
{
  gmvTotalCents: number,          // soma grossAmountCents APPROVED (todos os tempos)
  feesTotalCents: number,         // soma feeAmountCents APPROVED
  gmvThisMonthCents: number,
  feesThisMonthCents: number,
  totalUsers: number,
  activeUsers: number,            // registrationStep === 2
  activeBots: number,
  pendingWithdrawalsCount: number,
  pendingWithdrawalsCents: number,
  dailySeries: Array<{ date: string; gmvCents: number; feesCents: number }> // últimos 30 dias
}
```

### `GET /api/admin/users`
```typescript
// Query: search (nome/email), page, limit (default 50)
// Retorno: { users: User[], total, pages, page }
// Incluir: _count de bots, products, sales
```

### `GET /api/admin/users/[id]`
```typescript
// Retorno: dados completos do user + bots + products + últimas 10 vendas + últimos 5 saques
```

### `PATCH /api/admin/users/[id]`
```typescript
// Body (Zod validado):
{
  platformFeePercent?: number,  // 0.00 a 50.00
  platformFeeCents?: number,    // 0 a 10000 (centavos)
  withdrawalDays?: number,      // 0 a 90
  registrationStep?: 1 | 2,
  role?: "USER" | "ADMIN"
}
```

### `GET /api/admin/sales`
```typescript
// Query: userId, status, paymentMethod, startDate, endDate, page
// Retorna todas as vendas da plataforma (não filtra por userId do admin)
```

### `GET /api/admin/bots`
```typescript
// Query: userId, isActive, page
// Retorna todos os bots (sem expor tokenEncrypted)
```

---

## 8. Padrões de UI do Projeto

- **Framework:** Next.js 14 App Router + Tailwind CSS + shadcn/ui
- **Estado:** Zustand para UI state complexo, SWR para fetch de dados
- **Formulários:** React Hook Form + Zod
- **Toasts:** `sonner` (toast.success / toast.error)
- **Drawers/Modals:** Radix UI Dialog — padrão do projeto é painel deslizante da direita (`right-0 top-0 h-full max-w-md`)
- **Animações de painel:** `data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right`
- **Loading states:** Skeleton em todas as listas/tabelas
- **Empty states:** ilustração + CTA em toda listagem vazia
- **Cores de status:**
  - APPROVED / ACTIVE → `bg-green-100 text-green-700`
  - PENDING / REMARKETING → `bg-yellow-100 text-yellow-700`
  - REFUSED / FAILED / KICKED → `bg-red-100 text-red-700`
  - REFUNDED → `bg-orange-100 text-orange-700`
  - CHARGEBACK → `bg-purple-100 text-purple-700`
  - PROCESSING → `bg-blue-100 text-blue-700`
  - COMPLETED → `bg-green-100 text-green-700`
- **Tabelas:** TanStack Table com paginação manual
- **Gráficos:** Recharts (já instalado)
- **Sidebar do admin:** visual distinto do dashboard do seller — usar fundo escuro (gray-900) ou accent diferente para diferenciar visualmente

---

## 9. Regras de Negócio Críticas para o Admin

1. **Nunca alterar `feeAmountCents` de sales já existentes** — apenas alterar as taxas do user afeta vendas futuras
2. **Rejeitar saque restaura o saldo** automaticamente — a query de saldo exclui saques `FAILED`, então o saldo já reaparece sem ação adicional
3. **Aprovar saque (→ PROCESSING) não transfere dinheiro** — é apenas uma marcação de que o admin vai fazer a transferência TED/PIX manualmente na conta do Asaas
4. **COMPLETED só pode vir de PROCESSING** — não pular estados
5. **Admin não pode deletar usuários** — apenas desabilitar (`registrationStep = 1`)
6. **Token do bot** — nunca descriptografar para exibir no painel admin; apenas confirmar se está configurado (`tokenEncrypted !== ""`)
7. **`platformFeePercent`** é um `Decimal` no Prisma — ao salvar, converter com `new Prisma.Decimal(value)`
