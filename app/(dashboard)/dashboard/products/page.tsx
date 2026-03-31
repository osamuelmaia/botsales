"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, X, Link2, Check } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { toast } from "sonner"
import { ProductForm, type ProductData } from "@/components/products/ProductForm"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

const methodLabel: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão",
}

function CopyCheckoutLink({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/checkout/${productId}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copiar link de checkout"
      className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-gray-200 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Link2 className="h-3 w-3" />}
      {copied ? "Copiado!" : "Link"}
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-5 bg-gray-200 rounded-full w-12" />
        <div className="h-5 bg-gray-200 rounded-full w-16" />
      </div>
      <div className="h-6 bg-gray-200 rounded w-1/3" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ProductData | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/products")
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Erro ao carregar produtos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  function openCreate() {
    setEditingProduct(null)
    setSheetOpen(true)
  }

  function openEdit(product: ProductData) {
    setEditingProduct(product)
    setSheetOpen(true)
  }

  async function confirmDelete() {
    if (!deletingProduct) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao deletar produto")
        return
      }
      toast.success("Produto deletado")
      setDeletingProduct(null)
      fetchProducts()
    } catch {
      toast.error("Erro ao deletar produto")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 mt-1">Gerencie os produtos que você vende.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 flex flex-col items-center gap-4">
          <p className="text-gray-400 text-sm">Nenhum produto cadastrado ainda.</p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro produto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4"
            >
              {/* Name + actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(product)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingProduct(product)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Deletar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <p className="text-2xl font-bold text-gray-900 leading-none">
                {formatPrice(product.priceInCents)}
              </p>

              {/* Badges + link */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <div className="flex flex-wrap gap-1.5">
                  {product.paymentMethods.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                    >
                      {methodLabel[m] ?? m}
                    </span>
                  ))}
                  {product.isRecurring && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                      {product.billingType === "MONTHLY" ? "Mensal" : "Anual"}
                      {product.billingCycles ? ` · ${product.billingCycles}x` : ""}
                    </span>
                  )}
                </div>
                <CopyCheckoutLink productId={product.id!} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet — criar / editar */}
      <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {editingProduct ? "Editar produto" : "Novo produto"}
              </Dialog.Title>
              <Dialog.Close className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <ProductForm
                product={editingProduct ?? undefined}
                onSuccess={() => {
                  setSheetOpen(false)
                  fetchProducts()
                  toast.success(
                    editingProduct ? "Produto atualizado!" : "Produto criado!"
                  )
                }}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* AlertDialog — confirmar deleção */}
      <AlertDialog.Root
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-xl z-50 p-6">
            <AlertDialog.Title className="text-lg font-semibold text-gray-900">
              Deletar produto
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-gray-500 mt-2">
              Tem certeza que deseja deletar{" "}
              <strong className="text-gray-700">{deletingProduct?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? "Deletando..." : "Deletar"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
