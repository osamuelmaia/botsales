"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Connection, Edge, Node, NodeTypes, EdgeTypes, BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import {
  Save, Loader2, ArrowLeft, AlertCircle,
  Type, Image as ImageIcon, Film, Music, FileText, MoreHorizontal,
  MousePointerClick, Clock, Timer, CreditCard,
} from "lucide-react"
import { useRouter } from "next/navigation"

import {
  StartNode, TextNode, ImageNode, VideoNode, AudioNode, FileNode,
  TypingNode, ButtonNode, DelayNode, SmartDelayNode, PaymentNode, edgeTypes,
} from "./nodes"
import { NodeConfigPanel } from "./NodeConfigPanel"

// ─── nodeTypes / edgeTypes MUST be defined outside component ─────────────────

const nodeTypes: NodeTypes = {
  start: StartNode,
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  file: FileNode,
  typing: TypingNode,
  button: ButtonNode,
  delay: DelayNode,
  smart_delay: SmartDelayNode,
  payment: PaymentNode,
}

const typedEdgeTypes: EdgeTypes = edgeTypes

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  priceInCents: number
}

interface FlowEditorProps {
  botId: string
  botName: string
  botChannelId?: string | null
  products: Product[]
}

type NodeType = "text" | "image" | "video" | "audio" | "file" | "typing" | "button" | "delay" | "smart_delay" | "payment"

// ─── Default data per node type ───────────────────────────────────────────────

function getDefaultData(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "text": return { content: "" }
    case "image": return { url: "", mediaId: "", caption: "" }
    case "video": return { url: "", mediaId: "", caption: "" }
    case "audio": return { url: "", mediaId: "" }
    case "file": return { url: "", mediaId: "", caption: "" }
    case "typing": return { duration: 3, unit: "seconds" }
    case "button": return { text: "", buttonLabel: "", buttonUrl: "" }
    case "delay": return { amount: 5, unit: "seconds" }
    case "smart_delay": return { minAmount: 1, maxAmount: 5, unit: "seconds", showTyping: false }
    case "payment": return { productId: "", productName: "", image: "", imageMediaId: "", text: "", ctaText: "Pagar agora" }
  }
}

// ─── Palette item ─────────────────────────────────────────────────────────────

