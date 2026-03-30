"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
} from "lucide-react"
import * as Checkbox from "@radix-ui/react-checkbox"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotDetail {
  id: string
  name: string
  token: string
  channelId: string | null
  isActive: boolean
  productIds: string[]
}

interface ProductItem {
  id: string
  name: string
  priceInCents: number
}

type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; botName: string }
  | { status: "invalid"; error: string }

// ─── Price formatter ──────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotConfigPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [bot, setBot] = useState<BotDetail | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [channelId, setChannelId] = useState("")
  const [productIds, setProductIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(false)

  const [showToken, setShowToken] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" })
  const [saving, setSaving] = useState(false)

  // ─── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch(`/api/bots/${id}`).then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([botData, productsData]) => {
        if (botData.error) {
          setNotFound(true)
          return
        }
        setBot(botData)
        setName(botData.name)
        setToken(botData.token)
        setChannelId(botData.channelId ?? "")
        setProductIds(botData.productIds)
        setIsActive(botData.isActive)

        if (Array.isArray(productsData)) {
          setProducts(productsData)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function toggleProduct(productId: string) {
    setProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((p) => p !== productId)
      }
      if (prev.length >= 3) return prev
      return [...prev, productId]
    })
  }

  async function handleValidateAndSave(e: React.FormEvent) {
    e.preventDefault()

    // 1. Validate token
    setValidation({ status: "loading" })

    const valRes = await fetch(`/api/bots/${id}/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const valJson = await valRes.json()

    if (!valJson.valid) {
      setValidation({ status: "invalid", error: valJson.error ?? "Token inválido" })
      return
    }

    setValidation({ status: "valid", botName: valJson.botName })

    // 2. Save
    setSaving(true)

    const res = await fetch(`/api/bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        token,
        channelId: channelId || undefined,
        productIds,
        isActive,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar bot")
      return
    }

    toast.success("Bot salvo com sucesso!")
    router.push("/dashboard/bots")
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (notFound || !bot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Bot não encontrado.</p>
        <button
          onClick={() => router.push("/dashboard/bots")}
          className="text-sm text-gray-700 underline"
        >
          Voltar para bots
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/dashboard/bots")}
          className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurar Bot</h1>
          <p className="text-sm text-gray-500">{bot.name}</p>
        </div>
      </div>

      <form onSubmit={handleValidateAndSave} className="space-y-6">
        {/* ── Informações básicas ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Informações básicas
          </h2>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do bot
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Nome do bot"
            />
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token do Telegram
            </label>
            <div className="relative">
              <input
                value={token}
                onChange={(e) => {
                  setToken(e.target.value)
                  setValidation({ status: "idle" })
                }}
                required
                type={showToken ? "text" : "password"}
                className="w-full h-10 rounded-md border border-gray-300 px-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono"
                placeholder="1234567890:AAF..."
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Validation feedback */}
            {validation.status === "valid" && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <p className="text-xs text-green-600">
                  Token válido — bot: <strong>{validation.botName}</strong>
                </p>
              </div>
            )}
            {validation.status === "invalid" && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
                <p className="text-xs text-red-500">{validation.error}</p>
              </div>
            )}
          </div>

          {/* Channel ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID do canal{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Ex: -1001234567890"
            />
            <p className="text-xs text-gray-400 mt-1">
              Canal no Telegram onde leads serão redirecionados após a compra.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Bot ativo</p>
              <p className="text-xs text-gray-400">
                Ative para que o bot comece a responder usuários no Telegram.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 ${
                isActive ? "bg-gray-900" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* ── Produtos vinculados ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Produtos vinculados
            </h2>
            <span className="text-xs text-gray-400">{productIds.length}/3 selecionados</span>
          </div>

          {products.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400">
                Nenhum produto cadastrado.{" "}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/products")}
                  className="text-gray-700 underline"
                >
                  Criar produto
                </button>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {products.map((product) => {
                const selected = productIds.includes(product.id)
                const disabled = !selected && productIds.length >= 3
                return (
                  <label
                    key={product.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? "border-gray-900 bg-gray-50"
                        : disabled
                        ? "border-gray-100 opacity-50 cursor-not-allowed"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Checkbox.Root
                      checked={selected}
                      disabled={disabled}
                      onCheckedChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 shrink-0 rounded border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center disabled:opacity-50"
                    >
                      <Checkbox.Indicator>
                        <Check className="h-3 w-3 text-white" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500 shrink-0">
                      R$ {formatPrice(product.priceInCents)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {productIds.length >= 3 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
              Máximo de 3 produtos por bot atingido.
            </p>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={saving || validation.status === "loading"}
          className="w-full h-11 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {(saving || validation.status === "loading") && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {validation.status === "loading"
            ? "Validando token..."
            : saving
            ? "Salvando..."
            : "Validar e Salvar"}
        </button>
      </form>
    </div>
  )
}
