# GUIA DE EXECUÇÃO — O que mandar para o Claude Code, fase por fase

> **Como usar:** Copie cada bloco de texto marcado como `[ MANDAR PARA O CLAUDE CODE ]`  
> e envie **exatamente na ordem** abaixo. Só avance para a próxima fase após o Claude Code  
> confirmar que terminou e você ter testado o que foi pedido.

---

## FASE 0 — Setup inicial (faça você mesmo, antes de tudo)

Antes de abrir o Claude Code:

1. Crie o projeto: `npx create-next-app@latest nome-do-projeto --typescript --tailwind --app`
2. Coloque o arquivo `CLAUDE.md` na raiz do projeto
3. Abra o Claude Code na pasta do projeto: `claude` no terminal
4. Agora siga as fases abaixo

---

## FASE 1 — Dependências e configuração base

```
[ MANDAR PARA O CLAUDE CODE ]

Leia o CLAUDE.md na raiz do projeto. Com base na stack definida, instale todas as dependências necessárias:

- shadcn/ui (inicializar com: npx shadcn@latest init)
- Instalar componentes shadcn: button, input, label, card, sheet, tabs, badge, skeleton, select, checkbox, radio-group, dropdown-menu, popover, separator, avatar, dialog, toast
- framer-motion
- react-hook-form
- zod
- @hookform/resolvers
- zustand
- prisma + @prisma/client
- next-auth@beta
- bcryptjs + @types/bcryptjs
- grammy
- @xyflow/react
- recharts
- @tanstack/react-table
- bullmq
- ioredis
- sonner
- xlsx
- date-fns
- @radix-ui/react-icons
- lucide-react

Após instalar, configure o Prisma: npx prisma init

Crie o arquivo .env.local com todas as variáveis listadas no CLAUDE.md (valores vazios por enquanto).

Não escreva nenhuma lógica ainda. Só setup.
```

**✅ Teste antes de avançar:** Projeto roda sem erros com `npm run dev`

---

## FASE 2 — Schema do banco de dados

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o schema completo do Prisma em prisma/schema.prisma com os seguintes models:

**User**
- id (cuid), name, email (unique), passwordHash, emailVerified (DateTime?)
- registrationStep (Int, default 1)
- personType (enum: INDIVIDUAL | COMPANY, opcional)
- document (CPF/CNPJ, opcional), phone (opcional)
- zipCode, street, number, complement, neighborhood, city, state (todos opcionais)
- platformFeePercent (Decimal, default 5.99), platformFeeCents (Int, default 100)
- withdrawalDays (Int, default 30)
- role (enum: USER | ADMIN, default USER)
- createdAt, updatedAt

**Bot**
- id (cuid), userId (FK User), name, tokenEncrypted (String), channelId (opcional)
- isActive (Boolean, default false), createdAt, updatedAt
- Relações: User, BotProduct[], FlowNode[], FlowEdge[], Lead[]

**Product**
- id (cuid), userId (FK User), name, description (opcional)
- priceInCents (Int), paymentMethods (PaymentMethod[])
- isRecurring (Boolean, default false), billingType (enum: MONTHLY | ANNUAL, opcional)
- billingCycles (Int, opcional), createdAt, updatedAt
- Relações: User, BotProduct[], Sale[]

**BotProduct** (tabela pivot, máx 3 por bot — regra no código, não no schema)
- botId + productId (@@id composto), position (Int, default 0)
- Relações: Bot, Product

**FlowNode**
- id (cuid), botId (FK Bot)
- type (enum: TRIGGER_START | MESSAGE | SMART_DELAY | PAYMENT)
- posX (Float), posY (Float), data (Json)
- Relações: Bot, FlowEdge source, FlowEdge target

**FlowEdge**
- id (cuid), botId (FK Bot), sourceNodeId, targetNodeId, label (opcional)
- Relações: Bot, FlowNode source, FlowNode target

**Lead**
- id (cuid), botId (FK Bot), telegramId (String)
- name, username, phone, email (todos opcionais)
- createdAt
- @@unique([botId, telegramId])
- Relações: Bot, Sale[]

