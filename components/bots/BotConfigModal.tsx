"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Check, X, AlertCircle, Info,
} from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Checkbox from "@radix-ui/react-checkbox"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"

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

  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [productIds, setProductIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(false)
  const [gracePeriodDays, setGracePeriodDays] = useState(3)

  const [showToken, setShowToken] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" })
  const [saving, setSaving] = useState(false)

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed z-50 right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col focus:outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Configurar Bot
              </Dialog.Title>
              {bot && (
                <Dialog.Description className="text-xs text-gray-500 mt-0.5">
                  {bot.name}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
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

                {/* Dica geral */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Configure aqui o token do bot, os produtos que ele vende e o comportamento de renovação. Após salvar, acesse <strong>Fluxo</strong> para montar as mensagens.
                  </p>
                </div>

                {/* Nome */}
                <Input
                  label="Nome do bot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do bot"
                  required
                />

                {/* Token */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      placeholder="1234567890:AAF..."
                      className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Obtenha em{" "}
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 font-medium">
                      @BotFather
                    </a>{" "}
                    no Telegram → /newbot → copie o token gerado.
                  </p>
                  {validation.status === "valid" && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <p className="text-xs text-emerald-700">
                        Token válido — bot: <strong>{validation.botName}</strong>
                      </p>
                    </div>
                  )}
                  {validation.status === "invalid" && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      <p className="text-xs text-red-600">{validation.error}</p>
                    </div>
                  )}
                </div>

                {/* Produtos */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">
                      Produtos vinculados
                    </label>
                    <span className="text-xs font-medium text-gray-500 tabular-nums">
                      {productIds.length}/3
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                    O bot apresenta estes produtos no fluxo de vendas. Selecione até 3.
                  </p>

                  {products.length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg py-6 px-4 text-center">
                      <p className="text-sm text-gray-500">
                        Nenhum produto cadastrado.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push("/products")}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500 mt-1 transition-colors"
                      >
                        Criar produto →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {products.map((product) => {
                        const selected = productIds.includes(product.id)
                        const disabled = !selected && productIds.length >= 3
                        return (
                          <label
                            key={product.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              selected && "border-blue-500 bg-blue-50",
                              !selected && !disabled && "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                              disabled && "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed",
                            )}
                          >
                            <Checkbox.Root
                              checked={selected}
                              disabled={disabled}
                              onCheckedChange={() => toggleProduct(product.id)}
                              className="h-[18px] w-[18px] shrink-0 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex items-center justify-center disabled:opacity-50 transition-colors"
                            >
                              <Checkbox.Indicator>
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              </Checkbox.Indicator>
                            </Checkbox.Root>
                            <p className="text-sm font-medium text-gray-900 flex-1 truncate">
                              {product.name}
                            </p>
                            <span className="text-sm text-gray-500 shrink-0 tabular-nums">
                              R$ {formatPrice(product.priceInCents)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {productIds.length >= 3 && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Máximo de 3 produtos por bot atingido.
                    </div>
                  )}
                </div>

                {/* Período de carência */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Período de carência
                  </label>
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                    Quando uma renovação é recusada, o bot envia o fluxo de remarketing e aguarda este período antes de remover o assinante do grupo. <span className="text-gray-400">0 dias = remoção imediata.</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                      className="w-20 h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors tabular-nums"
                    />
                    <span className="text-sm text-gray-600">
                      {gracePeriodDays === 0 ? "Remoção imediata" : `${gracePeriodDays} dia${gracePeriodDays !== 1 ? "s" : ""} de carência`}
                    </span>
                  </div>
                </div>

                {/* Ativo */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Bot ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Quando ativo, o bot responde automaticamente no Telegram e processa vendas. Desative para pausar sem excluir.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive((v) => !v)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 shrink-0",
                      isActive
                        ? "bg-blue-600 focus:ring-blue-500/30"
                        : "bg-gray-300 focus:ring-gray-400/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        isActive ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

              </form>
            )}
          </div>

          {/* Footer */}
          {!loadingData && (
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              <Button
                type="submit"
                form="bot-config-form"
                fullWidth
                loading={saving || validation.status === "loading"}
                disabled={saving || validation.status === "loading"}
              >
                {validation.status === "loading"
                  ? "Validando token..."
                  : saving
                  ? "Salvando..."
                  : "Validar e Salvar"}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
