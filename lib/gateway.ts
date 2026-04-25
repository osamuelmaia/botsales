/**
 * GatewayService — abstração sobre a API REST do Asaas
 *
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Produção: https://api.asaas.com/api/v3
 *
 * Controle de ambiente: ASAAS_ENVIRONMENT=production|sandbox (default: sandbox)
 * Autenticação: header `access_token: $GATEWAY_API_KEY`
 */

import crypto from "crypto"

// ─── Base URL ─────────────────────────────────────────────────────────────────

const BASE_URL =
  process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3"

console.log(`[asaas] environment: ${process.env.ASAAS_ENVIRONMENT ?? "sandbox (default)"} → ${BASE_URL}`)

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT = 15_000 // 15 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_REFUSED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_REFUNDED"
  | "UNKNOWN"

export interface WebhookEvent {
  type: WebhookEventType
  saleId: string         // externalReference do Asaas = Sale.id
  gatewayId: string      // ID do pagamento no Asaas
  subscriptionId: string | null // ID da assinatura no Asaas (se recorrente)
  paymentMethod: "PIX" | "CREDIT_CARD" | null
}

interface AsaasCustomer {
  id: string
}

interface AsaasPayment {
  id: string
  status: string
  billingType: string
  externalReference: string
  dueDate: string
  value: number
  subscription?: string // Asaas subscription ID (present for recurring charges)
}

interface AsaasSubscription {
  id: string
  url: string
}

interface AsaasQrCode {
  encodedImage: string // base64 PNG
  payload: string      // PIX copia-e-cola
  expirationDate: string
}

interface AsaasWebhookPayload {
  event: string
  payment?: AsaasPayment
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function apiKey(): string {
  // APP_GATEWAY_API_KEY is a fallback for envs where PM2 has corrupted GATEWAY_API_KEY=""
  const key = process.env.GATEWAY_API_KEY || process.env.APP_GATEWAY_API_KEY
  if (!key) throw new Error("GATEWAY_API_KEY não configurado")
  return key
}

async function asaasRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`
  console.log(`[asaas] ${method} ${url}`)

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[asaas] ${method} ${path} → ${res.status}: ${text}`)
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }

  if (method === "DELETE") return {} as T
  return res.json() as Promise<T>
}

const asaasGet = <T>(path: string) => asaasRequest<T>("GET", path)
const asaasPost = <T>(path: string, body: unknown) => asaasRequest<T>("POST", path, body)
const asaasDelete = (path: string) => asaasRequest<void>("DELETE", path)

// ─── Business day helper ──────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Customer lookup / creation ───────────────────────────────────────────────

interface CustomerParams {
  name: string
  email: string
  cpfCnpj: string
}

