"use client"

import { memo } from "react"
import { Handle, Position, NodeProps } from "@xyflow/react"
import { Zap, MessageSquare, Clock, CreditCard } from "lucide-react"

// ─── Shared handle style ──────────────────────────────────────────────────────

const handleStyle =
  "!w-3 !h-3 !border-2 !border-white !rounded-full"

// ─── StartNode ────────────────────────────────────────────────────────────────

export const StartNode = memo(function StartNode({ selected }: NodeProps) {
  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-md min-w-[180px] transition-colors ${
        selected ? "border-emerald-500" : "border-emerald-300"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-t-xl border-b border-emerald-200">
        <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-emerald-800">Início</span>
        <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
          /start
        </span>
      </div>
      <div className="px-4 py-2">
        <p className="text-xs text-gray-500">Ponto de entrada do bot</p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${handleStyle} !bg-emerald-500`}
      />
    </div>
  )
})

// ─── MessageNode ──────────────────────────────────────────────────────────────

export const MessageNode = memo(function MessageNode({
  data,
  selected,
}: NodeProps) {
  const text = (data as { text?: string }).text ?? ""
  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-md min-w-[200px] max-w-[260px] transition-colors ${
        selected ? "border-blue-500" : "border-blue-200"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-t-xl border-b border-blue-100">
        <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-800">Mensagem</span>
      </div>
      <div className="px-4 py-2">
        <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap break-words">
          {text || <span className="italic text-gray-400">Sem texto configurado</span>}
        </p>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleStyle} !bg-blue-400`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${handleStyle} !bg-blue-500`}
      />
    </div>
  )
})

// ─── DelayNode ────────────────────────────────────────────────────────────────

export const DelayNode = memo(function DelayNode({
  data,
  selected,
}: NodeProps) {
  const amount = (data as { amount?: number }).amount ?? 1
  const unit = (data as { unit?: string }).unit ?? "hours"
  const unitLabel = unit === "minutes" ? "min" : unit === "hours" ? "h" : "d"
  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-md min-w-[180px] transition-colors ${
        selected ? "border-amber-500" : "border-amber-200"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-t-xl border-b border-amber-100">
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-800">Aguardar</span>
      </div>
      <div className="px-4 py-2">
        <p className="text-xs text-gray-600">
          Esperar{" "}
          <span className="font-semibold text-amber-700">
            {amount} {unitLabel}
          </span>{" "}
          antes de continuar
        </p>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleStyle} !bg-amber-400`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${handleStyle} !bg-amber-500`}
      />
    </div>
  )
})

// ─── PaymentNode ──────────────────────────────────────────────────────────────

export const PaymentNode = memo(function PaymentNode({
  data,
  selected,
}: NodeProps) {
  const productName = (data as { productName?: string }).productName ?? ""
  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-md min-w-[200px] transition-colors ${
        selected ? "border-violet-500" : "border-violet-200"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 rounded-t-xl border-b border-violet-100">
        <CreditCard className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-sm font-semibold text-violet-800">Pagamento</span>
      </div>
      <div className="px-4 py-2">
        <p className="text-xs text-gray-600">
          {productName ? (
            <>
              Produto:{" "}
              <span className="font-medium text-violet-700">{productName}</span>
            </>
          ) : (
            <span className="italic text-gray-400">Nenhum produto selecionado</span>
          )}
        </p>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleStyle} !bg-violet-400`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="approved"
        style={{ left: "35%" }}
        className={`${handleStyle} !bg-green-500`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="refused"
        style={{ left: "65%" }}
        className={`${handleStyle} !bg-red-400`}
      />
      <div className="flex justify-between px-4 pb-2 mt-1">
        <span className="text-[10px] text-green-600 font-medium" style={{ marginLeft: "-4px" }}>
          Aprovado
        </span>
        <span className="text-[10px] text-red-500 font-medium" style={{ marginRight: "-4px" }}>
          Recusado
        </span>
      </div>
    </div>
  )
})
