"use client"

import { memo } from "react"
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react"
import { Zap, MessageSquare, Clock, CreditCard, X, AlertCircle, CheckCircle2, Image, Type } from "lucide-react"

interface Block {
  id: string
  type: "text" | "image"
  content: string
}

// ─── Shared handle style ──────────────────────────────────────────────────────

const handleStyle =
  "!w-3 !h-3 !border-2 !border-white !rounded-full"

// ─── Delete button ────────────────────────────────────────────────────────────

function DeleteButton({ nodeId }: { nodeId: string }) {
  const { deleteElements } = useReactFlow()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        deleteElements({ nodes: [{ id: nodeId }] })
      }}
      className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-10"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

// ─── StartNode ────────────────────────────────────────────────────────────────

export const StartNode = memo(function StartNode({ data, selected }: NodeProps) {
  const channelId = (data as { channelId?: string; chatTitle?: string; botName?: string }).channelId ?? ""
  const chatTitle = (data as { chatTitle?: string }).chatTitle ?? ""
  const botName = (data as { botName?: string }).botName ?? ""
  const configured = !!channelId.trim()

  return (
    <div
      className={`relative bg-white rounded-xl border-2 shadow-md min-w-[200px] transition-colors ${
        selected
          ? "border-emerald-500"
          : configured
          ? "border-emerald-300"
          : "border-amber-400"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-t-xl border-b border-emerald-200">
        <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-emerald-800">Início</span>
        <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
          /start
        </span>
      </div>

      {/* Bot info */}
      {botName && (
        <div className="px-4 pt-2 pb-0">
          <p className="text-xs text-gray-500">
            Bot: <span className="font-medium text-gray-700">{botName}</span>
          </p>
        </div>
      )}

      {/* Group status */}
      <div className="px-4 py-2">
        {configured ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 font-medium truncate">
              {chatTitle || channelId}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              Configure o grupo/canal
            </p>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={`${handleStyle} !bg-emerald-500`}
      />
    </div>
  )
})

// ─── MessageNode ──────────────────────────────────────────────────────────────

export const MessageNode = memo(function MessageNode({
  id,
  data,
  selected,
}: NodeProps) {
  const blocks = (data as { blocks?: Block[] }).blocks ?? []
  const configured = blocks.some((b) => b.content.trim() !== "")

  return (
    <div
      className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[200px] max-w-[260px] transition-colors ${
        selected ? "border-blue-500" : "border-blue-200"
      }`}
    >
      <DeleteButton nodeId={id} />
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-t-xl border-b border-blue-100">
        <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-800">Mensagem</span>
        <span className="ml-auto text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
          {blocks.length} bloco{blocks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="px-4 py-2 space-y-1">
        {!configured ? (
          <p className="text-xs italic text-gray-400">Sem conteúdo configurado</p>
        ) : (
          blocks.slice(0, 3).map((block) => (
            <div key={block.id} className="flex items-center gap-1.5">
              {block.type === "image" ? (
                <Image className="h-3 w-3 text-blue-400 shrink-0" />
              ) : (
                <Type className="h-3 w-3 text-blue-400 shrink-0" />
              )}
              <p className="text-xs text-gray-600 truncate">
                {block.content || <span className="italic text-gray-400">vazio</span>}
              </p>
            </div>
          ))
        )}
        {blocks.length > 3 && (
          <p className="text-xs text-gray-400">+{blocks.length - 3} mais...</p>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className={`${handleStyle} !bg-blue-400`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`${handleStyle} !bg-blue-500`}
      />
    </div>
  )
})

// ─── DelayNode ────────────────────────────────────────────────────────────────

export const DelayNode = memo(function DelayNode({
  id,
  data,
  selected,
}: NodeProps) {
  const amount = (data as { amount?: number }).amount ?? 1
  const unit = (data as { unit?: string }).unit ?? "seconds"
  const unitLabel = unit === "seconds" ? "s" : unit === "minutes" ? "min" : unit === "hours" ? "h" : "d"
  return (
    <div
      className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[180px] transition-colors ${
        selected ? "border-amber-500" : "border-amber-200"
      }`}
    >
      <DeleteButton nodeId={id} />
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
        position={Position.Left}
        className={`${handleStyle} !bg-amber-400`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`${handleStyle} !bg-amber-500`}
      />
    </div>
  )
})

// ─── PaymentNode ──────────────────────────────────────────────────────────────

export const PaymentNode = memo(function PaymentNode({
  id,
  data,
  selected,
}: NodeProps) {
  const productName = (data as { productName?: string }).productName ?? ""
  return (
    <div
      className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[200px] transition-colors ${
        selected ? "border-violet-500" : "border-violet-200"
      }`}
    >
      <DeleteButton nodeId={id} />
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
      {/* Labels das saídas */}
      <div className="flex flex-col items-end px-4 pb-2 gap-1">
        <span className="text-[10px] text-green-600 font-medium">Aprovado ●</span>
        <span className="text-[10px] text-red-500 font-medium">Recusado ●</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className={`${handleStyle} !bg-violet-400`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="approved"
        style={{ top: "55%" }}
        className={`${handleStyle} !bg-green-500`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="refused"
        style={{ top: "75%" }}
        className={`${handleStyle} !bg-red-400`}
      />
    </div>
  )
})
