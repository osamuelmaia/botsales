import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export default function SucessoPage() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
      <div className="flex items-center justify-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Pagamento confirmado!</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seu pagamento foi processado com sucesso.
          Em instantes você receberá as instruções de acesso.
        </p>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
        <p className="text-sm text-green-800 font-medium">
          Verifique seu Telegram para o link de acesso ao grupo.
        </p>
      </div>

      <p className="text-xs text-gray-400">
        Dúvidas? Entre em contato com o vendedor pelo Telegram.
      </p>

      <Link
        href="/"
        className="inline-block text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