**Sale**
- id (cuid), userId (FK User), productId (FK Product), leadId (FK Lead, opcional)
- paymentMethod (enum: PIX | CREDIT_CARD)
- status (enum: PENDING | APPROVED | REFUSED | REFUNDED | CHARGEBACK, default PENDING)
- grossAmountCents, feeAmountCents, netAmountCents (todos Int)
- gatewayId (opcional), gatewayStatus (opcional)
- paidAt (opcional), availableAt (opcional), refundedAt (opcional)
- createdAt, updatedAt
- Relações: User, Product, Lead

**Withdrawal**
- id (cuid), userId (FK User), bankAccountId (FK BankAccount)
- amountCents (Int)
- status (enum: REQUESTED | PROCESSING | COMPLETED | FAILED, default REQUESTED)
- requestedAt (DateTime, default now()), processedAt (opcional)
- Relações: User, BankAccount

**BankAccount**
- id (cuid), userId (FK User)
- bankCode, agency, account, accountType (enum: CHECKING | SAVINGS)
- holderName, document, pixKey (opcional), isDefault (Boolean, default false)
- createdAt
- Relações: User, Withdrawal[]

Após criar o schema, rode: npx prisma migrate dev --name init

Crie o arquivo lib/prisma.ts com o singleton do PrismaClient.
```

**✅ Teste antes de avançar:** Migration roda sem erros. `npx prisma studio` abre e mostra todas as tabelas.

---

## FASE 3 — Autenticação

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente autenticação completa seguindo o CLAUDE.md:

**lib/auth.ts**
Configure NextAuth v5 com CredentialsProvider:
- Login por email + senha
- Verificar senha com bcryptjs.compare
- Retornar id, name, email, registrationStep, role na sessão
- JWT strategy

**app/api/auth/[...nextauth]/route.ts**
Export dos handlers GET e POST do NextAuth.

**app/api/users/route.ts — POST (registro)**
- Body: { name, email, password, confirmPassword }
- Validação Zod: email válido, senha min 8 chars, senhas iguais
- Verificar se email já existe
- Hash com bcryptjs, 12 rounds
- Criar usuário com registrationStep: 1
- Retornar { id, name, email } sem a senha

**app/(auth)/register/page.tsx**
Formulário com React Hook Form + Zod:
- Campos: Nome, E-mail, Senha, Confirmar Senha
- Submit chama POST /api/users, depois faz signIn automático
- Redireciona para /dashboard após login
- Link para /login

**app/(auth)/login/page.tsx**
Formulário com React Hook Form + Zod:
- Campos: E-mail, Senha, checkbox "Lembrar de mim"
- Submit chama signIn do NextAuth
- Redireciona para /dashboard
- Link para /register

**middleware.ts (raiz do projeto)**
- Protege todas as rotas que começam com /dashboard
- Redireciona para /login se não autenticado
- Redireciona para /dashboard se já autenticado e tenta acessar /login ou /register

Padrão visual: páginas de auth centralizadas, card simples, logo do produto no topo.
```

**✅ Teste antes de avançar:** Cadastro cria usuário. Login funciona. Acessar /dashboard sem login redireciona para /login.

---

## FASE 4 — Layout base do dashboard

