"use client"

import { useState, useEffect, useRef } from "react"
import { Node } from "@xyflow/react"
import {
  X, Loader2, CheckCircle2, AlertCircle, UploadCloud, Link2, Check, Film, Music, FileText, Plus, ArrowRight, Trash2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product { id: string; name: string; priceInCents: number }

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
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac"]
const IMAGE_MAX_SIZE = 4 * 1024 * 1024
const VIDEO_MAX_SIZE = 50 * 1024 * 1024
const AUDIO_MAX_SIZE = 20 * 1024 * 1024
const FILE_MAX_SIZE = 50 * 1024 * 1024

const inputCls = "w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
const labelCls = "block text-xs font-medium text-gray-600 mb-1"
const textareaCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none bg-white"

// ─── Generic Upload Component ────────────────────────────────────────────────

function MediaUpload({ url, accept, allowedTypes, maxSize, maxSizeLabel, formatLabel, icon, onUploaded, onRemove, preview }: {
  url: string; accept: string; allowedTypes: string[] | null; maxSize: number; maxSizeLabel: string
  formatLabel: string; icon: React.ReactNode
  onUploaded: (url: string, mediaId: string) => void; onRemove: () => void; preview?: React.ReactNode
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setError("")
    if (allowedTypes && !allowedTypes.includes(file.type)) { setError(`Formato inválido. Use ${formatLabel}.`); return }
    if (file.size > maxSize) { setError(`Arquivo muito grande. Máximo ${maxSizeLabel}.`); return }
    setUploading(true)
    const form = new FormData(); form.append("file", file)
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Erro ao enviar"); return }
      onUploaded(json.url, json.id)
    } catch { setError("Erro de conexão. Tente novamente.") }
    finally { setUploading(false) }
  }

  if (url) {
    return (
      <div className="relative rounded-md overflow-hidden border border-gray-200">
        {preview}
        <button type="button" onClick={onRemove}
          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
        }`}>
        {uploading ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : icon}
        <p className="text-xs text-gray-500">{uploading ? "Enviando..." : "Arraste ou clique para enviar"}</p>
        <p className="text-[10px] text-gray-400">{formatLabel} · máx. {maxSizeLabel}</p>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = "" }} />
      {error && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{error}</p>}
    </div>
  )
}

// ─── CheckoutLinkCopy ─────────────────────────────────────────────────────────

function CheckoutLinkCopy({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false)
  const base = typeof window !== "undefined" ? window.location.origin : ""
  const url = `${base}/checkout/${productId}`
  function copy() { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <p className="text-xs font-medium text-blue-700">Link de checkout</p>
      </div>
      <p className="text-[11px] text-blue-600 font-mono break-all leading-relaxed">{url}</p>
      <button type="button" onClick={copy}
        className={`w-full h-7 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
          copied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
        }`}>
        {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Link2 className="h-3 w-3" /> Copiar link</>}
      </button>
    </div>
  )
}

// ─── NodeConfigPanel ──────────────────────────────────────────────────────────

export function NodeConfigPanel({ node, botId, botName, products, onUpdate, onClose }: NodeConfigPanelProps) {
  const data = node.data as Record<string, unknown>

  // Start
  const [channelIdStart, setChannelIdStart] = useState(String(data.channelId ?? ""))
  const [validatingChannel, setValidatingChannel] = useState(false)
  const [channelValid, setChannelValid] = useState<boolean | null>(data.channelId ? true : null)
  const [channelError, setChannelError] = useState("")
  const [chatTitle, setChatTitle] = useState(String(data.chatTitle ?? ""))

  // Text
  const [textContent, setTextContent] = useState(String(data.content ?? ""))

  // Image
  const [imageUrl, setImageUrl] = useState(String(data.url ?? ""))
  const [imageMediaId, setImageMediaId] = useState(String(data.mediaId ?? ""))
  const [imageCaption, setImageCaption] = useState(String(data.caption ?? ""))

  // Video
  const [videoUrl, setVideoUrl] = useState(String(data.url ?? ""))
  const [videoMediaId, setVideoMediaId] = useState(String(data.mediaId ?? ""))
  const [videoCaption, setVideoCaption] = useState(String(data.caption ?? ""))

  // Audio
  const [audioUrl, setAudioUrl] = useState(String(data.url ?? ""))
  const [audioMediaId, setAudioMediaId] = useState(String(data.mediaId ?? ""))

  // File
  const [fileUrl, setFileUrl] = useState(String(data.url ?? ""))
  const [fileMediaId, setFileMediaId] = useState(String(data.mediaId ?? ""))
  const [fileCaption, setFileCaption] = useState(String(data.caption ?? ""))

  // Typing
  const [typingDuration, setTypingDuration] = useState(Number(data.duration ?? 3))
  const [typingUnit, setTypingUnit] = useState(String(data.unit ?? "seconds"))

  // Button (multi-button)
  interface ButtonItem { id: string; label: string; mode: "url" | "flow"; url: string }
  const defaultButtons: ButtonItem[] = Array.isArray(data.buttons)
    ? (data.buttons as ButtonItem[])
    : [{ id: crypto.randomUUID(), label: "", mode: "flow", url: "" }]
  const [buttons, setButtons] = useState<ButtonItem[]>(defaultButtons)
  const [btnImage, setBtnImage] = useState(String(data.image ?? ""))
  const [btnImageMediaId, setBtnImageMediaId] = useState(String(data.imageMediaId ?? ""))
  const [btnText, setBtnText] = useState(String(data.text ?? ""))

  // Delay
  const [delayAmount, setDelayAmount] = useState(Number(data.amount ?? 5))
  const [delayUnit, setDelayUnit] = useState(String(data.unit ?? "seconds"))

  // Smart Delay
  const [sdMin, setSdMin] = useState(Number(data.minAmount ?? 1))
  const [sdMax, setSdMax] = useState(Number(data.maxAmount ?? 5))
  const [sdUnit, setSdUnit] = useState(String(data.unit ?? "seconds"))
  const [sdTyping, setSdTyping] = useState(Boolean(data.showTyping ?? false))

  // Payment
  const [productId, setProductId] = useState(String(data.productId ?? ""))
  const [paymentImage, setPaymentImage] = useState(String(data.image ?? ""))
  const [paymentImageMediaId, setPaymentImageMediaId] = useState(String(data.imageMediaId ?? ""))
  const [paymentText, setPaymentText] = useState(String(data.text ?? ""))
  const [paymentCtaText, setPaymentCtaText] = useState(String(data.ctaText ?? "Pagar agora"))

  // Sync on node change
  useEffect(() => {
    const d = node.data as Record<string, unknown>
    setChannelIdStart(String(d.channelId ?? "")); setChannelValid(d.channelId ? true : null)
    setChatTitle(String(d.chatTitle ?? "")); setChannelError("")
    setTextContent(String(d.content ?? ""))
    setImageUrl(String(d.url ?? "")); setImageMediaId(String(d.mediaId ?? "")); setImageCaption(String(d.caption ?? ""))
    setVideoUrl(String(d.url ?? "")); setVideoMediaId(String(d.mediaId ?? "")); setVideoCaption(String(d.caption ?? ""))
    setAudioUrl(String(d.url ?? "")); setAudioMediaId(String(d.mediaId ?? ""))
    setFileUrl(String(d.url ?? "")); setFileMediaId(String(d.mediaId ?? "")); setFileCaption(String(d.caption ?? ""))
    setTypingDuration(Number(d.duration ?? 3)); setTypingUnit(String(d.unit ?? "seconds"))
    setButtons(Array.isArray(d.buttons) ? (d.buttons as ButtonItem[]) : [{ id: crypto.randomUUID(), label: "", mode: "flow", url: "" }])
    setBtnImage(String(d.image ?? "")); setBtnImageMediaId(String(d.imageMediaId ?? ""))
    setBtnText(String(d.text ?? ""))
    setDelayAmount(Number(d.amount ?? 5)); setDelayUnit(String(d.unit ?? "seconds"))
    setSdMin(Number(d.minAmount ?? 1)); setSdMax(Number(d.maxAmount ?? 5))
    setSdUnit(String(d.unit ?? "seconds")); setSdTyping(Boolean(d.showTyping ?? false))
    setProductId(String(d.productId ?? "")); setPaymentImage(String(d.image ?? ""))
    setPaymentImageMediaId(String(d.imageMediaId ?? ""))
    setPaymentText(String(d.text ?? "")); setPaymentCtaText(String(d.ctaText ?? "Pagar agora"))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helper: update node immediately ────────────────────────────────────────

  function emit(fields: Record<string, unknown>) {
    onUpdate(node.id, fields)
  }

  function deleteMedia(mediaId: string) {
    if (mediaId) fetch(`/api/media/${mediaId}`, { method: "DELETE" }).catch(() => {})
  }

  // ─── Start validation ───────────────────────────────────────────────────────

  async function validateChannel() {
    if (!channelIdStart.trim()) return
    setValidatingChannel(true); setChannelError(""); setChannelValid(null)
    try {
      const res = await fetch(`/api/bots/${botId}/validate-channel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channelIdStart.trim() }),
      })
      const json = await res.json()
      if (json.valid) {
        setChannelValid(true); setChatTitle(json.chatTitle ?? channelIdStart.trim())
        emit({ channelId: channelIdStart.trim(), chatTitle: json.chatTitle ?? channelIdStart.trim(), botName })
      } else {
        setChannelValid(false); setChannelError(json.error ?? "Grupo inválido")
      }
    } catch { setChannelValid(false); setChannelError("Erro ao validar grupo") }
    finally { setValidatingChannel(false) }
  }

  // ─── Panel titles ───────────────────────────────────────────────────────────

  const titles: Record<string, string> = {
    start: "Nó de Início", text: "Configurar Texto", image: "Configurar Imagem",
    video: "Configurar Vídeo", audio: "Configurar Áudio", file: "Configurar Arquivo",
    typing: "Configurar Digitando...", button: "Configurar Botão", delay: "Configurar Atraso",
    smart_delay: "Configurar Smart Delay", payment: "Configurar Pagamento",
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{titles[node.type ?? ""] ?? "Configurar"}</h3>
        <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">

        {/* ── Start ─────────────────────────────────────────────────────── */}
        {node.type === "start" && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-xs text-gray-500 mb-0.5">Bot vinculado</p>
              <p className="text-sm font-semibold text-gray-900">{botName}</p>
            </div>
            <div>
              <label className={labelCls}>ID do Grupo/Canal <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input value={channelIdStart}
                  onChange={(e) => { setChannelIdStart(e.target.value); setChannelValid(null); setChannelError("") }}
                  className={inputCls} placeholder="-100123456789" />
                <button type="button" onClick={validateChannel} disabled={validatingChannel || !channelIdStart.trim()}
                  className="h-9 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0">
                  {validatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                </button>
              </div>
              {channelValid === true && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">{chatTitle || channelIdStart} — bot é admin</p>
                </div>
              )}
              {channelValid === false && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{channelError}</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1.5">
                O bot deve ser administrador com permissão para banir membros. Copie o ID do grupo (ex: <code className="bg-gray-100 px-0.5 rounded">-100...</code>).
              </p>
            </div>
          </div>
        )}

        {/* ── Text ──────────────────────────────────────────────────────── */}
        {node.type === "text" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Mensagem de texto</label>
              <textarea value={textContent} onChange={(e) => { setTextContent(e.target.value); emit({ content: e.target.value }) }}
                rows={5} className={textareaCls} placeholder="Digite a mensagem... (suporta Markdown do Telegram)" />
            </div>
            <p className="text-xs text-gray-400">Suporta <strong>negrito</strong>, <em>itálico</em>, <code className="bg-gray-100 px-0.5 rounded">código</code> e links.</p>
          </div>
        )}

        {/* ── Image ─────────────────────────────────────────────────────── */}
        {node.type === "image" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Imagem</label>
              <MediaUpload url={imageUrl} accept={ALLOWED_IMAGE_TYPES.join(",")}
                allowedTypes={ALLOWED_IMAGE_TYPES} maxSize={IMAGE_MAX_SIZE}
                maxSizeLabel="4 MB" formatLabel="JPEG, PNG, WebP, GIF"
                icon={<UploadCloud className="h-5 w-5 text-gray-400" />}
                onUploaded={(u, id) => { setImageUrl(u); setImageMediaId(id); emit({ url: u, mediaId: id }) }}
                onRemove={() => { deleteMedia(imageMediaId); setImageUrl(""); setImageMediaId(""); emit({ url: "", mediaId: "" }) }}
                preview={/* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imageUrl} alt="Prévia" className="w-full max-h-40 object-contain bg-gray-50" />} />
            </div>
            <div>
              <label className={labelCls}>Legenda (opcional)</label>
              <textarea value={imageCaption} onChange={(e) => { setImageCaption(e.target.value); emit({ caption: e.target.value }) }}
                rows={2} className={textareaCls} placeholder="Legenda da imagem..." />
            </div>
          </div>
        )}

        {/* ── Video ─────────────────────────────────────────────────────── */}
        {node.type === "video" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Vídeo</label>
              <MediaUpload url={videoUrl} accept={ALLOWED_VIDEO_TYPES.join(",")}
                allowedTypes={ALLOWED_VIDEO_TYPES} maxSize={VIDEO_MAX_SIZE}
                maxSizeLabel="50 MB" formatLabel="MP4, WebM"
                icon={<Film className="h-5 w-5 text-gray-400" />}
                onUploaded={(u, id) => { setVideoUrl(u); setVideoMediaId(id); emit({ url: u, mediaId: id }) }}
                onRemove={() => { deleteMedia(videoMediaId); setVideoUrl(""); setVideoMediaId(""); emit({ url: "", mediaId: "" }) }}
                preview={/* eslint-disable-next-line jsx-a11y/media-has-caption */
                  <video src={videoUrl} controls className="w-full max-h-40 bg-gray-900 object-contain" />} />
            </div>
            <div>
              <label className={labelCls}>Legenda (opcional)</label>
              <textarea value={videoCaption} onChange={(e) => { setVideoCaption(e.target.value); emit({ caption: e.target.value }) }}
                rows={2} className={textareaCls} placeholder="Legenda do vídeo..." />
            </div>
          </div>
        )}

        {/* ── Audio ─────────────────────────────────────────────────────── */}
        {node.type === "audio" && (
          <div className="space-y-3">
            <label className={labelCls}>Arquivo de áudio</label>
            <MediaUpload url={audioUrl} accept={ALLOWED_AUDIO_TYPES.join(",")}
              allowedTypes={ALLOWED_AUDIO_TYPES} maxSize={AUDIO_MAX_SIZE}
              maxSizeLabel="20 MB" formatLabel="MP3, OGG, WAV, M4A"
              icon={<Music className="h-5 w-5 text-gray-400" />}
              onUploaded={(u, id) => { setAudioUrl(u); setAudioMediaId(id); emit({ url: u, mediaId: id }) }}
              onRemove={() => { deleteMedia(audioMediaId); setAudioUrl(""); setAudioMediaId(""); emit({ url: "", mediaId: "" }) }}
              preview={/* eslint-disable-next-line jsx-a11y/media-has-caption */
                <audio src={audioUrl} controls className="w-full p-2" />} />
          </div>
        )}

        {/* ── File ──────────────────────────────────────────────────────── */}
        {node.type === "file" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Arquivo</label>
              <MediaUpload url={fileUrl} accept="*/*"
                allowedTypes={null} maxSize={FILE_MAX_SIZE}
                maxSizeLabel="50 MB" formatLabel="PDF, DOC, ZIP, etc."
                icon={<FileText className="h-5 w-5 text-gray-400" />}
                onUploaded={(u, id) => { setFileUrl(u); setFileMediaId(id); emit({ url: u, mediaId: id }) }}
                onRemove={() => { deleteMedia(fileMediaId); setFileUrl(""); setFileMediaId(""); emit({ url: "", mediaId: "" }) }}
                preview={
                  <div className="flex items-center gap-2 p-3 bg-gray-50">
                    <FileText className="h-5 w-5 text-slate-500 shrink-0" />
                    <p className="text-xs text-gray-600 truncate">Arquivo enviado</p>
                  </div>} />
            </div>
            <div>
              <label className={labelCls}>Legenda (opcional)</label>
              <textarea value={fileCaption} onChange={(e) => { setFileCaption(e.target.value); emit({ caption: e.target.value }) }}
                rows={2} className={textareaCls} placeholder="Legenda do arquivo..." />
            </div>
          </div>
        )}

        {/* ── Typing ────────────────────────────────────────────────────── */}
        {node.type === "typing" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Duração do efeito</label>
              <div className="flex gap-2">
                <input type="number" min={1} max={120} value={typingDuration}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setTypingDuration(v); emit({ duration: v }) }}
                  className={inputCls + " w-24"} />
                <select value={typingUnit} onChange={(e) => { setTypingUnit(e.target.value); emit({ unit: e.target.value }) }}
                  className="flex-1 h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">Exibe &quot;digitando...&quot; no chat do Telegram por esse tempo.</p>
          </div>
        )}

        {/* ── Button ────────────────────────────────────────────────────── */}
        {node.type === "button" && (
          <div className="space-y-3">
            {/* Image */}
            <div>
              <label className={labelCls}>Imagem (recomendado)</label>
              <MediaUpload url={btnImage} accept={ALLOWED_IMAGE_TYPES.join(",")}
                allowedTypes={ALLOWED_IMAGE_TYPES} maxSize={IMAGE_MAX_SIZE}
                maxSizeLabel="4 MB" formatLabel="JPEG, PNG, WebP, GIF"
                icon={<UploadCloud className="h-5 w-5 text-gray-400" />}
                onUploaded={(u, id) => { setBtnImage(u); setBtnImageMediaId(id); emit({ image: u, imageMediaId: id }) }}
                onRemove={() => { deleteMedia(btnImageMediaId); setBtnImage(""); setBtnImageMediaId(""); emit({ image: "", imageMediaId: "" }) }}
                preview={/* eslint-disable-next-line @next/next/no-img-element */
                  <img src={btnImage} alt="Prévia" className="w-full max-h-40 object-contain bg-gray-50" />} />
            </div>

            {/* Text */}
            <div>
              <label className={labelCls}>Texto (recomendado)</label>
              <textarea value={btnText} rows={3}
                onChange={(e) => { setBtnText(e.target.value); emit({ text: e.target.value }) }}
                className={textareaCls} placeholder="Mensagem exibida acima dos botões..." />
            </div>

            <div className="border-t border-gray-100 pt-3" />

            {buttons.map((btn, i) => {
              function updateBtn(patch: Partial<ButtonItem>) {
                const next = buttons.map((b, j) => j === i ? { ...b, ...patch } : b)
                setButtons(next)
                emit({ buttons: next })
              }
              return (
                <div key={btn.id} className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Botão {i + 1}</span>
                    {buttons.length > 1 && (
                      <button type="button" onClick={() => {
                        const next = buttons.filter((_, j) => j !== i)
                        setButtons(next); emit({ buttons: next })
                      }} className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Texto do botão <span className="text-red-500">*</span></label>
                    <input value={btn.label} onChange={(e) => updateBtn({ label: e.target.value })}
                      className={inputCls} placeholder="Ex: Plano Mensal" />
                  </div>

                  {/* Mode toggle */}
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => updateBtn({ mode: "flow" })}
                      className={`flex-1 h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${btn.mode === "flow" ? "bg-indigo-600 text-white" : "border border-gray-300 text-gray-500 hover:bg-gray-100"}`}>
                      <ArrowRight className="h-3 w-3" /> Seguir fluxo
                    </button>
                    <button type="button" onClick={() => updateBtn({ mode: "url" })}
                      className={`flex-1 h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${btn.mode === "url" ? "bg-indigo-600 text-white" : "border border-gray-300 text-gray-500 hover:bg-gray-100"}`}>
                      <Link2 className="h-3 w-3" /> Abrir URL
                    </button>
                  </div>

                  {btn.mode === "url" && (
                    <div>
                      <label className={labelCls}>URL</label>
                      <input value={btn.url} onChange={(e) => updateBtn({ url: e.target.value })}
                        className={inputCls} placeholder="https://..." />
                    </div>
                  )}
                  {btn.mode === "flow" && (
                    <p className="text-[10px] text-indigo-600 bg-indigo-50 rounded px-2 py-1">
                      Conecte a saída deste botão ao próximo nó no canvas.
                    </p>
                  )}
                </div>
              )
            })}

            {buttons.length < 3 && (
              <button type="button" onClick={() => {
                const next = [...buttons, { id: crypto.randomUUID(), label: "", mode: "flow" as const, url: "" }]
                setButtons(next); emit({ buttons: next })
              }} className="w-full h-8 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Adicionar botão
              </button>
            )}
          </div>
        )}

        {/* ── Delay ─────────────────────────────────────────────────────── */}
        {node.type === "delay" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Tempo de espera</label>
              <div className="flex gap-2">
                <input type="number" min={1} max={999} value={delayAmount}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setDelayAmount(v); emit({ amount: v }) }}
                  className={inputCls + " w-24"} />
                <select value={delayUnit} onChange={(e) => { setDelayUnit(e.target.value); emit({ unit: e.target.value }) }}
                  className="flex-1 h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">O bot aguardará esse tempo fixo antes de continuar.</p>
          </div>
        )}

        {/* ── Smart Delay ───────────────────────────────────────────────── */}
        {node.type === "smart_delay" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Intervalo aleatório</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={999} value={sdMin}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setSdMin(v); emit({ minAmount: v }) }}
                  className={inputCls + " w-20"} />
                <span className="text-xs text-gray-500 shrink-0">a</span>
                <input type="number" min={1} max={999} value={sdMax}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setSdMax(v); emit({ maxAmount: v }) }}
                  className={inputCls + " w-20"} />
                <select value={sdUnit} onChange={(e) => { setSdUnit(e.target.value); emit({ unit: e.target.value }) }}
                  className="flex-1 h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sdTyping}
                onChange={(e) => { setSdTyping(e.target.checked); emit({ showTyping: e.target.checked }) }}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
              <span className="text-xs text-gray-600">Exibir &quot;digitando...&quot; durante o delay</span>
            </label>
            <p className="text-xs text-gray-400">Delay aleatório entre os dois valores para humanizar o fluxo.</p>
          </div>
        )}

        {/* ── Payment ───────────────────────────────────────────────────── */}
        {node.type === "payment" && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Produto <span className="text-red-500">*</span></label>
              <select value={productId} onChange={(e) => {
                const v = e.target.value; setProductId(v)
                const p = products.find((pr) => pr.id === v)
                emit({ productId: v, productName: p?.name ?? "" })
              }}
                className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Selecione um produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — R$ {(p.priceInCents / 100).toFixed(2).replace(".", ",")}</option>
                ))}
              </select>
            </div>
            {!productId && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">Selecione um produto para configurar.</p>
            )}
            {productId && (
              <>
                <CheckoutLinkCopy productId={productId} />
                <hr className="border-gray-100" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mensagem de venda</p>
                <div>
                  <label className={labelCls}>Imagem (opcional)</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                    <MediaUpload url={paymentImage} accept={ALLOWED_IMAGE_TYPES.join(",")}
                      allowedTypes={ALLOWED_IMAGE_TYPES} maxSize={IMAGE_MAX_SIZE}
                      maxSizeLabel="4 MB" formatLabel="JPEG, PNG, WebP, GIF"
                      icon={<UploadCloud className="h-5 w-5 text-gray-400" />}
                      onUploaded={(u, id) => { setPaymentImage(u); setPaymentImageMediaId(id); emit({ image: u, imageMediaId: id }) }}
                      onRemove={() => { deleteMedia(paymentImageMediaId); setPaymentImage(""); setPaymentImageMediaId(""); emit({ image: "", imageMediaId: "" }) }}
                      preview={/* eslint-disable-next-line @next/next/no-img-element */
                        <img src={paymentImage} alt="Prévia" className="w-full max-h-40 object-contain bg-gray-50" />} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Texto da mensagem</label>
                  <textarea value={paymentText} onChange={(e) => { setPaymentText(e.target.value); emit({ text: e.target.value }) }}
                    rows={3} className={textareaCls} placeholder="Ex: Garanta seu acesso agora!" />
                </div>
                <div>
                  <label className={labelCls}>Texto do botão</label>
                  <input value={paymentCtaText} onChange={(e) => { setPaymentCtaText(e.target.value); emit({ ctaText: e.target.value }) }}
                    className={inputCls} placeholder="Pagar agora" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer: only start node needs confirm button */}
      {node.type === "start" && (
        <div className="p-4 border-t border-gray-100">
          <button onClick={onClose} disabled={!channelValid}
            className="w-full h-9 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {channelValid ? "Confirmar" : "Valide o grupo para continuar"}
          </button>
        </div>
      )}
    </div>
  )
}
