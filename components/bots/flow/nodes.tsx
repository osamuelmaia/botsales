"use client"

import { memo, useState, useRef, useLayoutEffect } from "react"
import {
  Handle, Position, NodeProps, useReactFlow, BaseEdge, EdgeLabelRenderer,
  getBezierPath, EdgeProps,
} from "@xyflow/react"
import {
  Zap, Type, Image as ImageIcon, Film, Music, FileText, MoreHorizontal,
  MousePointerClick, Clock, Timer, CreditCard, X, AlertCircle, CheckCircle2, Link2, ArrowRight,
} from "lucide-react"

// ─── DeletableEdge ────────────────────────────────────────────────────────────

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [hovered, setHovered] = useState(false)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: hovered ? "#94a3b8" : "#b1b1b7", strokeWidth: hovered ? 2 : 1.5, transition: "stroke 0.15s" }}
      />
      <path d={edgePath} strokeWidth={20} stroke="transparent" fill="none"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all" }}
          className={`absolute nodrag nopan transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        >
          <button
            className="h-5 w-5 rounded-full bg-white border border-gray-300 text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500 flex items-center justify-center shadow-sm transition-colors"
            onClick={(e) => { e.stopPropagation(); deleteElements({ edges: [{ id }] }) }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const edgeTypes = { deletable: DeletableEdge }

// ─── Shared ──────────────────────────────────────────────────────────────────

const handleStyle = "!w-4 !h-4 !border-2 !border-white !rounded-full"

/**
 * Returns the center-Y of each rowRef relative to the positioned node container.
 * Uses offsetTop (already relative to offsetParent = node root div) for pixel-perfect
 * alignment regardless of borders or scroll position.
 */
function useRowHandleTops(count: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)].slice(0, count)
  const [tops, setTops] = useState<string[]>(Array(count).fill("50%"))

  useLayoutEffect(() => {
    const next = rowRefs.map((r) => {
      if (!r.current) return "50%"
      return `${Math.round(r.current.offsetTop + r.current.offsetHeight / 2)}px`
    })
    setTops((prev) => (prev.join() === next.join() ? prev : next))
  })

  return { containerRef, rowRefs, tops }
}

function DeleteButton({ nodeId }: { nodeId: string }) {
  const { deleteElements } = useReactFlow()
  return (
    <button
      onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id: nodeId }] }) }}
      className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-10"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

function NodeShell({
  id,
  selected,
  borderColor,
  headerBg,
  headerBorder,
  headerTextColor,
  icon,
  label,
  badge,
  children,
  sourceHandleColor,
  targetHandleColor,
  deletable = true,
  sourceOnly = false,
  extraHandles,
}: {
  id: string
  selected: boolean
  borderColor: [string, string]
  headerBg: string
  headerBorder: string
  headerTextColor: string
  icon: React.ReactNode
  label: string
  badge?: React.ReactNode
  children?: React.ReactNode
  sourceHandleColor: string
  targetHandleColor?: string
  deletable?: boolean
  sourceOnly?: boolean
  extraHandles?: React.ReactNode
}) {
  return (
    <div className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[180px] max-w-[260px] transition-colors ${selected ? borderColor[0] : borderColor[1]}`}>
      {deletable && <DeleteButton nodeId={id} />}
      <div className={`flex items-center gap-2 px-4 py-3 ${headerBg} rounded-t-xl border-b ${headerBorder}`}>
        {icon}
        <span className={`text-sm font-semibold ${headerTextColor}`}>{label}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      {children && <div className="px-4 py-2">{children}</div>}
      {!sourceOnly && (
        <Handle type="target" position={Position.Left} className={`${handleStyle} ${targetHandleColor ?? sourceHandleColor}`} />
      )}
      <Handle type="source" position={Position.Right} className={`${handleStyle} ${sourceHandleColor}`} />
      {extraHandles}
    </div>
  )
}

// ─── StartNode ────────────────────────────────────────────────────────────────