```
[ MANDAR PARA O CLAUDE CODE ]

Crie o layout base para todas as páginas do dashboard em app/(dashboard)/layout.tsx.

**Componentes a criar:**

**components/layout/Sidebar.tsx**
Sidebar fixa à esquerda com:
- Logo do produto no topo
- Links de navegação com ícones (lucide-react):
  - Dashboard → /dashboard (LayoutDashboard)
  - Produtos → /products (Package)
  - Bots → /bots (Bot)
  - Vendas → /sales (ShoppingCart)
  - Carteira → /wallet (Wallet)
- Divisor antes de item Carteira
- Avatar + nome do usuário logado no rodapé
- Botão de logout
- Em mobile (< 768px): sidebar vira sheet/drawer abrindo por um botão hambúrguer

**components/layout/TopBar.tsx**
Barra superior com:
- Título da página atual (dinâmico)
- Avatar do usuário com dropdown (Ver perfil, Sair)

**components/layout/CompleteRegistrationBanner.tsx**
Banner amarelo/laranja não-intrusivo, renderizado dentro do layout:
- Só aparece se registrationStep === 1 (puxar da sessão)
- Texto: "⚠️ Complete seu cadastro para começar a vender."
- Botão "Completar agora →" abre um Sheet lateral
- Sheet contém formulário em 3 etapas (sem fechar ao clicar fora):

  Etapa 1: Select "Tipo de pessoa" (Pessoa Física / Pessoa Jurídica)
  
  Etapa 2: 
    - Input CPF (se PF) ou CNPJ (se PJ) com máscara
    - Input Telefone com máscara (XX) XXXXX-XXXX
  
  Etapa 3:
    - Input CEP com máscara XXXXX-XXX
    - Ao sair do campo CEP: fetch em https://viacep.com.br/ws/{cep}/json/
    - Auto-preencher: Rua, Bairro, Cidade, Estado
    - Focar automaticamente no campo Número após CEP preenchido
    - Input Número *
    - Input Complemento (opcional)
  
  Submit: PATCH /api/users/complete-registration
  Ao sucesso: atualizar sessão, fechar sheet, ocultar banner (sem reload)

**app/api/users/complete-registration/route.ts — PATCH**
- Autenticado (pegar userId da sessão)
- Validação Zod de todos os campos
- Atualizar usuário: todos os campos + registrationStep: 2
- Retornar usuário atualizado

**app/(dashboard)/layout.tsx**
Montar: Sidebar + TopBar + CompleteRegistrationBanner + {children}

Crie páginas placeholder (só o título h1) para: /dashboard, /products, /bots, /sales, /wallet
```

**✅ Teste antes de avançar:** Layout abre, navegação funciona, banner aparece, formulário de cadastro completa e some.

---

## FASE 5 — Produtos

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o módulo de Produtos completo.

**lib/validations/product.ts**
Schema Zod para criação/edição de produto:
- name: string min 2 chars
- description: string max 300 chars, opcional
- priceInCents: number > 0
- paymentMethods: array com ao menos 1 item (PIX | CREDIT_CARD)
- isRecurring: boolean (só relevante se CREDIT_CARD selecionado)
- billingType: MONTHLY | ANNUAL (obrigatório se isRecurring)
- billingCycles: number > 0 (obrigatório se isRecurring)

**app/api/products/route.ts**
- GET: lista produtos do usuário autenticado
- POST: cria produto (validar Zod, salvar com userId da sessão)

**app/api/products/[id]/route.ts**
- GET: retorna produto (verificar userId)
- PATCH: edita produto (verificar userId)
- DELETE: deleta produto (verificar userId, verificar se não está vinculado a bot ativo)

**app/(dashboard)/products/page.tsx**
- Buscar produtos via GET /api/products
- Grid de cards dos produtos
- Botão "Novo Produto" abre Sheet lateral com o formulário
- Card de produto mostra: nome, preço formatado, badge de método de pagamento, badge de recorrência
- Botões editar e deletar em cada card (deletar pede confirmação com AlertDialog)
- Empty state se não houver produtos

**components/products/ProductForm.tsx**
Formulário React Hook Form + Zod:
- Campo Nome
- Campo Descrição (textarea com contador de chars)
- Campo Preço (formatar como R$ enquanto digita)
- Checkboxes de forma de pagamento:
  - PIX
  - Cartão de Crédito
    - Se cartão marcado → mostrar checkbox "Cobrança recorrente" (marcado por padrão)
    - Se recorrência marcada → mostrar Select (Mensal/Anual) + Input número de ciclos
