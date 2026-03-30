"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import { Save, Loader2, MessageSquare, Clock, CreditCard, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

import { StartNode, MessageNode, DelayNode, PaymentNode } from "./nodes"
import { NodeConfigPanel } from "./NodeConfigPanel"

// ─── nodeTypes MUST be defined outside component ──────────────────────────────

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  delay: DelayNode,
  payment: PaymentNode,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  priceInCents: number
}

interface FlowEditorProps {
  botId: string
  botName: string
  products: Product[]
}

// ─── Palette item ─────────────────────────────────────────────────────────────

interface PaletteItemProps {
  icon: React.ReactNode
  label: string
  color: string
  onAdd: () => void
}

function PaletteItem({ icon, label, color, onAdd }: PaletteItemProps) {
  return (
    <button
      onClick={onAdd}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:opacity-80 ${color}`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── FlowEditor ───────────────────────────────────────────────────────────────

export function FlowEditor({ botId, botName, products }: FlowEditorProps) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // ─── Load flow ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/bots/${botId}/flow`)
      .then((r) => r.json())
      .then(({ nodes: n, edges: e }) => {
        setNodes(n)
        setEdges(e)
      })
      .catch(() => toast.error("Erro ao carregar fluxo"))
      .finally(() => setLoading(false))
  }, [botId, setNodes, setEdges])

  // ─── Save flow ──────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/bots/${botId}/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao salvar fluxo")
        return
      }
      toast.success("Fluxo salvo com sucesso!")
    } catch {
      toast.error("Erro ao salvar fluxo")
    } finally {
      setSaving(false)
    }
  }

  // ─── Connect edges ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID() }, eds)),
    [setEdges]
  )

  // ─── Node selection ─────────────────────────────────────────────────────────

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedNode(node),
    []
  )

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  // ─── Update node data ────────────────────────────────────────────────────────

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      )
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      )
    },
    [setNodes]
  )

  // ─── Add nodes from palette ──────────────────────────────────────────────────

  function addNode(type: "message" | "delay" | "payment") {
    const defaultData: Record<string, unknown> =
      type === "message"
        ? { text: "" }
        : type === "delay"
        ? { amount: 1, unit: "hours" }
        : { productId: "", productName: "", channelId: "" }

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position: {
        x: 200 + Math.random() * 100,
        y: 200 + Math.random() * 100,
      },
      data: defaultData,
    }
    setNodes((nds) => [...nds, newNode])
  }

  // ─── Delete key handler ──────────────────────────────────────────────────────

  // ReactFlow's built-in delete (Backspace/Delete) skips nodes with deletable: false

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => router.push(`/dashboard/bots/${botId}`)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            Editor de Fluxo — {botName}
          </h1>
          <p className="text-xs text-gray-400">
            Clique em um nó para configurar • Arraste para mover
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-8 px-4 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 min-h-0">
        {/* Palette */}
        <div className="w-52 bg-white border-r border-gray-200 p-3 space-y-2 shrink-0 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Adicionar nó
          </p>
          <PaletteItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Mensagem"
            color="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
            onAdd={() => addNode("message")}
          />
          <PaletteItem
            icon={<Clock className="h-4 w-4" />}
            label="Aguardar"
            color="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            onAdd={() => addNode("delay")}
          />
          <PaletteItem
            icon={<CreditCard className="h-4 w-4" />}
            label="Pagamento"
            color="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
            onAdd={() => addNode("payment")}
          />

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Dicas
            </p>
            <ul className="text-xs text-gray-500 space-y-1.5">
              <li>• Clique num nó para editar</li>
              <li>• Arraste as bolinhas para conectar</li>
              <li>• Delete/Backspace remove nó selecionado</li>
              <li>• O nó Início não pode ser removido</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-gray-50"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
            <Controls className="!bottom-4 !left-4" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "start") return "#10b981"
                if (n.type === "message") return "#3b82f6"
                if (n.type === "delay") return "#f59e0b"
                return "#8b5cf6"
              }}
              className="!bottom-4 !right-4 !rounded-lg !border !border-gray-200"
            />
          </ReactFlow>
        </div>

        {/* Config panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            products={products}
            onUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}