export const StartNode = memo(function StartNode({ data, selected }: NodeProps) {
  const d = data as { channelId?: string; chatTitle?: string; botName?: string }
  const configured = !!d.channelId?.trim()
  return (
    <div className={`relative bg-white rounded-xl border-2 shadow-md min-w-[200px] transition-colors ${selected ? "border-emerald-500" : configured ? "border-emerald-300" : "border-amber-400"}`}>
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-t-xl border-b border-emerald-200">
        <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-emerald-800">Início</span>
        <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">/start</span>
      </div>
      {d.botName && (
        <div className="px-4 pt-2 pb-0">
          <p className="text-xs text-gray-500">Bot: <span className="font-medium text-gray-700">{d.botName}</span></p>
        </div>
      )}
      <div className="px-4 py-2">
        {configured ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 font-medium truncate">{d.chatTitle || d.channelId}</p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">Configure o grupo/canal</p>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className={`${handleStyle} !bg-emerald-500`} />
    </div>
  )
})

// ─── TextNode ─────────────────────────────────────────────────────────────────

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps) {
  const content = (data as { content?: string }).content ?? ""
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-blue-500", "border-blue-200"]}
      headerBg="bg-blue-50" headerBorder="border-blue-100" headerTextColor="text-blue-800"
      icon={<Type className="h-4 w-4 text-blue-600 shrink-0" />} label="Texto"
      sourceHandleColor="!bg-blue-500" targetHandleColor="!bg-blue-400">
      <p className="text-xs text-gray-600 line-clamp-3">
        {content.trim() || <span className="italic text-gray-400">Sem conteúdo</span>}
      </p>
    </NodeShell>
  )
})

// ─── ImageNode ────────────────────────────────────────────────────────────────

export const ImageNode = memo(function ImageNode({ id, data, selected }: NodeProps) {
  const d = data as { url?: string; caption?: string }
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-sky-500", "border-sky-200"]}
      headerBg="bg-sky-50" headerBorder="border-sky-100" headerTextColor="text-sky-800"
      icon={<ImageIcon className="h-4 w-4 text-sky-600 shrink-0" />} label="Imagem"
      sourceHandleColor="!bg-sky-500" targetHandleColor="!bg-sky-400">
      {d.url ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3 text-sky-400 shrink-0" />
            <p className="text-xs text-gray-500">Imagem configurada</p>
          </div>
          {d.caption && <p className="text-xs text-gray-600 line-clamp-2">{d.caption}</p>}
        </div>
      ) : (
        <p className="text-xs italic text-gray-400">Nenhuma imagem</p>
      )}
    </NodeShell>
  )
})

// ─── VideoNode ────────────────────────────────────────────────────────────────

export const VideoNode = memo(function VideoNode({ id, data, selected }: NodeProps) {
  const d = data as { url?: string; caption?: string }
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-purple-500", "border-purple-200"]}
      headerBg="bg-purple-50" headerBorder="border-purple-100" headerTextColor="text-purple-800"
      icon={<Film className="h-4 w-4 text-purple-600 shrink-0" />} label="Vídeo"
      sourceHandleColor="!bg-purple-500" targetHandleColor="!bg-purple-400">
      {d.url ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Film className="h-3 w-3 text-purple-400 shrink-0" />
            <p className="text-xs text-gray-500">Vídeo configurado</p>
          </div>
          {d.caption && <p className="text-xs text-gray-600 line-clamp-2">{d.caption}</p>}
        </div>
      ) : (
        <p className="text-xs italic text-gray-400">Nenhum vídeo</p>
      )}
    </NodeShell>
  )
})

// ─── AudioNode ────────────────────────────────────────────────────────────────

export const AudioNode = memo(function AudioNode({ id, data, selected }: NodeProps) {
  const d = data as { url?: string }
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-pink-500", "border-pink-200"]}
      headerBg="bg-pink-50" headerBorder="border-pink-100" headerTextColor="text-pink-800"
      icon={<Music className="h-4 w-4 text-pink-600 shrink-0" />} label="Áudio"
      sourceHandleColor="!bg-pink-500" targetHandleColor="!bg-pink-400">
      {d.url ? (
        <div className="flex items-center gap-1.5">
          <Music className="h-3 w-3 text-pink-400 shrink-0" />
          <p className="text-xs text-gray-500">Áudio configurado</p>
        </div>
      ) : (
        <p className="text-xs italic text-gray-400">Nenhum áudio</p>
      )}
    </NodeShell>
  )
})

// ─── FileNode ─────────────────────────────────────────────────────────────────

export const FileNode = memo(function FileNode({ id, data, selected }: NodeProps) {
  const d = data as { url?: string; caption?: string }
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-slate-500", "border-slate-200"]}
      headerBg="bg-slate-50" headerBorder="border-slate-100" headerTextColor="text-slate-800"
      icon={<FileText className="h-4 w-4 text-slate-600 shrink-0" />} label="Arquivo"
      sourceHandleColor="!bg-slate-500" targetHandleColor="!bg-slate-400">
      {d.url ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-slate-400 shrink-0" />
            <p className="text-xs text-gray-500">Arquivo configurado</p>
          </div>
          {d.caption && <p className="text-xs text-gray-600 line-clamp-2">{d.caption}</p>}
        </div>
      ) : (
        <p className="text-xs italic text-gray-400">Nenhum arquivo</p>
      )}
    </NodeShell>
  )
})

