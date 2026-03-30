"use client"

import { useState, useEffect } from "react"
import { Node } from "@xyflow/react"
import { X, Loader2 } from "lucide-react"

interface Product {
  id: string
  name: string
  priceInCents: number
}

interface NodeConfigPanelProps {
  node: Node
  products: Product[]
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

const inputCls =
  "w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

const labelCls = "block text-xs font-medium text-gray-600 mb-1"

export function NodeConfigPanel({
  node,
  products,
  onUpdate,
  onClose,
}: NodeConfigPanelProps) {
  const data = node.data as Record<string, unknown>

  // Message node state
  const [text, setText] = useState(String(data.text ?? ""))

  // Delay node state
  const [amount, setAmount] = useState(Number(data.amount ?? 1))
  const [unit, setUnit] = useState(String(data.unit ?? "hours"))

  // Payment node state
  const [productId, setProductId] = useState(String(data.productId ?? ""))
  const [channelId, setChannelId] = useState(String(data.channelId ?? ""))
  const [savingChannel, setSavingChannel] = useState(false)

  // Keep local state in sync when node changes
  useEffect(() => {
    const d = node.data as Record<string, unknown>
    setText(String(d.text ?? ""))
    setAmount(Number(d.amount ?? 1))
    setUnit(String(d.unit ?? "hours"))
    setProductId(String(d.productId ?? ""))
    setChannelId(String(d.channelId ?? ""))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
        channelId: channelId || undefined,
      })
    }
    onClose()
  }

  async function validateAndSaveChannel() {
    if (!channelId.trim()) return
    setSavingChannel(true)
    try {
      // Simple validation — just save it
      const product = products.find((p) => p.id === productId)
      onUpdate(node.id, {
        productId,
        productName: product?.name ?? "",
        channelId: channelId.trim(),
      })
    } finally {
      setSavingChannel(false)
    }
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
        {/* Start node — read only */}
        {node.type === "start" && (
          <div>
            <p className="text-sm text-gray-500">
              Este é o ponto de entrada do bot. Quando um usuário enviar{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">/start</code>,
              o fluxo começa aqui.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Este nó não pode ser removido ou editado.
            </p>
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
            </div>

            <div>
              <label className={labelCls}>
                ID do Grupo/Canal{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className={inputCls}
                  placeholder="-100123456789"
                />
                <button
                  type="button"
                  onClick={validateAndSaveChannel}
                  disabled={savingChannel || !channelId.trim()}
                  className="h-9 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0"
                >
                  {savingChannel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "OK"
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Após pagamento aprovado, o bot liberará acesso ao grupo/canal.
                O bot deve ser administrador com permissão para banir membros.
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
    </div>
  )
}