- Submit cria ou edita dependendo do contexto
```

**✅ Teste antes de avançar:** Criar, editar e deletar produto funciona. Validações bloqueiam submit inválido.

---

## FASE 6 — Bots (configuração)

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o módulo de Bots — apenas a configuração inicial (token e canal). O flow builder vem na próxima fase.

**lib/utils.ts (adicionar)**
Funções para criptografar e descriptografar o token do bot:
- encryptToken(token: string): string — AES-256 usando ENCRYPTION_KEY do .env
- decryptToken(encrypted: string): string

**lib/validations/bot.ts**
Schema Zod: name (min 2), tokenEncrypted (min 10), channelId (opcional no schema, obrigatório no formulário)

**app/api/bots/route.ts**
- GET: lista bots do usuário (retornar sem expor token descriptografado)
- POST: cria bot (criptografar token antes de salvar)

**app/api/bots/[id]/route.ts**
- GET: retorna bot (sem expor token)
- PATCH: edita bot (re-criptografar se token alterado)
- DELETE: deleta bot (verificar userId)

**app/api/bots/[id]/validate-token/route.ts — POST**
- Descriptografar token
- Chamar API do Telegram: GET https://api.telegram.org/bot{token}/getMe
- Retornar { valid: boolean, botName?: string, error?: string }

**app/(dashboard)/bots/page.tsx**
- Lista de bots em cards
- Cada card: nome, status badge (Ativo/Inativo), botão "Configurar" e "Editor de Fluxo"
- Botão "Novo Bot" abre Sheet com formulário
- Empty state

**app/(dashboard)/bots/[id]/page.tsx**
Formulário de configuração:
- Campo: Nome do bot
- Campo: Token do bot (input type password com botão mostrar/ocultar)
  - Helper: "Crie um bot com o @BotFather no Telegram e cole o token aqui"
- Campo: ID do Canal
  - Helper: "Adicione o bot ao canal e use o ID numérico (ex: -1001234567890)"
- Botão "Validar e Salvar":
  - Chama /api/bots/[id]/validate-token
  - Se inválido: toast de erro
  - Se válido: toast de sucesso mostrando o nome do bot, salva e redireciona para /bots/[id]/flow
- Também mostrar aqui: select de produtos para vincular ao bot (máx 3, buscar de /api/products)
```

**✅ Teste antes de avançar:** Criar bot, validar token (use um token real de teste), vincular produtos.

---

## FASE 7 — Flow Builder

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o editor de fluxo visual do bot em app/(dashboard)/bots/[id]/flow/page.tsx usando @xyflow/react.

**app/api/bots/[id]/flow/route.ts**
- GET: retorna { nodes: FlowNode[], edges: FlowEdge[] } do bot
- POST: recebe { nodes, edges }, deleta os antigos e salva os novos (transação Prisma)

**Tipos TypeScript para os nós (lib/types/flow.ts):**
```typescript
type TriggerNodeData = { label: 'Gatilho: /start' }

type MessageNodeData = {
  imageUrl?: string
  text: string        // suporta Markdown do Telegram
  ctaText?: string
  ctaUrl?: string
}

type SmartDelayNodeData = {
  amount: number
  unit: 'minutes' | 'hours' | 'days'
}

type PaymentNodeData = {
  productId: string
  productName: string
  ctaText: string
}
```

**components/bots/flow/nodes/ — 4 componentes de nó:**

TriggerNode.tsx: card azul, ícone Zap, texto "/start", não tem botão deletar, tem handle de saída

MessageNode.tsx: card verde, ícone MessageSquare, preview do texto (truncado), preview da imagem se existir, botão editar e deletar, handles entrada e saída

SmartDelayNode.tsx: card amarelo, ícone Clock, mostra "Aguardar X horas/minutos/dias", botão editar e deletar, handles entrada e saída

PaymentNode.tsx: card roxo, ícone CreditCard, mostra nome do produto e CTA, botão editar e deletar, handles entrada e saída