// ─── TypingNode ───────────────────────────────────────────────────────────────

export const TypingNode = memo(function TypingNode({ id, data, selected }: NodeProps) {
  const d = data as { duration?: number; unit?: string }
  const duration = d.duration ?? 3
  const unitLabel = (d.unit ?? "seconds") === "seconds" ? "s" : "min"
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-teal-500", "border-teal-200"]}
      headerBg="bg-teal-50" headerBorder="border-teal-100" headerTextColor="text-teal-800"
      icon={<MoreHorizontal className="h-4 w-4 text-teal-600 shrink-0" />} label="Digitando..."
      sourceHandleColor="!bg-teal-500" targetHandleColor="!bg-teal-400">
      <p className="text-xs text-gray-600">
        Exibir por <span className="font-semibold text-teal-700">{duration} {unitLabel}</span>
      </p>
    </NodeShell>
  )
})

// ─── ButtonNode ───────────────────────────────────────────────────────────────

interface ButtonItem { id: string; label: string; mode: "url" | "flow"; url: string }

export const ButtonNode = memo(function ButtonNode({ id, data, selected }: NodeProps) {
  const d = data as { buttons?: ButtonItem[] }
  const buttons: ButtonItem[] = d.buttons ?? []
  const flowButtons = buttons.filter((b) => b.mode === "flow")
  const hasFlowButtons = flowButtons.length > 0
  const { containerRef, rowRefs, tops } = useRowHandleTops(flowButtons.length)

  // map each flow button id → its index among flow buttons (for ref assignment)
  const flowIdxMap = new Map(flowButtons.map((b, i) => [b.id, i]))

  return (
    <div ref={containerRef} className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[200px] max-w-[260px] transition-colors ${selected ? "border-indigo-500" : "border-indigo-200"}`}>
      <DeleteButton nodeId={id} />
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-t-xl border-b border-indigo-100">
        <MousePointerClick className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="text-sm font-semibold text-indigo-800">Botão</span>
        {buttons.length > 0 && (
          <span className="ml-auto text-xs text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded font-medium">{buttons.length}</span>
        )}
      </div>

      {/* Button chips — flow buttons get a rowRef so handles align with them */}
      <div className="px-3 py-2 space-y-1.5">
        {buttons.length === 0 ? (
          <p className="text-xs italic text-gray-400">Nenhum botão configurado</p>
        ) : (
          buttons.map((btn) => {
            const fi = flowIdxMap.get(btn.id)
            return (
              <div
                key={btn.id}
                ref={fi !== undefined ? rowRefs[fi] : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border text-xs font-medium ${
                  btn.mode === "flow"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-indigo-300 text-indigo-700"
                }`}
              >
                {btn.mode === "url"
                  ? <Link2 className="h-3 w-3 shrink-0 opacity-70" />
                  : <ArrowRight className="h-3 w-3 shrink-0 opacity-80" />}
                <span className="truncate">{btn.label || <span className="italic opacity-60">sem texto</span>}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Target handle */}
      <Handle type="target" position={Position.Left} className={`${handleStyle} !bg-indigo-400`} />

      {/* Source handles aligned to each flow-button chip row */}
      {hasFlowButtons
        ? flowButtons.map((btn, i) => (
            <Handle key={btn.id} type="source" position={Position.Right} id={btn.id}
              className={`${handleStyle} !bg-indigo-500`}
              style={{ top: tops[i], bottom: "auto" }} />
          ))
        : <Handle type="source" position={Position.Right} className={`${handleStyle} !bg-indigo-500`} />
      }
    </div>
  )
})

// ─── DelayNode ────────────────────────────────────────────────────────────────

