"use client"

import { useState, useEffect, useRef } from "react"
import { Node } from "@xyflow/react"
import {
  X, Loader2, CheckCircle2, AlertCircle, Type, ImageIcon, Trash2, Plus, GripVertical,
  UploadCloud, Link2, Check, Film,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  id: string
  type: "text" | "image" | "video"
  content: string
  mediaId?: string // DB id for uploaded images/videos (for deletion)
}

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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"]
const IMAGE_MAX_SIZE = 4 * 1024 * 1024  // 4 MB
const VIDEO_MAX_SIZE = 50 * 1024 * 1024 // 50 MB

const inputCls =
  "w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

const labelCls = "block text-xs font-medium text-gray-600 mb-1"

// ─── ImageUploadBlock ─────────────────────────────────────────────────────────

function ImageUploadBlock({
  block,
  onUploaded,
  onRemove,
}: {
  block: Block
  onUploaded: (content: string, mediaId: string) => void
  onRemove: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setError("")

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Formato inválido. Use JPEG, PNG, WebP ou GIF.")
      return
    }
    if (file.size > IMAGE_MAX_SIZE) {
      setError(`Arquivo muito grande. Máximo 4 MB.`)
      return
    }

    setUploading(true)
    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Erro ao enviar imagem")
        return
      }
      onUploaded(json.url, json.id)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  if (block.content) {
    // Show preview
    return (
      <div className="relative rounded-md overflow-hidden border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.content}
          alt="Prévia"
          className="w-full max-h-40 object-contain bg-gray-50"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="p-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        ) : (
          <UploadCloud className="h-5 w-5 text-gray-400" />
        )}
        <p className="text-xs text-gray-500 text-center">
          {uploading
            ? "Enviando..."
            : "Arraste ou clique para enviar"}
        </p>
        <p className="text-[10px] text-gray-400">JPEG, PNG, WebP, GIF · máx. 4 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
          e.target.value = ""
        }}
      />

      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ─── VideoUploadBlock ─────────────────────────────────────────────────────────

function VideoUploadBlock({
  block,
  onUploaded,
  onRemove,
}: {
  block: Block
  onUploaded: (content: string, mediaId: string) => void
  onRemove: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setError("")
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setError("Formato inválido. Use MP4 ou WebM.")
      return
    }
    if (file.size > VIDEO_MAX_SIZE) {
      setError("Arquivo muito grande. Máximo 50 MB.")
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Erro ao enviar vídeo")
        return
      }
      onUploaded(json.url, json.id)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  if (block.content) {
    return (
      <div className="relative rounded-md overflow-hidden border border-gray-200">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={block.content}
          controls
          className="w-full max-h-40 bg-gray-900 object-contain"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="p-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors ${
          dragOver
            ? "border-purple-400 bg-purple-50"
            : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
        ) : (
          <Film className="h-5 w-5 text-gray-400" />
        )}
        <p className="text-xs text-gray-500 text-center">
          {uploading ? "Enviando..." : "Arraste ou clique para enviar"}
        </p>
        <p className="text-[10px] text-gray-400">MP4, WebM · máx. 50 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_VIDEO_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
          e.target.value = ""
        }}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ─── SortableBlock ────────────────────────────────────────────────────────────