**components/bots/flow/FlowEditor.tsx**
Canvas React Flow com:
- Nó inicial TriggerNode fixo (não deletável, não movível)
- Botão "+ Adicionar passo" em cada nó (exceto PaymentNode) abre Popover com 3 opções: Mensagem | Intervalo Inteligente | Pagamento
- Ao escolher uma opção: criar novo nó conectado automaticamente
- Ao clicar em editar de qualquer nó: abrir Sheet lateral com formulário do nó

**Formulários nos Sheets laterais:**

Mensagem: upload imagem (preview), textarea texto, input CTA texto, input CTA URL

Intervalo Inteligente: input numérico quantidade, select unidade (minutos/horas/dias)

Pagamento: select produto (dos vinculados ao bot), input texto do botão CTA

**Barra superior do editor:**
- Botão "← Voltar" para /bots/[id]
- Nome do bot
- Botão "Salvar Fluxo" (POST /api/bots/[id]/flow com os nós e arestas atuais) — toast sucesso/erro
- Botão "Ativar Bot" / "Desativar Bot" (PATCH /api/bots/[id] com isActive)

**app/(dashboard)/bots/[id]/flow/page.tsx**
- Buscar dados do flow via GET na montagem
- Renderizar FlowEditor com os dados
- Loading skeleton enquanto carrega
```

**✅ Teste antes de avançar:** Criar nós de todos os tipos, conectar, editar, salvar, recarregar página e ver que o flow persistiu.

---

## FASE 8 — Gateway de pagamento

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente a abstração do gateway de pagamento. Use Asaas como provider (tem sandbox gratuito).

**lib/gateway.ts**
Criar classe/módulo GatewayService com os métodos:

```typescript
// Criar cobrança PIX
createPixCharge(params: {
  customerName: string
  customerEmail: string
  customerCpfCnpj: string
  amountCents: number
  description: string
  externalReference: string  // Sale.id
}): Promise<{ id: string; pixCode: string; expiresAt: Date }>

// Criar assinatura recorrente (cartão)
createSubscription(params: {
  customerName: string
  customerEmail: string
  customerCpfCnpj: string
  amountCents: number
  billingType: 'MONTHLY' | 'ANNUAL'
  description: string
  externalReference: string
  cardToken?: string
}): Promise<{ id: string; paymentUrl: string }>

// Cancelar assinatura
cancelSubscription(gatewayId: string): Promise<void>

// Processar webhook recebido
parseWebhook(payload: unknown, signature: string): WebhookEvent
```

Implementar usando fetch para a API REST do Asaas (https://sandbox.asaas.com/api/v3).
Configurar base URL via env: use sandbox se NODE_ENV !== 'production'.

**app/api/webhooks/payment/route.ts — POST**
1. Ler o body RAW (não parsear automaticamente)
2. Validar assinatura HMAC com GATEWAY_WEBHOOK_SECRET
3. Se inválida: retornar 401
4. Parsear evento
5. Encontrar Sale pelo externalReference (gatewayId)
6. Atualizar status da venda conforme evento:
   - PAYMENT_CONFIRMED → APPROVED, definir paidAt, calcular availableAt
   - PAYMENT_REFUSED → REFUSED
   - PAYMENT_REFUNDED → REFUNDED, definir refundedAt
7. Retornar 200

**Cálculo do availableAt:**
- PIX: paidAt + 1 dia útil
- Cartão: paidAt + 30 dias corridos

**Não implementar ainda a criação de cobranças via bot** — isso vem na fase do worker.
```

**✅ Teste antes de avançar:** Enviar webhook simulado para /api/webhooks/payment e ver status da venda atualizado no banco (use npx prisma studio).

---

## FASE 9 — Worker do Bot

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o worker que processa o fluxo do bot e envia mensagens no Telegram.

**workers/bot-worker.ts**
Worker BullMQ que consome a fila "bot-jobs" do Redis.

Tipos de job:
- PROCESS_FLOW: quando lead envia /start
- SEND_MESSAGE: enviar mensagem Telegram para um lead
- PROCESS_DELAY: aguardar X tempo e então disparar próximo nó
- CREATE_PAYMENT: gerar cobrança e enviar link ao lead