export const DelayNode = memo(function DelayNode({ id, data, selected }: NodeProps) {
  const d = data as { amount?: number; unit?: string }
  const amount = d.amount ?? 5
  const unit = d.unit ?? "seconds"
  const unitLabel = unit === "seconds" ? "s" : unit === "minutes" ? "min" : unit === "hours" ? "h" : "d"
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-amber-500", "border-amber-200"]}
      headerBg="bg-amber-50" headerBorder="border-amber-100" headerTextColor="text-amber-800"
      icon={<Clock className="h-4 w-4 text-amber-600 shrink-0" />} label="Atraso"
      sourceHandleColor="!bg-amber-500" targetHandleColor="!bg-amber-400">
      <p className="text-xs text-gray-600">
        Esperar <span className="font-semibold text-amber-700">{amount} {unitLabel}</span>
      </p>
    </NodeShell>
  )
})

// ─── SmartDelayNode ───────────────────────────────────────────────────────────

export const SmartDelayNode = memo(function SmartDelayNode({ id, data, selected }: NodeProps) {
  const d = data as { minAmount?: number; maxAmount?: number; unit?: string; showTyping?: boolean }
  const min = d.minAmount ?? 1
  const max = d.maxAmount ?? 5
  const unitLabel = (d.unit ?? "seconds") === "seconds" ? "s" : "min"
  return (
    <NodeShell id={id} selected={selected} borderColor={["border-orange-500", "border-orange-200"]}
      headerBg="bg-orange-50" headerBorder="border-orange-100" headerTextColor="text-orange-800"
      icon={<Timer className="h-4 w-4 text-orange-600 shrink-0" />} label="Smart Delay"
      sourceHandleColor="!bg-orange-500" targetHandleColor="!bg-orange-400">
      <div className="space-y-0.5">
        <p className="text-xs text-gray-600">
          Entre <span className="font-semibold text-orange-700">{min}-{max} {unitLabel}</span>
        </p>
        {d.showTyping && (
          <p className="text-[10px] text-teal-600 font-medium">+ digitando...</p>
        )}
      </div>
    </NodeShell>
  )
})

// ─── PaymentNode ──────────────────────────────────────────────────────────────

export const PaymentNode = memo(function PaymentNode({ id, data, selected }: NodeProps) {
  const d = data as { productName?: string; image?: string; text?: string; ctaText?: string }
  const productName = d.productName ?? ""
  const ctaText = d.ctaText || "Pagar agora"
  const { containerRef, rowRefs, tops } = useRowHandleTops(3)

  return (
    <div ref={containerRef} className={`group relative bg-white rounded-xl border-2 shadow-md min-w-[200px] max-w-[260px] transition-colors ${selected ? "border-violet-500" : "border-violet-200"}`}>
      <DeleteButton nodeId={id} />
      <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 rounded-t-xl border-b border-violet-100">
        <CreditCard className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-sm font-semibold text-violet-800">Pagamento</span>
        {productName && (
          <span className="ml-auto text-xs text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]">{productName}</span>
        )}
      </div>
      <div className="px-4 py-2 space-y-1.5">
        {!productName ? (
          <p className="text-xs italic text-gray-400">Nenhum produto selecionado</p>
        ) : (
          <>
            {d.image && (
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-violet-400 shrink-0" />
                <p className="text-xs text-gray-500 truncate">Imagem configurada</p>
              </div>
            )}
            {d.text && <p className="text-xs text-gray-600 line-clamp-2">{d.text}</p>}
            <div className="mt-1 bg-violet-600 rounded-md px-2 py-1 text-center">
              <span className="text-[10px] text-white font-medium">{ctaText}</span>
            </div>
          </>
        )}
      </div>

      {/* Output paths footer — Handle is the visible dot, no duplicate inner dot */}
      <div className="border-t border-violet-100">
        <div ref={rowRefs[0]} className="flex items-center px-3 h-8">
          <span className="text-[10px] font-normal text-gray-600">Aprovado</span>
        </div>
        <div ref={rowRefs[1]} className="flex items-center px-3 h-8 bg-gray-50/60">
          <span className="text-[10px] font-normal text-gray-600">Pendente</span>
        </div>
        <div ref={rowRefs[2]} className="flex items-center px-3 h-8">
          <span className="text-[10px] font-normal text-gray-600">Recusado</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="approved"
        className={`${handleStyle} !bg-emerald-500`} style={{ top: tops[0], bottom: "auto" }} />
      <Handle type="source" position={Position.Right} id="pending"
        className={`${handleStyle} !bg-amber-500`} style={{ top: tops[1], bottom: "auto" }} />
      <Handle type="source" position={Position.Right} id="refused"
        className={`${handleStyle} !bg-red-500`} style={{ top: tops[2], bottom: "auto" }} />

      <Handle type="target" position={Position.Left} className={`${handleStyle} !bg-violet-400`} />
    </div>
  )
})