function SortableBlock({
  block,
  canRemove,
  onUpdate,
  onUploaded,
  onRemove,
}: {
  block: Block
  canRemove: boolean
  onUpdate: (content: string) => void
  onUploaded: (content: string, mediaId: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
    >
      {/* Block header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white border-b border-gray-100">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="h-5 w-5 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {block.type === "image" ? (
          <ImageIcon className="h-3 w-3 text-blue-500 shrink-0" />
        ) : block.type === "video" ? (
          <Film className="h-3 w-3 text-purple-500 shrink-0" />
        ) : (
          <Type className="h-3 w-3 text-blue-500 shrink-0" />
        )}
        <span className="text-xs font-medium text-gray-600 flex-1">
          {block.type === "image" ? "Imagem" : block.type === "video" ? "Vídeo" : "Texto"}
        </span>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-5 w-5 flex items-center justify-center text-gray-300 hover:text-red-500 disabled:opacity-0 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Block content */}
      {block.type === "text" ? (
        <div className="p-2">
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none bg-white"
            placeholder="Digite o texto da mensagem..."
          />
        </div>
      ) : block.type === "video" ? (
        <VideoUploadBlock
          block={block}
          onUploaded={onUploaded}
          onRemove={() => onUpdate("")}
        />
      ) : (
        <ImageUploadBlock
          block={block}
          onUploaded={onUploaded}
          onRemove={() => onUpdate("")}
        />
      )}
    </div>
  )
}

// ─── CheckoutLinkCopy ─────────────────────────────────────────────────────────

function CheckoutLinkCopy({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false)
  const base = typeof window !== "undefined" ? window.location.origin : ""
  const url = `${base}/checkout/${productId}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <p className="text-xs font-medium text-blue-700">Link de checkout</p>
      </div>
      <p className="text-[11px] text-blue-600 font-mono break-all leading-relaxed">{url}</p>
      <button
        type="button"
        onClick={copy}
        className={`w-full h-7 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
          copied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Link2 className="h-3 w-3" /> Copiar link</>}
      </button>
      <p className="text-[10px] text-blue-500">
        O bot deve enviar este link ao cliente quando chegar neste nó.
      </p>
    </div>
  )
}