**lib/telegram.ts**
Classe TelegramService:
- Inicializar bot grammy com token descriptografado
- sendMessage(chatId, text, options?) — suporta Markdown
- sendPhoto(chatId, imageUrl, caption?, options?)
- sendInlineKeyboard(chatId, text, buttons: Array<{text, url | callbackData}>)
- startPolling() / stopPolling()

**Lógica do PROCESS_FLOW:**
1. Buscar bot pelo id, descriptografar token
2. Buscar FlowNodes do bot em ordem (começar pelo TRIGGER_START)
3. Percorrer nós em sequência:
   - MESSAGE → adicionar job SEND_MESSAGE na fila (imediato)
   - SMART_DELAY → adicionar job PROCESS_DELAY com delay em ms
   - PAYMENT → adicionar job CREATE_PAYMENT

**Lógica do CREATE_PAYMENT:**
1. Buscar produto pelo id nos dados do nó
2. Calcular taxas: usar função de lib/utils.ts
3. Criar registro Sale com status PENDING no banco
4. Chamar GatewayService para criar cobrança
5. Atualizar Sale com gatewayId
6. Enviar link de pagamento ao lead via Telegram

**app/api/bots/[id]/toggle/route.ts — PATCH**
- Se isActive = true → chamar startPolling do bot, registrar listener de /start
- Se isActive = false → parar polling
- Atualizar isActive no banco

**Listener de /start (registrar quando bot ativado):**
```typescript
bot.command('start', async (ctx) => {
  // upsert Lead com telegramId = ctx.from.id
  // adicionar job PROCESS_FLOW na fila
})
```

Não é necessário deploy do worker agora — apenas garantir que roda localmente com `npx ts-node workers/bot-worker.ts`
```

**✅ Teste antes de avançar:** Bot ativo responde ao /start, percorre o fluxo, para em SMART_DELAY o tempo correto, gera cobrança PIX e manda o link.

---

## FASE 10 — Dashboard

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente a página Dashboard completa em app/(dashboard)/dashboard/page.tsx.

**app/api/dashboard/stats/route.ts — GET**
Query params: startDate, endDate (ISO strings)
Retornar:
- netRevenue: soma de netAmountCents das vendas APPROVED no período
- totalSales: count de vendas no período
- cardApprovalRate: aprovadas / (aprovadas + recusadas) de cartão * 100
- conversionRate: vendas aprovadas / leads únicos que iniciaram no período * 100
- totalRefunds: count de REFUNDED no período
- chartData: array de { date: string, netRevenue: number, sales: number } por dia do período

**components/dashboard/DateRangePicker.tsx**
Botões de atalho: Hoje | Ontem | 7 dias | 14 dias | Este mês | Mês passado | Personalizado
"Personalizado" abre um Popover com dois inputs de data (início e fim).
Ao mudar período → callback onRangeChange(startDate, endDate).

**components/dashboard/StatsCard.tsx**
Props: title, value, icon, description?, trend? (número % de variação)
Card com ícone, valor grande, descrição pequena.

**Página Dashboard:**
- Montar DateRangePicker (padrão: este mês)
- 5 StatsCards em grid responsivo (2 cols mobile, 3 tablet, 5 desktop)
- Gráfico de área (Recharts AreaChart) abaixo dos cards
  - Eixo X: datas do período
  - Eixo Y: valor líquido em R$
  - Tooltip com valor + nº de vendas
  - Área com gradiente suave
- Loading: Skeletons nos cards e no gráfico enquanto fetcha
- Todos os valores monetários formatados como R$ X.XXX,XX
- Percentuais com 1 casa decimal
```

**✅ Teste antes de avançar:** Trocar período refaz o fetch. Cards exibem valores corretos. Gráfico renderiza.

---

## FASE 11 — Vendas

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente a página de Vendas em app/(dashboard)/sales/page.tsx.

