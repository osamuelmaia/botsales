# Documentação — Painel Administrativo BotSales

---

## 1. Visão Geral e Arquitetura

### Premissa
O painel admin é uma área restrita, acessível apenas por usuários com `role = ADMIN` no banco de dados. Toda rota, API e componente do painel vive sob um namespace separado (`/admin`) e não reutiliza o layout do dashboard do usuário comum.

### Stack (mesma do projeto)
- Next.js 14 App Router — `app/admin/`
- Prisma queries com `userId` nunca filtrado (admin vê tudo)
- Middleware de autenticação dedicado verificando `role === "ADMIN"`
- Componentes próprios em `components/admin/`

### Estrutura de rotas
```
/admin
  /dashboard          ← visão geral / KPIs
  /users              ← lista de usuários
  /users/[id]         ← perfil detalhado do usuário
  /sales              ← todas as vendas da plataforma
  /bots               ← todos os bots
  /products           ← todos os produtos
  /withdrawals        ← fila de saques para aprovação
  /wallet             ← financeiro da plataforma (receita de taxas)
  /settings           ← configurações globais da plataforma
```

---

## 2. Middleware e Segurança

### Regras obrigatórias
- Verificar `session.user.role === "ADMIN"` em **toda** rota `/admin` via `middleware.ts`
- Se não autenticado → redirecionar para `/login`
- Se autenticado mas não admin → redirecionar para `/dashboard` com toast "Acesso negado"
- Todas as API routes de admin (`/api/admin/*`) repetem a verificação de role no servidor — nunca confiar só no middleware
- Todas as ações destrutivas (desativar conta, forçar saque, alterar taxa) devem ser registradas em log de auditoria (`AuditLog` — ver seção 9)

---

## 3. Página: Dashboard Admin (`/admin/dashboard`)

### Cards de KPI (linha principal)
| Card | Dado | Cálculo |
|---|---|---|
| Usuários cadastrados | Total de Users no DB | `COUNT(User)` |
| Usuários ativos | Registrados no step 2 | `COUNT(User WHERE registrationStep=2)` |
| Receita de taxas (mês atual) | Soma das taxas cobradas | `SUM(Sale.feeAmountCents WHERE paidAt >= início do mês)` |
| Volume bruto (mês atual) | Total vendido | `SUM(Sale.grossAmountCents WHERE status=APPROVED)` |
| Saques pendentes | Aguardando aprovação | `COUNT(Withdrawal WHERE status=REQUESTED)` |
| Bots ativos | Bots ligados agora | `COUNT(Bot WHERE isActive=true)` |

### Gráfico 1 — Receita de taxas por mês (12 meses)
- Tipo: BarChart (Recharts)
- Eixo X: meses (Jan–Dez)
- Eixo Y: valor em R$ das taxas (`feeAmountCents`)
- Agrupamento: `DATE_TRUNC('month', paidAt)`

### Gráfico 2 — Novos usuários por mês
- Tipo: LineChart
- Eixo X: meses
- Eixo Y: contagem de `User.createdAt`

### Gráfico 3 — Vendas por método de pagamento (mês atual)
- Tipo: PieChart
- PIX vs CREDIT_CARD — quantidade e valor

### Tabela — Saques aguardando aprovação (últimos 5)
- Colunas: usuário, valor, banco, solicitado em, ação rápida (Aprovar / Rejeitar)
- Link "Ver todos" → `/admin/withdrawals`

### Tabela — Últimas vendas da plataforma (10 mais recentes)
- Colunas: comprador (lead), produto, valor bruto, taxa, status, data

---

## 4. Página: Usuários (`/admin/users`)

### Filtros
- Busca por nome ou e-mail (full-text simples)
- Status de cadastro: Todos / Completo (step 2) / Incompleto (step 1)
- Tipo de pessoa: Todos / Física / Jurídica
- Período de cadastro: data início — data fim
- Role: USER / ADMIN

### Tabela (TanStack Table, paginação server-side)
| Coluna | Dado |
|---|---|
| Avatar (inicial do nome) | — |
| Nome | `User.name` |
| E-mail | `User.email` |
| Cadastro | `User.createdAt` formatado |
| Tipo | `User.personType` (PF/PJ) |
| Step | Badge: "Completo" verde / "Incompleto" amarelo |
| Bots | contagem de bots do usuário |
| Vendas | contagem de sales aprovadas |
| Saldo disp. | `balanceCents` calculado |
| Status | "Ativo" / "Suspenso" (campo `User.suspendedAt` — ver seção 9) |
| Ações | Ícone "Ver perfil", ícone "Suspender/Reativar" |