// ─── NodeConfigPanel ──────────────────────────────────────────────────────────

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
  const [blocks, setBlocks] = useState<Block[]>(
    Array.isArray(data.blocks)
      ? (data.blocks as Block[])
      : data.text
      ? [{ id: crypto.randomUUID(), type: "text", content: String(data.text) }]
      : [{ id: crypto.randomUUID(), type: "text", content: "" }]
  )

  // Delay node state
  const [amount, setAmount] = useState(Number(data.amount ?? 5))
  const [unit, setUnit] = useState(String(data.unit ?? "seconds"))

  // Payment node state
  const [productId, setProductId] = useState(String(data.productId ?? ""))
  const [paymentImage, setPaymentImage] = useState(String(data.image ?? ""))
  const [paymentImageMediaId, setPaymentImageMediaId] = useState(String(data.imageMediaId ?? ""))
  const [paymentText, setPaymentText] = useState(String(data.text ?? ""))
  const [paymentCtaText, setPaymentCtaText] = useState(String(data.ctaText ?? "Pagar agora"))

  // Sync when node changes
  useEffect(() => {
    const d = node.data as Record<string, unknown>
    setChannelIdStart(String(d.channelId ?? ""))
    setChannelValid(d.channelId ? true : null)
    setChatTitle(String(d.chatTitle ?? ""))
    setChannelError("")
    setBlocks(
      Array.isArray(d.blocks)
        ? (d.blocks as Block[])
        : d.text
        ? [{ id: crypto.randomUUID(), type: "text", content: String(d.text) }]
        : [{ id: crypto.randomUUID(), type: "text", content: "" }]
    )
    setAmount(Number(d.amount ?? 5))
    setUnit(String(d.unit ?? "seconds"))
    setProductId(String(d.productId ?? ""))
    setPaymentImage(String(d.image ?? ""))
    setPaymentImageMediaId(String(d.imageMediaId ?? ""))
    setPaymentText(String(d.text ?? ""))
    setPaymentCtaText(String(d.ctaText ?? "Pagar agora"))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Start node ───────────────────────────────────────────────────────────

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

  // ─── Block helpers ────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const from = prev.findIndex((b) => b.id === active.id)
        const to = prev.findIndex((b) => b.id === over.id)
        return arrayMove(prev, from, to)
      })
    }
  }

  function addBlock(type: "text" | "image" | "video") {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type, content: "" }])
  }

  function updateBlockContent(id: string, content: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  function handleImageUploaded(id: string, content: string, mediaId: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content, mediaId } : b))
    )
  }

  async function removeBlock(id: string) {
    const block = blocks.find((b) => b.id === id)
    // Delete from storage if it has an uploaded image
    if (block?.mediaId) {
      fetch(`/api/media/${block.mediaId}`, { method: "DELETE" }).catch(() => {})
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  function save() {
    if (node.type === "message") {
      onUpdate(node.id, { blocks })
    } else if (node.type === "delay") {
      onUpdate(node.id, { amount, unit })
    } else if (node.type === "payment") {
      const product = products.find((p) => p.id === productId)
      onUpdate(node.id, {
        productId,
        productName: product?.name ?? "",
        image: paymentImage,
        imageMediaId: paymentImageMediaId,
        text: paymentText,
        ctaText: paymentCtaText || "Pagar agora",
      })
    }
    onClose()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">

        {/* ── Start node ─────────────────────────────────────────────────── */}
        {node.type === "start" && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-xs text-gray-500 mb-0.5">Bot vinculado</p>
              <p className="text-sm font-semibold text-gray-900">{botName}</p>
            </div>

            <div>
              <label className={labelCls}>
                ID do Grupo/Canal <span className="text-red-500">*</span>
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
                  {validatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                </button>
              </div>

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
                Copie o ID do grupo no Telegram (ex:{" "}
                <code className="bg-gray-100 px-0.5 rounded">-100...</code>).
              </p>
            </div>
          </div>
        )}

        {/* ── Message node ───────────────────────────────────────────────── */}
        {node.type === "message" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls + " mb-0"}>Blocos de conteúdo</label>
              <span className="text-xs text-gray-400">
                {blocks.length} bloco{blocks.length !== 1 ? "s" : ""}
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      canRemove={blocks.length > 1}
                      onUpdate={(content) => updateBlockContent(block.id, content)}
                      onUploaded={(content, mediaId) =>
                        handleImageUploaded(block.id, content, mediaId)
                      }
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add block */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addBlock("text")}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <Type className="h-3 w-3" />
                Texto
              </button>
              <button
                type="button"
                onClick={() => addBlock("image")}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <ImageIcon className="h-3 w-3" />
                Imagem
              </button>
              <button
                type="button"
                onClick={() => addBlock("video")}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <Film className="h-3 w-3" />
                Vídeo
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Arraste{" "}
              <span className="inline-flex items-center"><GripVertical className="h-3 w-3 inline" /></span>{" "}
              para reordenar. Cada bloco é uma mensagem separada no Telegram.
            </p>
          </div>
        )}

        {/* ── Delay node ─────────────────────────────────────────────────── */}
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
                  <option value="seconds">Segundos</option>
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

        {/* ── Payment node ───────────────────────────────────────────────── */}
        {node.type === "payment" && (
          <div className="space-y-4">

            {/* Product selection */}
            <div>
              <label className={labelCls}>Produto <span className="text-red-500">*</span></label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Selecione um produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R$ {(p.priceInCents / 100).toFixed(2).replace(".", ",")}
                  </option>
                ))}
              </select>
            </div>

            {!productId && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                Selecione um produto para configurar a mensagem de venda.
              </p>
            )}

            {productId && (
              <>
                {/* Checkout link */}
                <CheckoutLinkCopy productId={productId} />

                <hr className="border-gray-100" />

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Mensagem de venda
                </p>

                {/* Image */}
                <div>
                  <label className={labelCls}>Imagem (opcional)</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                    <ImageUploadBlock
                      block={{ id: "payment-img", type: "image", content: paymentImage, mediaId: paymentImageMediaId }}
                      onUploaded={(url, mediaId) => {
                        setPaymentImage(url)
                        setPaymentImageMediaId(mediaId)
                      }}
                      onRemove={() => {
                        if (paymentImageMediaId) {
                          fetch(`/api/media/${paymentImageMediaId}`, { method: "DELETE" }).catch(() => {})
                        }
                        setPaymentImage("")
                        setPaymentImageMediaId("")
                      }}
                    />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <label className={labelCls}>Texto da mensagem</label>
                  <textarea
                    value={paymentText}
                    onChange={(e) => setPaymentText(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none bg-white"
                    placeholder="Ex: Garanta seu acesso agora! Clique no botão abaixo para pagar."
                  />
                </div>

                {/* CTA button text */}
                <div>
                  <label className={labelCls}>Texto do botão</label>
                  <input
                    value={paymentCtaText}
                    onChange={(e) => setPaymentCtaText(e.target.value)}
                    className={inputCls}
                    placeholder="Pagar agora"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Botão inline no Telegram que abre o link de checkout.
                  </p>
                </div>
              </>
            )}

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