function PaletteItem({ icon, label, color, onAdd }: {
  icon: React.ReactNode; label: string; color: string; onAdd: () => void
}) {
  return (
    <button onClick={onAdd}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:opacity-80 ${color}`}>
      {icon}
      {label}
    </button>
  )
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

// ─── MiniMap color ────────────────────────────────────────────────────────────

function minimapColor(n: Node) {
  const map: Record<string, string> = {
    start: "#10b981", text: "#3b82f6", image: "#0ea5e9", video: "#a855f7",
    audio: "#ec4899", file: "#64748b", typing: "#14b8a6", button: "#6366f1",
    delay: "#f59e0b", smart_delay: "#f97316", payment: "#8b5cf6",
  }
  return map[n.type ?? ""] ?? "#94a3b8"
}

// ─── FlowEditor ───────────────────────────────────────────────────────────────

export function FlowEditor({ botId, botName, botChannelId, products }: FlowEditorProps) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const autoOpenedRef = useRef(false)

  // ─── Load flow ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/bots/${botId}/flow`)
      .then((r) => r.json())
      .then(({ nodes: n, edges: e }: { nodes: Node[]; edges: Edge[] }) => {
        const populated = n.map((node) => {
          if (node.type === "start") {
            return { ...node, data: {
              botName,
              channelId: (node.data as Record<string, unknown>).channelId ?? botChannelId ?? "",
              chatTitle: (node.data as Record<string, unknown>).chatTitle ?? "",
            }}
          }
          return node
        })
        setNodes(populated)
        setEdges(e)
        const startNode = populated.find((nd) => nd.type === "start")
        if (startNode && !autoOpenedRef.current) {
          if (!(startNode.data as Record<string, unknown>).channelId) {
            autoOpenedRef.current = true
            setSelectedNode(startNode)
          }
        }
      })
      .catch(() => toast.error("Erro ao carregar fluxo"))
      .finally(() => setLoading(false))
  }, [botId, botName, botChannelId, setNodes, setEdges])

  // ─── Save flow ──────────────────────────────────────────────────────────────

  async function handleSave() {
    const startNode = nodes.find((n) => n.type === "start")
    const channelId = (startNode?.data as Record<string, unknown>)?.channelId as string | undefined
    if (!channelId?.trim()) {
      toast.error("Configure e valide o grupo/canal no nó de Início antes de salvar")
      setSelectedNode(startNode ?? null)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/bots/${botId}/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao salvar fluxo"); return }
      toast.success("Fluxo salvo com sucesso!")
    } catch { toast.error("Erro ao salvar fluxo") }
    finally { setSaving(false) }
  }

  // ─── Edges ──────────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID(), type: "deletable" }, eds)),
    [setEdges]
  )

  // ─── Selection ──────────────────────────────────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), [])
  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)))
      setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev)
    },
    [setNodes]
  )

  // ─── Add node ───────────────────────────────────────────────────────────────

  function addNode(type: NodeType) {
    const sourceNode: Node | undefined = (() => {
      if (selectedNode && selectedNode.type !== "payment") return selectedNode
      const nodesWithEdge = new Set(edges.map((e) => e.source))
      const tail = nodes.filter((n) => n.type !== "payment" && !nodesWithEdge.has(n.id))
      return tail.sort((a, b) => b.position.x - a.position.x)[0]
    })()

    const position = sourceNode
      ? { x: sourceNode.position.x + 320, y: sourceNode.position.y }
      : { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 }

    const newNode: Node = { id: crypto.randomUUID(), type, position, data: getDefaultData(type) }
    const newEdge: Edge | null = sourceNode
      ? { id: crypto.randomUUID(), source: sourceNode.id, target: newNode.id, type: "deletable", sourceHandle: null, targetHandle: null }
      : null

    setNodes((nds) => [...nds, newNode])
    if (newEdge) setEdges((eds) => [...eds, newEdge])
    setSelectedNode(newNode)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const startNode = nodes.find((n) => n.type === "start")
  const startConfigured = !!(startNode?.data as Record<string, unknown>)?.channelId

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => router.push(`/dashboard/bots/${botId}`)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">Editor de Fluxo — {botName}</h1>
          {!startConfigured && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Configure o grupo/canal no nó de Início para começar
            </p>
          )}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 h-8 px-4 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 min-h-0">
        {/* Palette */}
        <div className="w-52 bg-white border-r border-gray-200 p-3 space-y-4 shrink-0 overflow-y-auto">

          <PaletteGroup title="Comunicação">
            <PaletteItem icon={<Type className="h-4 w-4" />} label="Texto"
              color="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" onAdd={() => addNode("text")} />
            <PaletteItem icon={<ImageIcon className="h-4 w-4" />} label="Imagem"
              color="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" onAdd={() => addNode("image")} />
            <PaletteItem icon={<Film className="h-4 w-4" />} label="Vídeo"
              color="border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100" onAdd={() => addNode("video")} />
            <PaletteItem icon={<Music className="h-4 w-4" />} label="Áudio"
              color="border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100" onAdd={() => addNode("audio")} />
            <PaletteItem icon={<FileText className="h-4 w-4" />} label="Arquivo"
              color="border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100" onAdd={() => addNode("file")} />
            <PaletteItem icon={<MoreHorizontal className="h-4 w-4" />} label="Digitando..."
              color="border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100" onAdd={() => addNode("typing")} />
            <PaletteItem icon={<MousePointerClick className="h-4 w-4" />} label="Botão"
              color="border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100" onAdd={() => addNode("button")} />
          </PaletteGroup>

          <PaletteGroup title="Lógica e fluxo">
            <PaletteItem icon={<Clock className="h-4 w-4" />} label="Atraso"
              color="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" onAdd={() => addNode("delay")} />
            <PaletteItem icon={<Timer className="h-4 w-4" />} label="Smart Delay"
              color="border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100" onAdd={() => addNode("smart_delay")} />
          </PaletteGroup>

          <PaletteGroup title="Pagamento">
            <PaletteItem icon={<CreditCard className="h-4 w-4" />} label="Pagamento"
              color="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100" onAdd={() => addNode("payment")} />
          </PaletteGroup>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Dicas</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Clique num nó para editar</li>
              <li>• Arraste as bolinhas para conectar</li>
              <li>• Delete/Backspace remove nó</li>
              <li>• O nó Início não pode ser removido</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} edgeTypes={typedEdgeTypes}
            defaultEdgeOptions={{ type: "deletable" }} fitView
            deleteKeyCode={["Backspace", "Delete"]} className="bg-gray-50">
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
            <Controls className="!bottom-4 !left-4" />
            <MiniMap nodeColor={minimapColor}
              className="!bottom-4 !right-4 !rounded-lg !border !border-gray-200" />
          </ReactFlow>
        </div>

        {/* Config panel */}
        {selectedNode && (
          <NodeConfigPanel node={selectedNode} botId={botId} botName={botName}
            products={products} onUpdate={handleNodeUpdate} onClose={() => setSelectedNode(null)} />
        )}
      </div>
    </div>
  )
}
