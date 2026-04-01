"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Check,
} from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Checkbox from "@radix-ui/react-checkbox"
import { useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotDetail {
  id: string
  name: string
  token: string
  isActive: boolean
  gracePeriodDays: number
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

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── BotConfigModal ───────────────────────────────────────────────────────────

interface Props {
  botId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function BotConfigModal({ botId, open, onOpenChange, onSaved }: Props) {
  const router = useRouter()
  const [loadingData, setLoadingData] = useState(true)
  const [bot, setBot] = useState<BotDetail | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])

  // Form state
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [productIds, setProductIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(false)
  const [gracePeriodDays, setGracePeriodDays] = useState(3)

  const [showToken, setShowToken] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" })
  const [saving, setSaving] = useState(false)

  // ─── Load when opened ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setLoadingData(true)
    setValidation({ status: "idle" })
    setShowToken(false)

    Promise.all([
      fetch(`/api/bots/${botId}`).then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([botData, productsData]) => {
        setBot(botData)
        setName(botData.name)
        setToken(botData.token)
        setProductIds(botData.productIds)
        setIsActive(botData.isActive)
        setGracePeriodDays(botData.gracePeriodDays ?? 3)
        if (Array.isArray(productsData)) setProducts(productsData)
      })
      .finally(() => setLoadingData(false))
  }, [open, botId])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function toggleProduct(productId: string) {
    setProductIds((prev) => {
      if (prev.includes(productId)) return prev.filter((p) => p !== productId)
      if (prev.length >= 3) return prev
      return [...prev, productId]
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setValidation({ status: "loading" })

    const valRes = await fetch(`/api/bots/${botId}/validate-token`, {
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

    setSaving(true)
    const res = await fetch(`/api/bots/${botId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token, productIds, isActive, gracePeriodDays }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar bot")
      return
    }

    toast.success("Bot salvo com sucesso!")
    onOpenChange(false)
    onSaved()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const inputCls =
    "w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Configurar Bot
              </Dialog.Title>
              {bot && (
                <Dialog.Description className="text-xs text-gray-400 mt-0.5">
                  {bot.name}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">
              ×
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingData ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <form id="bot-config-form" onSubmit={handleSave} className="space-y-5">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do bot
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputCls}
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
                      className={inputCls + " pr-10 font-mono"}
                      placeholder="1234567890:AAF..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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

                {/* Produtos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Produtos vinculados
                    </label>
                    <span className="text-xs text-gray-400">{productIds.length}/3</span>
                  </div>

                  {products.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center">
                      Nenhum produto cadastrado.{" "}
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/products")}
                        className="text-gray-700 underline"
                      >
                        Criar produto
                      </button>
                    </p>
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
                            <p className="text-sm font-medium text-gray-900 flex-1 truncate">
                              {product.name}
                            </p>
                            <span className="text-sm text-gray-500 shrink-0">
                              R$ {formatPrice(product.priceInCents)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {productIds.length >= 3 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md mt-2">
                      Máximo de 3 produtos por bot atingido.
                    </p>
                  )}
                </div>

                {/* Período de carência */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Período de carência (dias)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Tempo que o bot tenta recuperar o assinante antes de removê-lo do grupo quando uma renovação é recusada.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                      className="w-20 h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-500">
                      {gracePeriodDays === 0 ? "Remoção imediata" : `${gracePeriodDays} dia${gracePeriodDays !== 1 ? "s" : ""} de carência`}
                    </span>
                  </div>
                </div>

                {/* Ativo */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Bot ativo</p>
                    <p className="text-xs text-gray-400">
                      Ative para que o bot responda usuários no Telegram.
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

              </form>
            )}
          </div>

          {/* Footer */}
          {!loadingData && (
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                type="submit"
                form="bot-config-form"
                disabled={saving || validation.status === "loading"}
                className="w-full h-10 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
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
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
