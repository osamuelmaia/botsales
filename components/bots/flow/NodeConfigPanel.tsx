"use client"

import { useState, useEffect } from "react"
import { Node } from "@xyflow/react"
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface Product {
  id: string
  name: string
  priceInCents: number
}

interface NodeConfigPanelProps {
  node: Node
  botId: string
  botName: string
  products: Product[]
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

const inputCls =
  "w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

const labelCls = "block text-xs font-medium text-gray-600 mb-1"

export function NodeConfigPanel({
  node,
  botId,
  botName,
  products,
  onUpdate,
  onClose,
}: NodeConfigPanelProps) {
  const data = node.data as Record<string, unknown>

  // Start node state
  const [channelIdStart, setChannelIdStart] = useState(String(data.channelId ?? ""))
  const [validatingChannel, setValidatingChannel] = useState(false)
  const [channelValid, setChannelValid] = useState<boolean | null>(
    data.channelId ? true : null
  )
  const [channelError, setChannelError] = useState("")
  const [chatTitle, setChatTitle] = useState(String(data.chatTitle ?? ""))

  // Message node state
  const [text, setText] = useState(String(data.text ?? ""))

  // Delay node state
  const [amount, setAmount] = useState(Number(data.amount ?? 1))
  const [unit, setUnit] = useState(String(data.unit ?? "hours"))

  // Payment node state
  const [productId, setProductId] = useState(String(data.productId ?? ""))

  // Keep local state in sync when node changes
  useEffect(() => {
    const d = node.data as Record<string, unknown>
    setChannelIdStart(String(d.channelId ?? ""))
    setChannelValid(d.channelId ? true : null)
    setChatTitle(String(d.chatTitle ?? ""))
    setChannelError("")
    setText(String(d.text ?? ""))
    setAmount(Number(d.amount ?? 1))
    setUnit(String(d.unit ?? "hours"))
    setProductId(String(d.productId ?? ""))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function validateChannel() {
    if (!channelIdStart.trim()) return
    setValidatingChannel(true)
    setChannelError("")
    setChannelValid(null)
    try {
      const res = await fetch(`/api/bots/${botId}/validate-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channelIdStart.trim() }),
      })
      const json = await res.json()
      if (json.valid) {
        setChannelValid(true)
        setChatTitle(json.chatTitle ?? channelIdStart.trim())
        onUpdate(node.id, {
          channelId: channelIdStart.trim(),
          chatTitle: json.chatTitle ?? channelIdStart.trim(),
          botName,
        })
      } else {
        setChannelValid(false)
        setChannelError(json.error ?? "Grupo inválido")
      }
    } catch {
      setChannelValid(false)
      setChannelError("Erro ao validar grupo")
    } finally {
      setValidatingChannel(false)
    }
  }

  function save() {
    if (node.type === "message") {
      onUpdate(node.id, { text })
    } else if (node.type === "delay") {
      onUpdate(node.id, { amount, unit })
    } else if (node.type === "payment") {
      const product = products.find((p) => p.id === productId)
      onUpdate(node.id, {
        productId,
        productName: product?.name ?? "",
      })
    }
    onClose()
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          {node.type === "start" && "Nó de Início"}
          {node.type === "message" && "Configurar Mensagem"}
          {node.type === "delay" && "Configurar Aguardar"}
          {node.type === "payment" && "Configurar Pagamento"}
        </h3>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Start node */}
        {node.type === "start" && (
          <div className="space-y-4">
            {/* Bot info */}
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-xs text-gray-500 mb-0.5">Bot vinculado</p>
              <p className="text-sm font-semibold text-gray-900">{botName}</p>
            </div>

            {/* Group ID */}
            <div>
              <label className={labelCls}>
                ID do Grupo/Canal{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={channelIdStart}
                  onChange={(e) => {
                    setChannelIdStart(e.target.value)
                    setChannelValid(null)
                    setChannelError("")
                  }}
                  className={inputCls}
                  placeholder="-100123456789"
                />
                <button
                  type="button"
                  onClick={validateChannel}
                  disabled={validatingChannel || !channelIdStart.trim()}
                  className="h-9 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0"
                >
                  {validatingChannel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Validar"
                  )}
                </button>
              </div>

              {/* Validation feedback */}
              {channelValid === true && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">
                    {chatTitle || channelIdStart} — bot é admin ✓
                  </p>
                </div>
              )}
              {channelValid === false && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{channelError}</p>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-1.5">
                O bot deve ser administrador com permissão para banir membros.
                Copie o ID do grupo no Telegram (ex: <code className="bg-gray-100 px-0.5 rounded">-100...</code>).
              </p>
            </div>
          </div>
        )}

        {/* Message node */}
        {node.type === "message" && (
          <div>
            <label className={labelCls}>Texto da mensagem</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              placeholder="Digite a mensagem que o bot vai enviar..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Suporta Markdown do Telegram: *negrito*, _itálico_, `código`
            </p>
          </div>
        )}

        {/* Delay node */}
        {node.type === "delay" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Tempo de espera</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className={inputCls + " w-24"}
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                >
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              O bot aguardará esse tempo antes de continuar para o próximo nó.
            </p>
          </div>
        )}

        {/* Payment node */}
        {node.type === "payment" && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Produto</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Selecione um produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R${" "}
                    {(p.priceInCents / 100).toFixed(2).replace(".", ",")}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Após aprovação, o cliente recebe acesso ao grupo configurado no nó de Início.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {node.type !== "start" && (
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={save}
            className="w-full h-9 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
      {node.type === "start" && (
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={!channelValid}
            className="w-full h-9 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {channelValid ? "Confirmar" : "Valide o grupo para continuar"}
          </button>
        </div>
      )}
    </div>
  )
}