### Ações em massa
- Selecionar múltiplos usuários → "Suspender selecionados"
- Export CSV da listagem com filtros aplicados

---

## 5. Página: Perfil do Usuário (`/admin/users/[id]`)

Esta é a página mais densa do painel. Dividida em abas/seções:

### Seção A — Dados pessoais
- Nome, e-mail, telefone, CPF/CNPJ, endereço completo
- Data de cadastro, último login (se implementado)
- `registrationStep`, `personType`, `role`
- Botão **"Editar dados"** → modal com campos editáveis (nome, e-mail, documento)
- Botão **"Suspender conta"** → confirmar → seta `suspendedAt = now()`, desativa todos os bots do usuário
- Botão **"Alterar taxa"** → modal com campo percentual + taxa fixa, salvando em `User.platformFeePercent` e `User.platformFeeCents`

### Seção B — Resumo financeiro
Quatro cards:
- Saldo disponível para saque
- Saldo pendente (bloqueado)
- Total recebido (soma de vendas aprovadas)
- Total sacado (soma de withdrawals concluídos)

### Seção C — Vendas ao longo do tempo
- **Visão mensal**: BarChart com 12 meses — volume bruto e taxa cobrada lado a lado
- **Visão diária** (ao clicar num mês): abre detalhamento do mês selecionado dia a dia
- Tabela abaixo do gráfico: todas as vendas do usuário com colunas (produto, método, valor bruto, taxa, status, data)
- Filtros: status (PENDING/APPROVED/REFUSED/REFUNDED), método (PIX/CREDIT_CARD), período

### Seção D — Produtos
Tabela com todos os produtos do usuário:
| Coluna | Dado |
|---|---|
| Nome | `Product.name` |
| Descrição | truncada, expandível |
| Valor | `Product.priceInCents` |
| Tipo | "Único" ou "Recorrente" |
| Cobrança | — / Mensal / Anual |
| Ciclos | `billingCycles` ou "Indefinido" |
| Métodos | badges PIX / Cartão |
| Vendas | count de sales deste produto |

### Seção E — Bots
Cards de cada bot:
- Nome do bot, status (ativo/inativo), data de criação
- Quantidade de produtos vinculados (máx. 3)
- Quantidade de leads captados
- Quantidade de vendas geradas por este bot
- Botão **"Forçar desativação"** → seta `isActive = false` e faz `deleteWebhook`

### Seção F — Carteira (detalhada)
- Cards de saldo (disponível, pendente, total sacado)
- Tabela de saques: valor, conta bancária, status, data solicitação, data processamento
- Tabela de contas bancárias: banco, agência, conta, chave PIX, principal

### Seção G — Log de auditoria do usuário
- Registro de todas as ações admin feitas sobre esta conta (quem fez, o quê, quando)

---

## 6. Página: Todas as Vendas (`/admin/sales`)

### Filtros
- Período (data início / data fim)
- Status: PENDING / APPROVED / REFUSED / REFUNDED / CHARGEBACK
- Método: PIX / CREDIT_CARD
- Busca por usuário (nome ou e-mail)
- Busca por produto

### Tabela
| Coluna | Dado |
|---|---|
| ID (truncado) | `Sale.id` com copy |
| Usuário | nome do dono do bot |
| Lead | nome/username do comprador |
| Produto | `Product.name` |
| Método | badge PIX / Cartão |
| Valor bruto | `grossAmountCents` |
| Taxa plataforma | `feeAmountCents` |
| Valor líquido | `netAmountCents` |
| Status | badge colorido |
| Criado em | `createdAt` |
| Disponível em | `availableAt` |

### Métricas acima da tabela
- Total de vendas no período filtrado
- Volume bruto total
- Taxa total arrecadada
- Ticket médio

### Export
- XLSX e CSV com os filtros ativos

---

## 7. Página: Saques (`/admin/withdrawals`)

Esta é a página de **aprovação/gestão de saques** — fluxo crítico.

### Abas
1. **Pendentes** (`status = REQUESTED`) — foco principal
2. **Em processamento** (`status = PROCESSING`)
3. **Histórico** (`COMPLETED` + `FAILED`)

### Tabela — Pendentes
| Coluna | Dado |
|---|---|
| Usuário | nome + e-mail |
| Valor solicitado | `amountCents` |
| Saldo disponível | calculado em tempo real |
| Banco | código + nome do banco |
| Agência / Conta | dados bancários |
| Chave PIX | `BankAccount.pixKey` |
| Solicitado em | `requestedAt` |
| Ações | **Aprovar** (verde) / **Rejeitar** (vermelho) |

