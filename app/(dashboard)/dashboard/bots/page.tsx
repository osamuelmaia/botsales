"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Settings, Trash2, Bot, Loader2, GitBranch, RefreshCw } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { useRouter } from "next/navigation"
import { BotConfigModal } from "@/components/bots/BotConfigModal"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotListItem {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  _count: { botProducts: number }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BotCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 bg-gray-200 rounded w-36" />
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-28" />
        <div className="h-8 bg-gray-200 rounded w-8 ml-auto" />
      </div>
    </div>
  )
}

// ─── New Bot Form ─────────────────────────────────────────────────────────────

interface NewBotFormProps {
  onSuccess: () => void
  onClose: () => void
}

function NewBotForm({ onSuccess, onClose }: NewBotFormProps) {
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

    if (!res.ok) {
      setError(json.error ?? "Erro ao criar bot")
      return
    }

    toast.success("Bot criado! Clique em Configurar para ajustar os detalhes.")
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome do bot
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          placeholder="Ex: Bot de Vendas, BotEbooks..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Token do BotFather
        </label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono"
          placeholder="1234567890:AAF..."
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          Obtenha seu token no{" "}
          <span className="font-medium text-gray-600">@BotFather</span> no Telegram.
        </p>
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-md">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-10 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Criando..." : "Criar e configurar"}
        </button>
      </div>
    </form>
  )
}

// ─── Bot Card ─────────────────────────────────────────────────────────────────

interface BotCardProps {
  bot: BotListItem
  onDelete: (id: string) => void
  onUpdated: () => void
}

function BotCard({ bot, onDelete, onUpdated }: BotCardProps) {
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

    if (!res.ok) {
      toast.error(json.error ?? "Erro ao excluir bot")
      return
    }

    toast.success("Bot excluído.")
    onDelete(bot.id)
  }

  return (
    <>
      <BotConfigModal
        botId={bot.id}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={onUpdated}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {bot.name}
          </h3>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              bot.isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {bot.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          {bot._count.botProducts === 0
            ? "Nenhum produto vinculado"
            : `${bot._count.botProducts} produto${bot._count.botProducts > 1 ? "s" : ""} vinculado${bot._count.botProducts > 1 ? "s" : ""}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </button>

          <button
            onClick={() => router.push(`/dashboard/bots/${bot.id}/flow`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Fluxo
          </button>

          <button
            onClick={() => router.push(`/dashboard/bots/${bot.id}/remarketing`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Remarketing
          </button>

          <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialog.Trigger asChild>
            <button className="ml-auto h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
            <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-lg p-6">
              <AlertDialog.Title className="text-base font-semibold text-gray-900 mb-2">
                Excluir bot
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-gray-500 mb-5">
                Tem certeza que deseja excluir <strong>{bot.name}</strong>? Esta ação não
                pode ser desfeita.
              </AlertDialog.Description>
              <div className="flex gap-2">
                <AlertDialog.Cancel asChild>
                  <button className="flex-1 h-9 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 h-9 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Excluir
                  </button>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotsPage() {
  const [bots, setBots] = useState<BotListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  function loadBots() {
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBots(data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadBots() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewBot() {
    setOpen(false)
    loadBots()
  }

  function handleDelete(id: string) {
    setBots((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bots</h1>
          <p className="text-gray-500 mt-1">Gerencie seus bots do Telegram.</p>
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-2 h-9 px-4 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus className="h-4 w-4" />
              Novo Bot
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <Dialog.Title className="text-base font-semibold text-gray-900">
                  Novo Bot
                </Dialog.Title>
                <Dialog.Close className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">
                  ×
                </Dialog.Close>
              </div>

              <div className="flex flex-col md:flex-row overflow-y-auto">
                {/* Tutorial */}
                <div className="md:w-1/2 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 px-6 py-5 shrink-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                    Como obter o token
                  </p>
                  <ol className="space-y-4">
                    {[
                      {
                        n: 1,
                        title: "Abra o BotFather no Telegram",
                        desc: "Procure por @BotFather no Telegram ou acesse diretamente:",
                        extra: (
                          <a
                            href="https://t.me/BotFather"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                          >
                            t.me/BotFather ↗
                          </a>
                        ),
                      },
                      {
                        n: 2,
                        title: "Envie o comando /newbot",
                        desc: "No chat com o BotFather, envie o seguinte comando:",
                        extra: (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-mono">
                            /newbot
                          </span>
                        ),
                      },
                      {
                        n: 3,
                        title: "Defina o nome do bot",
                        desc: 'O BotFather perguntará o nome completo do bot. Ex: "Meu Bot de Vendas".',
                      },
                      {
                        n: 4,
                        title: "Defina o username do bot",
                        desc: "Escolha um username único que termine com",
                        extra: (
                          <span className="text-xs text-gray-500">
                            {" "}
                            <span className="font-mono text-gray-700">bot</span>. Ex:{" "}
                            <span className="font-mono text-gray-700">empresa123_bot</span>
                          </span>
                        ),
                      },
                      {
                        n: 5,
                        title: "Copie o token",
                        desc: "O BotFather enviará o token. Copie e cole no campo ao lado.",
                      },
                    ].map((step) => (
                      <li key={step.n} className="flex gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 mt-0.5">
                          {step.n}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                          {step.extra && <div>{step.extra}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Form */}
                <div className="md:w-1/2 px-6 py-5">
                  <NewBotForm
                    onSuccess={handleNewBot}
                    onClose={() => setOpen(false)}
                  />
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <BotCardSkeleton key={i} />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center py-16 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Nenhum bot criado ainda
            </h3>
            <p className="text-sm text-gray-500 mb-5 max-w-xs">
              Crie seu primeiro bot e comece a vender pelo Telegram.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 h-9 px-4 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar meu primeiro bot
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onDelete={handleDelete} onUpdated={loadBots} />
          ))}
        </div>
      )}
    </div>
  )
}
