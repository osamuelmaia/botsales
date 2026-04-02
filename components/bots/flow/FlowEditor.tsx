"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Connection, Edge, Node, NodeTypes, EdgeTypes,
  BackgroundVariant, NodeChange, EdgeChange, useReactFlow, ReactFlowProvider,
  useViewport,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import {
  Save, Loader2, ArrowLeft, AlertCircle,
  Type, Image as ImageIcon, Film, Music, FileText, MoreHorizontal,
  MousePointerClick, Clock, Timer, CreditCard, Undo2, Redo2,
  GitBranch, RefreshCw,
} from "lucide-react"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { useRouter } from "next/navigation"

import {
  StartNode, TextNode, ImageNode, VideoNode, AudioNode, FileNode,
  TypingNode, ButtonNode, DelayNode, SmartDelayNode, PaymentNode,
  RemarketingStartNode, GrantAccessNode, edgeTypes,
} from "./nodes"
import { NodeConfigPanel } from "./NodeConfigPanel"

// ─── nodeTypes / edgeTypes ───────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  start: StartNode, text: TextNode, image: ImageNode, video: VideoNode,
  audio: AudioNode, file: FileNode, typing: TypingNode, button: ButtonNode,
  delay: DelayNode, smart_delay: SmartDelayNode, payment: PaymentNode,
  remarketing_start: RemarketingStartNode, grant_access: GrantAccessNode,
}
const typedEdgeTypes: EdgeTypes = edgeTypes

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product { id: string; name: string; priceInCents: number }
interface FlowEditorProps { botId: string; botName: string; botChannelId?: string | null; channelPermissionError?: string | null; products: Product[]; mode?: "main" | "remarketing" }
type NodeType = "text" | "image" | "video" | "audio" | "file" | "typing" | "button" | "delay" | "smart_delay" | "payment" | "grant_access"
type Snapshot = { nodes: Node[]; edges: Edge[] }

function getDefaultData(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "text": return { content: "" }
    case "image": return { url: "", mediaId: "", caption: "" }
    case "video": return { url: "", mediaId: "", caption: "" }
    case "audio": return { url: "", mediaId: "" }
    case "file": return { url: "", mediaId: "", caption: "" }
    case "typing": return { duration: 3, unit: "seconds" }
    case "button": return { image: "", imageMediaId: "", text: "", buttons: [{ id: crypto.randomUUID(), label: "", mode: "flow", url: "" }] }
    case "delay": return { amount: 5, unit: "seconds" }
    case "smart_delay": return { minAmount: 1, maxAmount: 5, unit: "seconds", showTyping: false }
    case "payment": return { productId: "", productName: "", image: "", imageMediaId: "", text: "", ctaText: "Pagar agora" }
    case "grant_access": return { channelId: "", chatTitle: "", ctaText: "Acessar grupo" }
  }
}

// ─── Palette ──────────────────────────────────────────────────────────────────