**app/api/sales/route.ts — GET**
Query params: startDate, endDate, status, paymentMethod, page (default 1), limit (default 50)
- Filtrar por userId da sessão
- Filtrar pelos query params
- Retornar: { sales: Sale[], total: number, pages: number }

**components/sales/SalesTable.tsx**
TanStack Table com colunas:
- Data/Hora (formatada: DD/MM/YYYY HH:mm)
- Cliente (nome do lead)
- E-mail
- Produto
- Pagamento (badge: PIX | Cartão)
- Valor Bruto (R$)
- Taxa (R$)
- Valor Líquido (R$)
- Status (badge colorido):
  - APPROVED → verde
  - PENDING → amarelo
  - REFUSED → vermelho
  - REFUNDED → laranja
  - CHARGEBACK → roxo

**Filtros acima da tabela:**
- DateRangePicker (reutilizar componente)
- Select de status (Todos / Aprovado / Recusado / Reembolsado / Pendente / Chargeback)
- Select de pagamento (Todos / PIX / Cartão)
- Botão "Exportar" com dropdown .xlsx | .csv

**components/sales/ExportButton.tsx**
Ao clicar em xlsx ou csv:
- Buscar TODAS as vendas do filtro atual (sem paginação)
- Montar arquivo com biblioteca xlsx
- Download automático do arquivo

**Paginação** na tabela (Anterior / Próxima / indicador de página).

**Empty state** se não houver vendas.
```

**✅ Teste antes de avançar:** Filtros funcionam, paginação funciona, exportação gera arquivo correto.

---

## FASE 12 — Carteira

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente a página Carteira em app/(dashboard)/wallet/page.tsx.

**app/api/wallet/balance/route.ts — GET**
Calcular para o userId da sessão:
- availableBalance: soma de netAmountCents onde status = APPROVED e availableAt <= now()
- pendingBalance: soma de netAmountCents onde status = APPROVED e availableAt > now()
Retornar { availableBalance, pendingBalance }

**app/api/wallet/withdrawals/route.ts**
- GET: lista saques do usuário com dados da conta bancária
- POST: criar saque
  - Validar que amountCents <= availableBalance
  - Validar que bankAccountId pertence ao usuário
  - Criar Withdrawal com status REQUESTED

**app/api/wallet/bank-accounts/route.ts**
- GET: lista contas bancárias do usuário
- POST: cria conta bancária (validar campos, se isDefault=true, remover default das outras)

**app/api/wallet/bank-accounts/[id]/route.ts**
- DELETE: remove conta (verificar userId, não pode remover se tiver saques pendentes)

**Página Carteira:**

Cards superiores:
- Saldo Disponível (R$) + botão "Solicitar Saque"
- Saldo Pendente (R$) + texto "Aguardando liberação"

Botão Solicitar Saque:
- Desabilitado se availableBalance = 0 ou sem conta bancária
- Abre Sheet com: input valor (pré-preenchido com saldo total, editável), select conta bancária
- Submit cria Withdrawal

Abas (Tabs):
1. Saques: tabela com Data, Valor, Banco, Status badge
2. Dados Bancários:
   - Formulário: select banco (lista de bancos brasileiros principais), agência, conta, tipo (Corrente/Poupança), nome titular, CPF/CNPJ titular, chave PIX (opcional), checkbox "conta padrão"
   - Lista de contas cadastradas com botão remover
3. Taxas e Prazos: card informativo mostrando taxa do usuário (puxar da sessão/API), prazos PIX e cartão, info de antecipação

Lista de bancos (incluir ao menos): Banco do Brasil (001), Bradesco (237), Caixa (104), Itaú (341), Santander (033), Nubank (260), Inter (077), Sicoob (756), BTG (208), XP (102)
```

**✅ Teste antes de avançar:** Saldos corretos, cadastrar conta bancária, fazer saque, ver histórico de saques.

---

## FASE 13 — Painel Admin

