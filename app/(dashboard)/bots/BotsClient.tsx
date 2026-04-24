"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Plus, Settings, Trash2, Bot, GitBranch, AlertTriangle, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { useRouter } from "next/navigation"
import { BotConfigModal } from "@/components/bots/BotConfigModal"
import { fetcher } from "@/lib/fetcher"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"

interface BotListItem {
  id: string
  shortId: string | null
  name: string
  isActive: boolean
  createdAt: string
  channelPermissionError: string | null
  _count: { botProducts: number }
}

// ─── New Bot Form ─────────────────────────────────────────────────────────────

function NewBotForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(json.error ?? "Erro ao criar bot"); return }
    toast.success("Bot criado! Clique em Configurar para ajustar os detalhes.")
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nome do bot"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Bot de Vendas, BotEbooks..."
        required
      />
      <Input
        label="Token do BotFather"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="1234567890:AAF..."
        className="font-mono"
        helper="Obtenha seu token no @BotFather no Telegram."
        required
      />
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose} fullWidth>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting} fullWidth>
          {submitting ? "Criando..." : "Criar e configurar"}
        </Button>
      </div>
    </form>
  )
}

// ─── Bot Card ─────────────────────────────────────────────────────────────────

function BotCard({ bot, onDelete, onUpdated }: { bot: BotListItem; onDelete: (id: string) => void; onUpdated: () => void }) {
  const router = useRouter()
  const [configOpen, setConfigOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" })
    const json = await res.json()
    setDeleting(false)
    setDeleteOpen(false)
    if (!res.ok) { toast.error(json.error ?? "Erro ao excluir bot"); return }
    toast.success("Bot excluído.")
    onDelete(bot.id)
  }

  const productCount = bot._count.botProducts

  return (
    <>
      <BotConfigModal botId={bot.id} open={configOpen} onOpenChange={setConfigOpen} onSaved={onUpdated} />
      <div className="group bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-blue-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-[15px] leading-tight truncate">{bot.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {productCount === 0
                  ? "Sem produtos — acesse Configurar para vincular"
                  : `${productCount} produto${productCount > 1 ? "s" : ""} vinculado${productCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <Badge variant={bot.isActive ? "success" : "neutral"} size="sm" dot>
            {bot.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* Warning */}
        {bot.channelPermissionError && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Bot sem permissão de admin no grupo. Abra o fluxo e revalide o nó{" "}
              <strong>Liberar acesso ao canal</strong>.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfigOpen(true)} leftIcon={<Settings />}>
            Configurar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/bots/${bot.shortId ?? bot.id}/flow`)} leftIcon={<GitBranch />}>
            Fluxo
          </Button>
          <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialog.Trigger asChild>
              <button
                className="ml-auto h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Excluir"
                aria-label="Excluir bot"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
              <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <AlertDialog.Title className="text-base font-semibold text-gray-900">
                      Excluir bot
                    </AlertDialog.Title>
                    <AlertDialog.Description className="text-sm text-gray-500 mt-1">
                      Tem certeza que deseja excluir <strong className="text-gray-700">{bot.name}</strong>?
                      Esta ação não pode ser desfeita.
                    </AlertDialog.Description>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button variant="secondary">Cancelar</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button variant="danger" onClick={handleDelete} loading={deleting}>
                      Excluir
                    </Button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </div>
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BotsClient() {
  const { data: bots = [], mutate } = useSWR<BotListItem[]>("/api/bots", fetcher)
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get("create") === "true") setOpen(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bots"
        description="Conecte um bot do Telegram, adicione produtos e configure o fluxo de mensagens para vender no automático."
        actions={
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button leftIcon={<Plus />}>Novo Bot</Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
              <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-gray-900">Novo Bot</Dialog.Title>
                    <p className="text-xs text-gray-500 mt-0.5">Conecte um bot do Telegram à plataforma</p>
                  </div>
                  <Dialog.Close className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>
                <div className="flex flex-col md:flex-row overflow-y-auto">
                  {/* Tutorial */}
                  <div className="md:w-1/2 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 px-6 py-5 shrink-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Como obter o token
                    </p>
                    <ol className="space-y-4">
                      {[
                        { n: 1, title: "Abra o BotFather no Telegram", desc: "Procure por @BotFather ou acesse diretamente:", extra: <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 mt-1">t.me/BotFather ↗</a> },
                        { n: 2, title: "Envie o comando /newbot", desc: "No chat com o BotFather, envie o comando:", extra: <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 text-xs font-mono">/newbot</span> },
                        { n: 3, title: "Defina o nome do bot", desc: 'O BotFather perguntará o nome completo. Ex: "Meu Bot de Vendas".' },
                        { n: 4, title: "Copie o token gerado", desc: "O BotFather enviará um token. Copie e cole no campo ao lado." },
                      ].map(({ n, title, desc, extra }) => (
                        <li key={n} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm shadow-blue-600/20">
                            {n}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                            {extra}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {/* Form */}
                  <div className="flex-1 px-6 py-5">
                    <NewBotForm onSuccess={() => { setOpen(false); mutate() }} onClose={() => setOpen(false)} />
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        }
      />

      {/* Grid */}
      {bots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={Bot}
            title="Nenhum bot criado ainda"
            description="Um bot é seu vendedor automático no Telegram. Crie o primeiro, vincule produtos e configure o fluxo de mensagens."
            action={
              <Button onClick={() => setOpen(true)} leftIcon={<Plus />}>
                Criar primeiro bot
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot}
              onDelete={() => mutate()}
              onUpdated={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  )
}