### Ação: Aprovar saque
1. Modal de confirmação mostrando todos os dados do saque
2. Admin confirma → `status = PROCESSING` → integração com API de transferência PIX do Asaas (ou manual)
3. Quando transferência confirmada → `status = COMPLETED`, `processedAt = now()`
4. Notificação ao usuário (toast na próxima sessão ou e-mail)

### Ação: Rejeitar saque
1. Modal com campo "Motivo da rejeição" (obrigatório)
2. `status = FAILED` + motivo salvo
3. Saldo retorna ao disponível automaticamente (não há débito real)

### Validação antes de aprovar
- Confirmar que `amountCents <= balanceCents` no momento da aprovação (proteção contra race condition)
- Confirmar que conta bancária ainda existe e pertence ao usuário

---

## 8. Página: Todos os Bots (`/admin/bots`)

### Filtros
- Busca por nome do bot
- Status: Todos / Ativo / Inativo
- Usuário (busca por e-mail)

### Tabela
| Coluna | Dado |
|---|---|
| Nome do bot | `Bot.name` |
| Usuário | nome do dono |
| Status | badge Ativo/Inativo |
| Produtos | count (`BotProduct`) |
| Leads | count (`Lead`) |
| Vendas | count de `Sale` originadas |
| Criado em | `Bot.createdAt` |
| Ações | "Ver usuário" / "Forçar desativação" |

---

## 9. Modelos de dados adicionais necessários

### Campo `User.suspendedAt`
```prisma
suspendedAt  DateTime?   // null = ativo, data = suspenso
```
Ao suspender: desativar todos os bots do usuário, impedir login.

### Modelo `AuditLog`
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  adminId    String                        // quem executou
  action     String                        // ex: "SUSPEND_USER"
  targetId   String?                       // id do alvo (userId, withdrawalId...)
  targetType String?                       // "User" | "Withdrawal" | "Bot"
  payload    Json?                         // dados antes/depois da mudança
  ip         String?
  createdAt  DateTime @default(now())

  admin  User @relation(fields: [adminId], references: [id])
}
```

### Campo `Withdrawal.rejectionReason`
```prisma
rejectionReason  String?   // preenchido quando status = FAILED
```

---

## 10. Página: Configurações da Plataforma (`/admin/settings`)

### Seção A — Taxas padrão
- Taxa percentual padrão para novos usuários (`platformFeePercent`)
- Taxa fixa padrão (`platformFeeCents`)
- Dias de bloqueio para cartão (padrão: 30)
- Dias de bloqueio para PIX (padrão: 1 dia útil)
- Botão salvar → atualiza valores default (não retroage a usuários existentes)

### Seção B — Gestão de admins
- Lista de usuários com `role = ADMIN`
- Botão "Promover usuário a admin" → busca por e-mail → confirmar
- Botão "Remover acesso admin" → confirmar (não pode remover o próprio acesso)

### Seção C — Log de auditoria global
Tabela de todas as ações admin:
- Admin que executou
- Ação (suspendeu usuário X, aprovou saque Y, alterou taxa do usuário Z)
- Alvo (userId, withdrawalId, etc.)
- Timestamp
- IP (opcional)

---

## 11. APIs necessárias

```
GET    /api/admin/stats                    ← KPIs do dashboard
GET    /api/admin/users                    ← lista paginada + filtros
GET    /api/admin/users/[id]               ← perfil completo
PATCH  /api/admin/users/[id]               ← editar dados, suspender, alterar taxa
GET    /api/admin/users/[id]/sales         ← vendas do usuário (com agrupamento mensal)
GET    /api/admin/sales                    ← todas as vendas + filtros
GET    /api/admin/bots                     ← todos os bots
PATCH  /api/admin/bots/[id]               ← forçar desativação
GET    /api/admin/withdrawals              ← lista por status
PATCH  /api/admin/withdrawals/[id]         ← aprovar ou rejeitar
GET    /api/admin/settings                 ← configurações atuais
PATCH  /api/admin/settings                 ← salvar configurações
GET    /api/admin/audit-log               ← log global de auditoria
```

Todas as rotas verificam `role === "ADMIN"` no início — sem exceção.

---

## 12. Ordem sugerida de desenvolvimento

1. Middleware + layout admin (sidebar próprio, sem layout de usuário)
2. Modelo `AuditLog` + campo `suspendedAt` + campo `rejectionReason` + migration
3. Dashboard admin (KPIs + gráficos)
4. Lista de usuários + perfil completo
5. Página de vendas global
6. Fila de saques (aprovação/rejeição)
7. Lista de bots
8. Configurações + gestão de admins