```
[ MANDAR PARA O CLAUDE CODE ]

Implemente o painel admin em app/admin/.

**Middleware: proteger /admin**
- Verificar se role === 'ADMIN' na sessão
- Redirecionar para /dashboard se não for admin

**app/admin/page.tsx — Usuários**
Tabela com: Nome, E-mail, Cadastro completo (sim/não), Taxa atual (%), Taxa fixa (R$), Total vendas, Data de cadastro

Ao clicar em usuário → Sheet lateral com formulário:
- Input: Taxa percentual (%)
- Input: Taxa fixa (R$)
- Input: Prazo de recebimento (dias)
- Salvar via PATCH /api/admin/users/[id]/fees

**app/api/admin/users/route.ts — GET** (protegido por role ADMIN)
Lista todos os usuários com seus totais de vendas.

**app/api/admin/users/[id]/fees/route.ts — PATCH** (protegido)
Atualiza platformFeePercent, platformFeeCents, withdrawalDays do usuário.

**app/admin/withdrawals/page.tsx — Saques pendentes**
Tabela de saques com status REQUESTED ou PROCESSING.
Botões: Aprovar (→ COMPLETED) | Rejeitar (→ FAILED) por linha.
```

**✅ Teste antes de avançar:** Admin consegue ver usuários, alterar taxas, aprovar saques.

---

## FASE 14 — Polish final

```
[ MANDAR PARA O CLAUDE CODE ]

Faça o polish final de toda a aplicação:

1. **Skeletons:** Verificar que toda página com fetch tem skeleton enquanto carrega. Adicionar onde estiver faltando.

2. **Empty states:** Toda listagem vazia deve ter: ícone ilustrativo + título + subtítulo + botão de ação primária. Verificar: Produtos, Bots, Vendas, Saques, Contas Bancárias.

3. **Tratamento de erros:** Toda chamada de API que pode falhar deve ter catch com toast de erro. Verificar todos os formulários e ações de tabela.

4. **Mobile:** Testar e ajustar em viewport 375px:
   - Sidebar vira drawer
   - Tabelas têm scroll horizontal
   - Cards de dashboard ficam em 1 coluna
   - Formulários sem overflow

5. **Formatação monetária consistente:** Criar função formatCurrency(cents: number): string em lib/utils.ts e usar em todo lugar.

6. **Feedback de loading nos botões:** Todo botão que faz request deve mostrar spinner + texto "Salvando..." durante o request. Usar estado isLoading local.

7. **Confirmações de ação destrutiva:** Deletar produto, deletar bot, deletar conta bancária, cancelar assinatura — todos devem ter AlertDialog de confirmação.

8. **Títulos de página:** TopBar deve mostrar o título correto em cada rota.

9. **Favicon e metadados:** Adicionar título e descrição básicos no app/layout.tsx.

10. **Verificar CLAUDE.md:** Confirmar que todas as regras de negócio estão implementadas, especialmente: limite de 3 produtos por bot (validar na API e mostrar aviso no frontend), token criptografado, isolamento de dados por userId.
```

**✅ Teste final:** Percorrer toda a aplicação como um novo usuário: cadastro → completar cadastro → criar produto → criar bot → configurar flow → ativar bot → ver vendas → solicitar saque.

---

## RESUMO DAS FASES

| # | Fase | Estimativa |
|---|---|---|
| 0 | Setup manual | 10 min |
| 1 | Dependências | 15 min |
| 2 | Schema Prisma | 20 min |
| 3 | Autenticação | 30 min |
| 4 | Layout base | 45 min |
| 5 | Produtos | 30 min |
| 6 | Bots (config) | 30 min |
| 7 | Flow Builder | 60 min |
| 8 | Gateway pagamento | 45 min |
| 9 | Worker do bot | 60 min |
| 10 | Dashboard | 30 min |
| 11 | Vendas | 30 min |
| 12 | Carteira | 45 min |
| 13 | Admin | 20 min |
| 14 | Polish | 30 min |

> **Regra de ouro:** Se o Claude Code fizer algo errado em uma fase, corrija antes de avançar. Bugs acumulam e ficam exponencialmente mais difíceis de corrigir nas fases seguintes.