function PaletteItem({ icon, label, color, nodeType, onAdd }: { icon: React.ReactNode; label: string; color: string; nodeType: NodeType; onAdd: () => void }) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/reactflow-type", nodeType)
    e.dataTransfer.effectAllowed = "move"
  }
  return (
    <button onClick={onAdd} draggable onDragStart={onDragStart}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:opacity-80 cursor-grab active:cursor-grabbing ${color}`}>
      {icon}{label}
    </button>
  )
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p>{children}</div>
}

function minimapColor(n: Node) {
  const m: Record<string, string> = {
    start: "#10b981", text: "#3b82f6", image: "#0ea5e9", video: "#a855f7",
    audio: "#ec4899", file: "#64748b", typing: "#14b8a6", button: "#6366f1",
    delay: "#f59e0b", smart_delay: "#f97316", payment: "#8b5cf6",
    remarketing_start: "#10b981", grant_access: "#10b981",
  }
  return m[n.type ?? ""] ?? "#94a3b8"
}

// ─── Snap alignment helpers ───────────────────────────────────────────────────

const SNAP_THRESHOLD = 8   // px — detect + snap range

interface GuideLine {
  type: "horizontal" | "vertical"
  pos: number
  start: number
  end: number
}

function getNodeBounds(node: Node) {
  const w = (node.measured as { width?: number })?.width ?? 220
  const h = (node.measured as { height?: number })?.height ?? 80
  return {
    left: node.position.x,
    right: node.position.x + w,
    top: node.position.y,
    bottom: node.position.y + h,
    cx: node.position.x + w / 2,
    cy: node.position.y + h / 2,
    w,
    h,
  }
}

function computeSnap(dragNode: Node, allNodes: Node[]) {
  const db = getNodeBounds(dragNode)
  let snapX: number | null = null, snapY: number | null = null
  let guideX: GuideLine | null = null, guideY: GuideLine | null = null
  let minDx = SNAP_THRESHOLD, minDy = SNAP_THRESHOLD

  for (const node of allNodes) {
    if (node.id === dragNode.id) continue
    const nb = getNodeBounds(node)

    // X: [dragEdge, targetEdge, resulting newPositionX]
    const xs: [number, number, number][] = [
      [db.left, nb.left, nb.left],       [db.left, nb.right, nb.right],
      [db.right, nb.right, nb.right - db.w], [db.right, nb.left, nb.left - db.w],
      [db.cx, nb.cx, nb.cx - db.w / 2],
    ]
    for (const [de, ne, nx] of xs) {
      const d = Math.abs(de - ne)
      if (d < minDx) {
        minDx = d; snapX = nx
        guideX = { type: "vertical", pos: ne, start: Math.min(db.top, nb.top), end: Math.max(db.bottom, nb.bottom) }
      }
    }

    // Y: [dragEdge, targetEdge, resulting newPositionY]
    const ys: [number, number, number][] = [
      [db.top, nb.top, nb.top],          [db.top, nb.bottom, nb.bottom],
      [db.bottom, nb.bottom, nb.bottom - db.h], [db.bottom, nb.top, nb.top - db.h],
      [db.cy, nb.cy, nb.cy - db.h / 2],
    ]
    for (const [de, ne, ny] of ys) {
      const d = Math.abs(de - ne)
      if (d < minDy) {
        minDy = d; snapY = ny
        guideY = { type: "horizontal", pos: ne, start: Math.min(db.left, nb.left), end: Math.max(db.right, nb.right) }
      }
    }
  }

  const guides: GuideLine[] = []
  if (guideX) guides.push(guideX)
  if (guideY) guides.push(guideY)

  return { snapX, snapY, guides }
}

// ─── FlowEditor ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 50

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  )
}

// ─── Node picker items ────────────────────────────────────────────────────────

const NODE_PICKER_ITEMS_MAIN: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: "text", label: "Texto", icon: "T", color: "bg-blue-500" },
  { type: "image", label: "Imagem", icon: "🖼", color: "bg-sky-500" },
  { type: "video", label: "Vídeo", icon: "🎬", color: "bg-purple-500" },
  { type: "audio", label: "Áudio", icon: "🎵", color: "bg-pink-500" },
  { type: "file", label: "Arquivo", icon: "📄", color: "bg-slate-500" },
  { type: "typing", label: "Digitando...", icon: "⋯", color: "bg-teal-500" },
  { type: "button", label: "Botão", icon: "🔘", color: "bg-indigo-500" },
  { type: "delay", label: "Atraso", icon: "⏱", color: "bg-amber-500" },
  { type: "smart_delay", label: "Smart Delay", icon: "⏰", color: "bg-orange-500" },
  { type: "payment", label: "Pagamento", icon: "💳", color: "bg-violet-500" },
  { type: "grant_access", label: "Liberar acesso ao canal", icon: "👥", color: "bg-emerald-600" },
]

const NODE_PICKER_ITEMS_REMARKETING: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: "text", label: "Texto", icon: "T", color: "bg-blue-500" },
  { type: "image", label: "Imagem", icon: "🖼", color: "bg-sky-500" },
  { type: "typing", label: "Digitando...", icon: "⋯", color: "bg-teal-500" },
  { type: "button", label: "Botão", icon: "🔘", color: "bg-indigo-500" },
  { type: "delay", label: "Atraso", icon: "⏱", color: "bg-amber-500" },
  { type: "smart_delay", label: "Smart Delay", icon: "⏰", color: "bg-orange-500" },
  { type: "payment", label: "Pagamento", icon: "💳", color: "bg-violet-500" },
]

function FlowEditorInner({ botId, botName, channelPermissionError, products, mode = "main" }: FlowEditorProps) {
  const [activeMode, setActiveMode] = useState<"main" | "remarketing">(mode)
  const [pendingMode, setPendingMode] = useState<"main" | "remarketing" | null>(null)
  const [showSwitchTabDialog, setShowSwitchTabDialog] = useState(false)
  const isRemarketing = activeMode === "remarketing"
  // Ref so callbacks always see the current mode without stale closure
  const activeModeRef = useRef(activeMode)
  activeModeRef.current = activeMode
  const router = useRouter()
  const reactFlowInstance = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const autoOpenedRef = useRef(false)
  // Stable ref so fitView can be called without adding reactFlowInstance to effect deps
  const reactFlowInstanceRef = useRef(reactFlowInstance)
  reactFlowInstanceRef.current = reactFlowInstance

  // Draft / unsaved changes — tracked per tab so switching is non-destructive
  const [dirtyMain, setDirtyMain] = useState(false)
  const [dirtyRem, setDirtyRem] = useState(false)
  const isDirty = activeMode === "main" ? dirtyMain : dirtyRem
  const isAnyDirty = dirtyMain || dirtyRem
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  // In-memory stash — holds the inactive tab's flow so switching is instant
  const mainStashRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const remStashRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

  // Snap alignment guide lines
  const [guideLines, setGuideLines] = useState<GuideLine[]>([])
  const viewport = useViewport()

  // Handle drop node picker state
  const [nodePicker, setNodePicker] = useState<{ x: number; y: number; screenX: number; screenY: number; sourceNodeId: string; sourceHandle: string | null } | null>(null)
  const connectingRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)
  const pickerJustOpenedRef = useRef(0)

  // ─── Undo / Redo ────────────────────────────────────────────────────────────

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  nodesRef.current = nodes
  edgesRef.current = edges

  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const isRestoringRef = useRef(false)
  const lastPushRef = useRef(0)

  const getSnapshot = useCallback((): Snapshot => ({
    nodes: JSON.parse(JSON.stringify(nodesRef.current)),
    edges: JSON.parse(JSON.stringify(edgesRef.current)),
  }), [])

  const setActiveDirty = useCallback(() => {
    if (activeModeRef.current === "main") setDirtyMain(true)
    else setDirtyRem(true)
  }, [])

  const pushUndo = useCallback(() => {
    if (isRestoringRef.current) return
    setActiveDirty()
    pastRef.current.push(getSnapshot())
    futureRef.current = []
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
  }, [getSnapshot, setActiveDirty])

  const pushUndoDebounced = useCallback(() => {
    if (isRestoringRef.current) return
    const now = Date.now()
    if (now - lastPushRef.current > 400) {
      pushUndo()
    }
    lastPushRef.current = now
  }, [pushUndo])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    setActiveDirty()
    futureRef.current.push(getSnapshot())
    const snapshot = pastRef.current.pop()!
    isRestoringRef.current = true
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setSelectedNode(null)
    isRestoringRef.current = false
  }, [getSnapshot, setNodes, setEdges])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    setActiveDirty()
    pastRef.current.push(getSnapshot())
    const snapshot = futureRef.current.pop()!
    isRestoringRef.current = true
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setSelectedNode(null)
    isRestoringRef.current = false
  }, [getSnapshot, setNodes, setEdges])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo])

  // ─── Warn before leaving with unsaved changes ───────────────────────────────

  useEffect(() => {
    if (!isAnyDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isAnyDirty])

  // ─── Load BOTH flows in parallel (runs once per botId) ──────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/bots/${botId}/flow`).then((r) => r.json()),
      fetch(`/api/bots/${botId}/remarketing-flow`).then((r) => r.json()),
    ])
      .then(([mainData, remData]: [
        { nodes?: Node[]; edges?: Edge[] },
        { remarketingFlow?: { nodes?: Node[]; edges?: Edge[] } }
      ]) => {
        // ── Process main flow ──────────────────────────────────────────────
        const rawMain: Node[] = mainData.nodes ?? []
        const mainEdges: Edge[] = mainData.edges ?? []
        const mainNodes = rawMain.map((node) => {
          if (node.type === "start") return { ...node, data: { ...node.data, botName } }
          if (node.type === "grant_access" && channelPermissionError) {
            return { ...node, data: { ...node.data, _botPermissionError: channelPermissionError } }
          }
          return node
        })
        mainStashRef.current = { nodes: mainNodes, edges: mainEdges }

        // ── Process remarketing flow ───────────────────────────────────────
        const rawRem: Node[] = remData.remarketingFlow?.nodes ?? []
        const remEdges: Edge[] = remData.remarketingFlow?.edges ?? []
        const hasRemStart = rawRem.some((nd) => nd.type === "remarketing_start")
        const remNodes = hasRemStart
          ? rawRem.map((nd) => nd.type === "remarketing_start" ? { ...nd, deletable: false } : nd)
          : [{ id: "remarketing-start", type: "remarketing_start", position: { x: 80, y: 200 }, data: {}, deletable: false } as Node, ...rawRem]
        remStashRef.current = { nodes: remNodes, edges: remEdges }

        // ── Load active tab ────────────────────────────────────────────────
        if (activeModeRef.current === "main") {
          setNodes(mainNodes)
          setEdges(mainEdges)
          // Auto-open first unconfigured grant_access node
          const unconfiguredGrant = mainNodes.find(
            (nd) => nd.type === "grant_access" && !(nd.data as Record<string, unknown>).channelId
          )
          if (unconfiguredGrant && !autoOpenedRef.current) {
            autoOpenedRef.current = true
            setSelectedNode(unconfiguredGrant)
          }
        } else {
          setNodes(remNodes)
          setEdges(remEdges)
        }
      })
      .catch(() => toast.error("Erro ao carregar fluxo"))
      .finally(() => {
        setLoading(false)
        setTimeout(() => reactFlowInstanceRef.current.fitView({ padding: 0.15, duration: 300 }), 80)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, botName, setNodes, setEdges]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save flow ──────────────────────────────────────────────────────────────

  // ─── Instant tab switch (O(1) — no fetch, just swap stash refs) ─────────────

  function doSwitchTab(next: "main" | "remarketing") {
    // Stash current tab
    const currentStash = { nodes: nodesRef.current, edges: edgesRef.current }
    if (activeModeRef.current === "main") mainStashRef.current = currentStash
    else remStashRef.current = currentStash

    // Restore target tab from stash
    const target = next === "main" ? mainStashRef.current : remStashRef.current
    if (target) {
      setNodes(target.nodes)
      setEdges(target.edges)
    }

    // Clear undo history for the new tab (they belong to different flows)
    pastRef.current = []
    futureRef.current = []

    setActiveMode(next)

    // Fit view after React re-renders the new nodes
    setTimeout(() => reactFlowInstanceRef.current.fitView({ padding: 0.15, duration: 300 }), 50)
  }

  function requestSwitchTab(next: "main" | "remarketing") {
    if (next === activeMode) return
    if (isDirty) {
      setPendingMode(next)
      setShowSwitchTabDialog(true)
    } else {
      doSwitchTab(next)
    }
  }

  function confirmSwitchTab() {
    if (!pendingMode) return
    // Discard dirty state for the current tab
    if (activeMode === "main") setDirtyMain(false)
    else setDirtyRem(false)
    doSwitchTab(pendingMode)
    setPendingMode(null)
    setShowSwitchTabDialog(false)
  }

  async function handleSave() {
    if (!isRemarketing) {
      const grantNodes = nodes.filter((n) => n.type === "grant_access")
      const unconfigured = grantNodes.find((n) => !(n.data as Record<string, unknown>).channelId)
      if (unconfigured) {
        toast.error("Configure e valide o grupo/canal no nó 'Liberar acesso ao canal' antes de salvar")
        setSelectedNode(unconfigured)
        return
      }
    }
    setSaving(true)
    try {
      const endpoint = isRemarketing
        ? `/api/bots/${botId}/remarketing-flow`
        : `/api/bots/${botId}/flow`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao salvar fluxo"); return }
      if (isRemarketing) setDirtyRem(false); else setDirtyMain(false)
      toast.success("Fluxo salvo com sucesso!")
    } catch { toast.error("Erro ao salvar fluxo") }
    finally { setSaving(false) }
  }

  // ─── Edges ──────────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      const alreadyConnected = edgesRef.current.some(
        (e) => e.source === connection.source && e.sourceHandle === connection.sourceHandle
      )
      if (alreadyConnected) {
        toast.error("Cada nó só pode ter uma saída. Remova a conexão existente para criar uma nova.")
        return
      }
      pushUndo()
      setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID(), type: "deletable" }, eds))
    },
    [setEdges, pushUndo]
  )

  // ─── Selection ──────────────────────────────────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), [])
  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      pushUndoDebounced()
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)))
      setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev)
    },
    [setNodes, pushUndoDebounced]
  )

  // ─── Intercept node/edge removal for undo ──────────────────────────────────

  const wrappedOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!isRestoringRef.current && changes.some((c) => c.type === "remove")) pushUndo()
      onNodesChange(changes)
    },
    [onNodesChange, pushUndo]
  )

  const wrappedOnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!isRestoringRef.current && changes.some((c) => c.type === "remove")) pushUndo()
      onEdgesChange(changes)
    },
    [onEdgesChange, pushUndo]
  )

  // ─── Node drag: undo + snap alignment ────────────────────────────────────────

  const onNodeDragStart = useCallback(() => { pushUndo() }, [pushUndo])

  const onNodeDrag = useCallback((_: React.MouseEvent, dragNode: Node) => {
    const { snapX, snapY, guides } = computeSnap(dragNode, nodesRef.current)
    setGuideLines(guides)
    if (snapX !== null || snapY !== null) {
      setNodes((nds) => nds.map((n) =>
        n.id === dragNode.id
          ? { ...n, position: { x: snapX ?? n.position.x, y: snapY ?? n.position.y } }
          : n
      ))
    }
  }, [setNodes])

  const onNodeDragStop = useCallback((_: React.MouseEvent, dragNode: Node) => {
    setGuideLines([])
    // Final snap safety net (catches last frame)
    const { snapX, snapY } = computeSnap(dragNode, nodesRef.current)
    if (snapX !== null || snapY !== null) {
      setNodes((nds) => nds.map((n) =>
        n.id === dragNode.id
          ? { ...n, position: { x: snapX ?? n.position.x, y: snapY ?? n.position.y } }
          : n
      ))
    }
  }, [setNodes])

  // ─── Add node ───────────────────────────────────────────────────────────────

  function addNode(type: NodeType) {
    pushUndo()
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

  // ─── Drag-and-drop from palette ──────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData("application/reactflow-type") as NodeType | ""
    if (!type || !reactFlowWrapper.current) return
    const position = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    pushUndo()
    const newNode: Node = { id: crypto.randomUUID(), type, position, data: getDefaultData(type) }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
  }, [reactFlowInstance, pushUndo, setNodes])

  // ─── Handle drop node picker (ManyChat style) ──────────────────────────────

  const onConnectStart = useCallback((_: unknown, params: { nodeId: string | null; handleId: string | null }) => {
    connectingRef.current = { nodeId: params.nodeId ?? "", handleId: params.handleId }
  }, [])

  const onConnectEnd = useCallback((e: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null }) => {
    // isValid=true → dropped on a valid handle → real connection made, skip picker
    if (connectionState?.isValid) {
      connectingRef.current = null
      return
    }

    if (!connectingRef.current || !reactFlowWrapper.current) return

    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX
    const clientY = "clientY" in e ? e.clientY : e.touches[0].clientY

    // Must be inside the canvas
    if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
      connectingRef.current = null
      return
    }

    const flowPos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY })
    setNodePicker({
      x: flowPos.x,
      y: flowPos.y,
      screenX: clientX,
      screenY: clientY,
      sourceNodeId: connectingRef.current.nodeId,
      sourceHandle: connectingRef.current.handleId,
    })
    pickerJustOpenedRef.current = Date.now()
    connectingRef.current = null
  }, [reactFlowInstance])

  const handlePickerSelect = useCallback((type: NodeType) => {
    if (!nodePicker) return
    const alreadyConnected = edgesRef.current.some(
      (e) => e.source === nodePicker.sourceNodeId && e.sourceHandle === nodePicker.sourceHandle
    )
    if (alreadyConnected) {
      toast.error("Cada nó só pode ter uma saída. Remova a conexão existente para criar uma nova.")
      setNodePicker(null)
      return
    }
    pushUndo()
    const newNode: Node = { id: crypto.randomUUID(), type, position: { x: nodePicker.x, y: nodePicker.y }, data: getDefaultData(type) }
    const newEdge: Edge = {
      id: crypto.randomUUID(),
      source: nodePicker.sourceNodeId,
      target: newNode.id,
      type: "deletable",
      sourceHandle: nodePicker.sourceHandle,
      targetHandle: null,
    }
    setNodes((nds) => [...nds, newNode])
    setEdges((eds) => [...eds, newEdge])
    setSelectedNode(newNode)
    setNodePicker(null)
  }, [nodePicker, pushUndo, setNodes, setEdges])

  // ─── Render ─────────────────────────────────────────────────────────────────

  const hasUnconfiguredGrant = !isRemarketing && nodes.some(
    (n) => n.type === "grant_access" && !(n.data as Record<string, unknown>).channelId
  )
  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

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
        <button
          onClick={() => isDirty ? setShowLeaveDialog(true) : router.push(`/dashboard/bots`)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => requestSwitchTab("main")}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors ${
              activeMode === "main"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Fluxo Principal
          </button>
          <button
            onClick={() => requestSwitchTab("remarketing")}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors ${
              activeMode === "remarketing"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Remarketing
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{botName}</p>
          {hasUnconfiguredGrant && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />Configure o grupo/canal no nó &quot;Liberar acesso ao canal&quot;
            </p>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)"
            className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)"
            className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {isDirty && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            Não salvo
          </span>
        )}

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 h-8 px-4 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 min-h-0">
        {/* Palette */}
        <div className="w-64 bg-white border-r border-gray-200 p-3 space-y-4 shrink-0 overflow-y-auto">
          <PaletteGroup title="Comunicação">
            <PaletteItem icon={<Type className="h-4 w-4" />} label="Texto" nodeType="text" color="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" onAdd={() => addNode("text")} />
            <PaletteItem icon={<ImageIcon className="h-4 w-4" />} label="Imagem" nodeType="image" color="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" onAdd={() => addNode("image")} />
            <PaletteItem icon={<Film className="h-4 w-4" />} label="Vídeo" nodeType="video" color="border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100" onAdd={() => addNode("video")} />
            <PaletteItem icon={<Music className="h-4 w-4" />} label="Áudio" nodeType="audio" color="border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100" onAdd={() => addNode("audio")} />
            <PaletteItem icon={<FileText className="h-4 w-4" />} label="Arquivo" nodeType="file" color="border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100" onAdd={() => addNode("file")} />
            <PaletteItem icon={<MoreHorizontal className="h-4 w-4" />} label="Digitando..." nodeType="typing" color="border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100" onAdd={() => addNode("typing")} />
            <PaletteItem icon={<MousePointerClick className="h-4 w-4" />} label="Botão" nodeType="button" color="border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100" onAdd={() => addNode("button")} />
          </PaletteGroup>
          <PaletteGroup title="Lógica e fluxo">
            <PaletteItem icon={<Clock className="h-4 w-4" />} label="Atraso" nodeType="delay" color="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" onAdd={() => addNode("delay")} />
            <PaletteItem icon={<Timer className="h-4 w-4" />} label="Smart Delay" nodeType="smart_delay" color="border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100" onAdd={() => addNode("smart_delay")} />
          </PaletteGroup>
          {!isRemarketing && (
            <PaletteGroup title="Pagamento e acesso">
              <PaletteItem icon={<CreditCard className="h-4 w-4" />} label="Pagamento" nodeType="payment" color="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100" onAdd={() => addNode("payment")} />
              <PaletteItem icon={<GitBranch className="h-4 w-4" />} label="Liberar acesso ao canal" nodeType="grant_access" color="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" onAdd={() => addNode("grant_access")} />
            </PaletteGroup>
          )}
          {isRemarketing && (
            <PaletteGroup title="Ação">
              <PaletteItem icon={<CreditCard className="h-4 w-4" />} label="Pagamento" nodeType="payment" color="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100" onAdd={() => addNode("payment")} />
            </PaletteGroup>
          )}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Dicas</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Clique num nó para editar</li>
              <li>• Arraste as bolinhas para conectar</li>
              <li>• Delete/Backspace remove nó</li>
              <li>• Ctrl+Z desfaz, Ctrl+Shift+Z refaz</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}
          onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow nodes={nodes} edges={edges}
            onNodesChange={wrappedOnNodesChange} onEdgesChange={wrappedOnEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick}
            onPaneClick={() => { onPaneClick(); if (Date.now() - pickerJustOpenedRef.current > 200) setNodePicker(null) }}
            onNodeDragStart={onNodeDragStart} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop}
            onConnectStart={onConnectStart} onConnectEnd={onConnectEnd}
            nodeTypes={nodeTypes} edgeTypes={typedEdgeTypes}
            defaultEdgeOptions={{ type: "deletable" }} fitView
            deleteKeyCode={["Backspace", "Delete"]} className="bg-gray-50">
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
            <Controls className="!bottom-4 !left-4" />
            <MiniMap nodeColor={minimapColor} className="!bottom-4 !right-4 !rounded-lg !border !border-gray-200" />
          </ReactFlow>

          {/* Snap alignment guide lines */}
          {guideLines.map((line, i) =>
            line.type === "vertical" ? (
              <div key={`vg-${i}`} className="pointer-events-none absolute" style={{
                left: line.pos * viewport.zoom + viewport.x,
                top: line.start * viewport.zoom + viewport.y,
                width: 1,
                height: (line.end - line.start) * viewport.zoom,
                backgroundColor: "rgba(99,102,241,0.45)",
                zIndex: 1000,
              }} />
            ) : (
              <div key={`hg-${i}`} className="pointer-events-none absolute" style={{
                left: line.start * viewport.zoom + viewport.x,
                top: line.pos * viewport.zoom + viewport.y,
                width: (line.end - line.start) * viewport.zoom,
                height: 1,
                backgroundColor: "rgba(99,102,241,0.45)",
                zIndex: 1000,
              }} />
            )
          )}

          {/* Node picker popup (ManyChat style) */}
          {nodePicker && (() => {
            const sourceNode = nodes.find((n) => n.id === nodePicker.sourceNodeId)
            const isFromPaymentApproved =
              sourceNode?.type === "payment" && nodePicker.sourceHandle === "approved"
            const pickerItems = isRemarketing ? NODE_PICKER_ITEMS_REMARKETING : NODE_PICKER_ITEMS_MAIN
            const grantItem = pickerItems.find((i) => i.type === "grant_access")
            const otherItems = pickerItems.filter((i) => i.type !== "grant_access")
            return (
              <div
                className="absolute z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-2 w-52 max-h-80 overflow-y-auto"
                style={{ left: nodePicker.screenX - (reactFlowWrapper.current?.getBoundingClientRect().left ?? 0), top: nodePicker.screenY - (reactFlowWrapper.current?.getBoundingClientRect().top ?? 0) }}
              >
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">Adicionar nó</p>
                {/* Recommended: grant_access when coming from payment "approved" handle */}
                {isFromPaymentApproved && grantItem && (
                  <>
                    <button onClick={() => handlePickerSelect(grantItem.type as NodeType)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors mb-0.5">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] ${grantItem.color}`}>{grantItem.icon}</span>
                      <span className="flex-1 truncate">{grantItem.label}</span>
                      <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">Recomendado</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}
                {otherItems.map((item) => (
                  <button key={item.type} onClick={() => handlePickerSelect(item.type as NodeType)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] ${item.color}`}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Config panel */}
        {selectedNode && (
          <NodeConfigPanel node={selectedNode} botId={botId} botName={botName}
            products={products} onUpdate={handleNodeUpdate} onClose={() => setSelectedNode(null)} />
        )}
      </div>

      {/* Switch tab confirmation dialog */}
      <AlertDialog.Root open={showSwitchTabDialog} onOpenChange={setShowSwitchTabDialog}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=open]:fade-in" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95">
            <AlertDialog.Title className="text-lg font-semibold text-gray-900">
              Alterações não salvas
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-gray-600">
              Você tem alterações não salvas nesta aba. Trocar de aba descartará o progresso atual.
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Continuar editando
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={confirmSwitchTab}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Trocar e descartar
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Leave confirmation dialog */}
      <AlertDialog.Root open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=open]:fade-in" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95">
            <AlertDialog.Title className="text-lg font-semibold text-gray-900">
              Alterações não salvas
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-gray-600">
              Você tem alterações que ainda não foram salvas. Se sair agora, todo o progresso será perdido. Deseja sair mesmo assim?
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Continuar editando
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => router.push(`/dashboard/bots`)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Sair sem salvar
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
