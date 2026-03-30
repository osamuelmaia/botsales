export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <p className="text-gray-500 mt-1">Gerencie os produtos que você vende.</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <p className="text-sm text-gray-500 text-center py-8">
          Nenhum produto cadastrado ainda.
        </p>
      </div>
    </div>
  )
}
