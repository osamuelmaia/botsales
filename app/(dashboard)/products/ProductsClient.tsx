"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, Trash2, X, Link2, Check, Package } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { toast } from "sonner"
import { ProductForm, type ProductData } from "@/components/products/ProductForm"
import { fetcher } from "@/lib/fetcher"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const methodLabel: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Cartão" }

function getBillingDescription(product: ProductData): string {
  if (!product.isRecurring) return "Pagamento único"
  const cycles = product.billingCycles ?? 1
  if (product.billingType === "MONTHLY") {
    if (cycles <= 1) return "Assinatura mensal"
    return `Mensal · ${cycles} meses`
  }
  if (cycles <= 1) return "Assinatura anual"
  return `Anual · ${cycles} anos`
}

function CopyCheckoutLink({ productId, shortId }: { productId: string; shortId?: string | null }) {
  const [copied, setCopied] = useState(false)
  const slug = shortId ?? productId
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/checkout/${slug}`
  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      title="Copiar link de venda"
      className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Link copiado!" : "Copiar link de venda"}
    </button>
  )
}

export function ProductsClient() {
  const { data: products = [], mutate } = useSWR<ProductData[]>("/api/products", fetcher)
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ProductData | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  function openCreate() { setEditingProduct(null); setSheetOpen(true) }
  function openEdit(product: ProductData) { setEditingProduct(product); setSheetOpen(true) }

  useEffect(() => {
    if (searchParams.get("create") === "true") openCreate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmDelete() {
    if (!deletingProduct) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) {
        setDeletingProduct(null)
        const msg = res.status === 409
          ? "Esse produto está vinculado a um bot ativo. Desative o bot primeiro e tente de novo."
          : (json.error ?? "Erro ao deletar produto")
        toast.error(msg)
        return
      }
      toast.success("Produto deletado")
      setDeletingProduct(null)
      mutate()
    } catch {
      toast.error("Erro ao deletar produto")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cada produto tem um link de checkout exclusivo — compartilhe e seu bot vende automaticamente."
        actions={
          <Button onClick={openCreate} leftIcon={<Plus />}>
            Novo Produto
          </Button>
        }
      />

      {/* Tip — single line, casual */}
      {products.length > 0 && (
        <p className="text-xs text-gray-400">
          Clique num produto para editar · cada bot aceita até 3 produtos · link de checkout gerado automaticamente
        </p>
      )}

      {/* Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Defina nome, preço e tipo de cobrança — o sistema gera um link de checkout automático para você compartilhar."
            action={
              <Button onClick={openCreate} leftIcon={<Plus />}>
                Criar primeiro produto
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col overflow-hidden cursor-pointer"
            >
              {/* Card body — clicável para editar */}
              <div className="flex-1 p-5 relative" onClick={() => openEdit(product)}>

                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-blue-600" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="font-semibold text-gray-900 text-[15px] leading-snug truncate">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingProduct(product) }}
                    className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0 -mt-0.5"
                    title="Excluir produto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Price + billing */}
                <div className="mb-4">
                  <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                    {formatPrice(product.priceInCents)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{getBillingDescription(product)}</p>
                </div>

                {/* Payment methods */}
                <div className="flex flex-wrap gap-1.5">
                  {product.paymentMethods.map((m) => (
                    <Badge key={m} variant="neutral" size="sm">
                      {methodLabel[m] ?? m}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <CopyCheckoutLink productId={product.id} shortId={product.shortId} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet — criar / editar */}
      <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <Dialog.Title className="text-base font-semibold text-gray-900">
                  {editingProduct ? "Editar produto" : "Novo produto"}
                </Dialog.Title>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingProduct ? "Atualize as informações do produto" : "Preencha os dados do novo produto"}
                </p>
              </div>
              <Dialog.Close className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <ProductForm
                product={editingProduct ?? undefined}
                onSuccess={() => {
                  setSheetOpen(false)
                  mutate()
                  toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!")
                }}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* AlertDialog — confirmar deleção */}
      <AlertDialog.Root open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-lg z-50 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <AlertDialog.Title className="text-base font-semibold text-gray-900">
                  Deletar produto
                </AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-gray-500 mt-1">
                  Tem certeza que deseja deletar{" "}
                  <strong className="text-gray-700">{deletingProduct?.name}</strong>?
                  Esta ação não pode ser desfeita.
                </AlertDialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Cancelar</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={confirmDelete} loading={deleteLoading}>
                  {deleteLoading ? "Deletando..." : "Deletar"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
