import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.name?.split(" ")[0] ?? "usuário"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Olá, {firstName}!</h1>
        <p className="text-gray-500 mt-1">Aqui está o resumo da sua plataforma.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendas hoje", value: "R$ 0,00" },
          { label: "Vendas do mês", value: "R$ 0,00" },
          { label: "Leads ativos", value: "0" },
          { label: "Saldo disponível", value: "R$ 0,00" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <p className="text-sm text-gray-500 text-center py-8">
          Nenhuma venda ainda. Crie um bot e comece a vender!
        </p>
      </div>
    </div>
  )
}
