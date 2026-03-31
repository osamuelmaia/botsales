"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2, Copy, Check, CreditCard, QrCode, AlertCircle, ChevronRight,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductData {
  id: string
  name: string
  description: string | null
  priceInCents: number
  paymentMethods: string[]
  isRecurring: boolean
  billingType: string | null
  billingCycles: number | null
  sellerName: string
}

type Step = "form" | "pix-waiting" | "card-processing"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function formatPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim()
}

function formatExpiry(v: string) {
  return v.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2")
}

const inputCls =
  "w-full h-11 rounded-lg border border-gray-300 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { productId } = useParams<{ productId: string }>()
  const router = useRouter()

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Step state
  const [step, setStep] = useState<Step>("form")
  const [selectedMethod, setSelectedMethod] = useState<"PIX" | "CREDIT_CARD">("PIX")

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")

  // Card fields
  const [cardHolder, setCardHolder] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [cardPostalCode, setCardPostalCode] = useState("")

  // PIX state
  const [pixCode, setPixCode] = useState("")
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("")
  const [saleId, setSaleId] = useState("")
  const [pixCopied, setPixCopied] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load product ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/checkout/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setNotFound(true); return }
        setProduct(data)
        const methods: string[] = data.paymentMethods
        if (methods.length === 1) setSelectedMethod(methods[0] as "PIX" | "CREDIT_CARD")
        else setSelectedMethod("PIX")
      })
      .finally(() => setLoadingProduct(false))
  }, [productId])

  // ── PIX polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== "pix-waiting" || !saleId) return

    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/checkout/status/${saleId}`)
      const json = await res.json()
      if (json.status === "APPROVED") {
        clearInterval(pollingRef.current!)
        router.push(`/checkout/${productId}/sucesso`)
      } else if (json.status === "REFUSED") {
        clearInterval(pollingRef.current!)
        setStep("form")
        setError("Pagamento não foi aprovado. Tente novamente.")
      }
    }, 3000)

    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [step, saleId, productId, router])

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    const expiryParts = cardExpiry.split("/")
    const body = {
      method: selectedMethod,
      name,
      email,
      cpf: cpf.replace(/\D/g, ""),
      phone: phone.replace(/\D/g, ""),
      ...(selectedMethod === "CREDIT_CARD" && {
        cardHolderName: cardHolder,
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardExpiryMonth: expiryParts[0],
        cardExpiryYear: expiryParts[1],
        cardCvv,
        cardPostalCode: cardPostalCode.replace(/\D/g, ""),
      }),
    }

    const res = await fetch(`/api/checkout/${productId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error ?? "Erro ao processar pagamento")
      return
    }

    if (selectedMethod === "PIX") {
      setPixCode(json.pixCode)
      setPixQrCodeBase64(json.pixQrCodeBase64)
      setSaleId(json.saleId)
      setStep("pix-waiting")
    } else {
      router.push(`/checkout/${productId}/sucesso`)
    }
  }

  function copyPixCode() {
    navigator.clipboard.writeText(pixCode)
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
  }

  // ── Loading / Not found ────────────────────────────────────────────────────

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Produto não encontrado</h2>
        <p className="text-sm text-gray-500">O link que você acessou é inválido ou expirou.</p>
      </div>
    )
  }

  const hasBothMethods =
    product.paymentMethods.includes("PIX") && product.paymentMethods.includes("CREDIT_CARD")

  // ── PIX waiting screen ─────────────────────────────────────────────────────

  if (step === "pix-waiting") {
    return (
      <div className="space-y-4">
        {/* Product summary */}
        <ProductSummary product={product} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-base font-semibold text-gray-900">Pague com PIX</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Escaneie o QR Code ou copie o código abaixo
            </p>
          </div>

          {/* QR Code */}
          {pixQrCodeBase64 ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pixQrCodeBase64}`}
                alt="QR Code PIX"
                className="w-52 h-52 rounded-xl border border-gray-100"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-52 h-52 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                <QrCode className="h-8 w-8 text-gray-300" />
              </div>
            </div>
          )}

          {/* Copy code */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center font-medium uppercase tracking-wide">
              PIX Copia e Cola
            </p>
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 font-mono break-all leading-relaxed">
              {pixCode}
            </div>
            <button
              onClick={copyPixCode}
              className={`w-full h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                pixCopied
                  ? "bg-green-600 text-white"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {pixCopied ? (
                <><Check className="h-4 w-4" /> Copiado!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copiar código</>
              )}
            </button>
          </div>

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 py-1">
            <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
            <p className="text-sm text-amber-700 font-medium">Aguardando confirmação do pagamento...</p>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Após pagar, a confirmação é automática. Não feche esta página.
          </p>
        </div>
      </div>
    )
  }

  // ── Checkout form ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Product summary */}
      <ProductSummary product={product} />

      {/* Form card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Personal info */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Seus dados</h2>

          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            className={inputCls}
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className={inputCls}
          />
          <input
            required
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="CPF"
            inputMode="numeric"
            className={inputCls}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="Telefone (opcional)"
            inputMode="numeric"
            className={inputCls}
          />
        </div>

        {/* Payment method */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Forma de pagamento</h2>

          {hasBothMethods && (
            <div className="grid grid-cols-2 gap-2">
              <MethodButton
                active={selectedMethod === "PIX"}
                onClick={() => setSelectedMethod("PIX")}
                icon={<QrCode className="h-4 w-4" />}
                label="PIX"
              />
              <MethodButton
                active={selectedMethod === "CREDIT_CARD"}
                onClick={() => setSelectedMethod("CREDIT_CARD")}
                icon={<CreditCard className="h-4 w-4" />}
                label="Cartão"
              />
            </div>
          )}

          {/* PIX info */}
          {selectedMethod === "PIX" && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <QrCode className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Pague com PIX</p>
                <p className="text-xs text-green-700 mt-0.5">
                  QR Code gerado instantaneamente após confirmação.
                  Aprovação em segundos.
                </p>
              </div>
            </div>
          )}

          {/* Card form */}
          {selectedMethod === "CREDIT_CARD" && (
            <div className="space-y-3">
              <input
                required={selectedMethod === "CREDIT_CARD"}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                placeholder="Número do cartão"
                inputMode="numeric"
                className={inputCls + " tracking-widest"} style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              />
              <input
                required={selectedMethod === "CREDIT_CARD"}
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                placeholder="Nome no cartão"
                className={inputCls + " uppercase"}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required={selectedMethod === "CREDIT_CARD"}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="Validade (MM/AA)"
                  inputMode="numeric"
                  className={inputCls}
                />
                <input
                  required={selectedMethod === "CREDIT_CARD"}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="CVV"
                  inputMode="numeric"
                  type="password"
                  className={inputCls}
                />
              </div>
              <input
                required={selectedMethod === "CREDIT_CARD"}
                value={cardPostalCode}
                onChange={(e) =>
                  setCardPostalCode(
                    e.target.value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2")
                  )
                }
                placeholder="CEP do titular"
                inputMode="numeric"
                className={inputCls}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
          ) : selectedMethod === "PIX" ? (
            <><QrCode className="h-4 w-4" /> Gerar QR Code — {formatPrice(product.priceInCents)}</>
          ) : (
            <><ChevronRight className="h-4 w-4" /> Pagar {formatPrice(product.priceInCents)}</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Pagamento processado com segurança pela BotSales.
          Seus dados são criptografados.
        </p>
      </form>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductSummary({ product }: { product: ProductData }) {
  const billingLabel =
    product.isRecurring && product.billingType
      ? product.billingType === "MONTHLY"
        ? "/mês"
        : "/ano"
      : ""

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs text-gray-500 mb-1">Você está comprando</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">
          {(product.priceInCents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>
        {billingLabel && (
          <span className="text-sm text-gray-500">{billingLabel}</span>
        )}
      </div>
    </div>
  )
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 text-gray-600 hover:border-gray-400"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