async function findOrCreateCustomer(params: CustomerParams): Promise<string> {
  // Search by CPF/CNPJ first (avoid duplicates in Asaas)
  // Asaas may return 404 when no customers exist yet — treat as empty result
  try {
    const res = await fetch(
      `${BASE_URL}/customers?cpfCnpj=${encodeURIComponent(params.cpfCnpj)}&limit=1`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", access_token: apiKey() },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    )
    if (res.ok) {
      const search = await res.json() as { data: AsaasCustomer[] }
      if (search.data?.length > 0) return search.data[0].id
    }
  } catch {
    // network error on search — proceed to create
  }

  const customer = await asaasPost<AsaasCustomer>("/customers", {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj,
  })

  return customer.id
}

// ─── GatewayService ───────────────────────────────────────────────────────────

export const GatewayService = {
  /**
   * Tokeniza cartão de crédito no Asaas (server-side).
   * Retorna um token seguro para uso em createSubscription.
   */
  async tokenizeCard(params: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
    customerName: string
    customerEmail: string
    customerCpfCnpj: string
    postalCode: string
    phone: string
  }): Promise<string> {
    const result = await asaasPost<{ creditCardToken: string }>("/creditCards/tokenize", {
      creditCard: {
        holderName: params.holderName,
        number: params.number.replace(/\s/g, ""),
        expiryMonth: params.expiryMonth,
        expiryYear: params.expiryYear,
        ccv: params.ccv,
      },
      creditCardHolderInfo: {
        name: params.customerName,
        email: params.customerEmail,
        cpfCnpj: params.customerCpfCnpj.replace(/\D/g, ""),
        postalCode: params.postalCode.replace(/\D/g, ""),
        phone: params.phone.replace(/\D/g, ""),
      },
    })
    return result.creditCardToken
  },

  /**
   * Cria cobrança PIX avulsa.
   */
  async createPixCharge(params: {
    customerName: string
    customerEmail: string
    customerCpfCnpj: string
    amountCents: number
    description: string
    externalReference: string
  }): Promise<{ id: string; pixCode: string; pixQrCodeBase64: string; expiresAt: Date }> {
    const customerId = await findOrCreateCustomer({
      name: params.customerName,
      email: params.customerEmail,
      cpfCnpj: params.customerCpfCnpj,
    })

    const dueDate = todayDateString()

    const payment = await asaasPost<AsaasPayment>("/payments", {
      customer: customerId,
      billingType: "PIX",
      value: params.amountCents / 100,
      dueDate,
      description: params.description,
      externalReference: params.externalReference,
    })

    const qrCode = await asaasGet<AsaasQrCode>(`/payments/${payment.id}/pixQrCode`)

    const expiresAt = qrCode.expirationDate
      ? new Date(qrCode.expirationDate)
      : new Date(`${dueDate}T23:59:59`)

    return {
      id: payment.id,
      pixCode: qrCode.payload,
      pixQrCodeBase64: qrCode.encodedImage,
      expiresAt,
    }
  },

  /**
   * Cria cobrança avulsa com cartão de crédito (produto não-recorrente).
   * Retorna o ID do pagamento no Asaas.
   */
  async createOneTimeCardPayment(params: {
    customerName: string
    customerEmail: string
    customerCpfCnpj: string
    amountCents: number
    description: string
    externalReference: string
    cardToken: string
  }): Promise<{ id: string }> {
    const customerId = await findOrCreateCustomer({
      name: params.customerName,
      email: params.customerEmail,
      cpfCnpj: params.customerCpfCnpj,
    })

    const payment = await asaasPost<AsaasPayment>("/payments", {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: params.amountCents / 100,
      dueDate: todayDateString(),
      description: params.description,
      externalReference: params.externalReference,
      creditCardToken: params.cardToken,
    })

    return { id: payment.id }
  },

  /**
   * Cria assinatura recorrente (cartão de crédito).
   */
  async createSubscription(params: {
    customerName: string
    customerEmail: string
    customerCpfCnpj: string
    amountCents: number
    billingType: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"
    description: string
    externalReference: string
    cardToken?: string
  }): Promise<{ id: string; paymentUrl: string }> {
    const customerId = await findOrCreateCustomer({
      name: params.customerName,
      email: params.customerEmail,
      cpfCnpj: params.customerCpfCnpj,
    })

    const ASAAS_CYCLE: Record<string, string> = {
      WEEKLY:     "WEEKLY",
      MONTHLY:    "MONTHLY",
      QUARTERLY:  "QUARTERLY",
      SEMIANNUAL: "SEMIANNUALLY",
      ANNUAL:     "YEARLY",
    }

    const subscription = await asaasPost<AsaasSubscription>("/subscriptions", {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: params.amountCents / 100,
      nextDueDate: todayDateString(),
      cycle: ASAAS_CYCLE[params.billingType] ?? "MONTHLY",
      description: params.description,
      externalReference: params.externalReference,
      ...(params.cardToken ? { creditCardToken: params.cardToken } : {}),
    })

    return { id: subscription.id, paymentUrl: subscription.url ?? "" }
  },

  /**
   * Cancela uma assinatura recorrente no Asaas.
   */
  async cancelSubscription(gatewayId: string): Promise<void> {
    await asaasDelete(`/subscriptions/${gatewayId}`)
  },

  /**
   * Reembolsa um pagamento avulso no Asaas.
   */
  async refundPayment(gatewayId: string): Promise<void> {
    await asaasRequest("POST", `/payments/${gatewayId}/refund`)
  },

  /**
   * Retorna o saldo atual da conta Asaas da plataforma.
   */
  async getPlatformBalance(): Promise<{ totalCents: number; availableCents: number }> {
    const res = await asaasGet<{ balance?: number; totalBalance?: number; availableBalance?: number }>("/finance/balance")
    const total     = res.totalBalance     ?? res.balance ?? 0
    const available = res.availableBalance ?? res.balance ?? 0
    return {
      totalCents:     Math.round(total     * 100),
      availableCents: Math.round(available * 100),
    }
  },

  /**
   * Valida e parseia um evento de webhook do Asaas.
   *
   * Asaas envia o token configurado no header `asaas-access-token`.
   * Comparamos com GATEWAY_WEBHOOK_SECRET usando hash SHA-256
   * para garantir constant-time comparison sem vazar o comprimento.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    const secret = process.env.GATEWAY_WEBHOOK_SECRET || process.env.APP_GATEWAY_WEBHOOK_SECRET
    if (!secret) throw new Error("GATEWAY_WEBHOOK_SECRET não configurado")

    // Hash both values so timingSafeEqual compares fixed-length digests
    const hash = (s: string) => crypto.createHash("sha256").update(s).digest()
    const valid = crypto.timingSafeEqual(hash(signature), hash(secret))

    if (!valid) throw new Error("Assinatura de webhook inválida")

    const body = payload as AsaasWebhookPayload

    const payment = body.payment
    if (!payment) return { type: "UNKNOWN", saleId: "", gatewayId: "", subscriptionId: null, paymentMethod: null }

    const methodMap: Record<string, "PIX" | "CREDIT_CARD"> = {
      PIX: "PIX",
      CREDIT_CARD: "CREDIT_CARD",
    }
    const paymentMethod = methodMap[payment.billingType] ?? null

    const typeMap: Record<string, WebhookEventType> = {
      PAYMENT_CONFIRMED:          "PAYMENT_CONFIRMED",
      PAYMENT_RECEIVED:           "PAYMENT_CONFIRMED", // PIX usa RECEIVED
      PAYMENT_REFUSED:            "PAYMENT_REFUSED",
      PAYMENT_OVERDUE:            "PAYMENT_OVERDUE",   // PIX venceu sem pagamento
      PAYMENT_REFUNDED:           "PAYMENT_REFUNDED",
      PAYMENT_PARTIALLY_REFUNDED: "PAYMENT_REFUNDED",  // trata como reembolso total no saldo
    }

    return {
      type: typeMap[body.event] ?? "UNKNOWN",
      saleId: payment.externalReference,
      gatewayId: payment.id,
      subscriptionId: payment.subscription ?? null,
      paymentMethod,
    }
  },
}
