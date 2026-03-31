interface Props {
  feePercent: number
  feeCents: number
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function FeeInfo({ feePercent, feeCents }: Props) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
        Taxas da plataforma
      </p>
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs text-blue-500">Taxa percentual</p>
          <p className="text-sm font-semibold text-blue-800">{feePercent.toFixed(2)}% por venda</p>
        </div>
        <div>
          <p className="text-xs text-blue-500">Taxa fixa</p>
          <p className="text-sm font-semibold text-blue-800">{formatBRL(feeCents)} por venda</p>
        </div>
        <div>
          <p className="text-xs text-blue-500">Exemplo: venda de R$ 100,00</p>
          <p className="text-sm font-semibold text-blue-800">
            Líquido ≈ {formatBRL(Math.round(10000 - (10000 * feePercent) / 100 - feeCents))}
          </p>
        </div>
      </div>
    </div>
  )
}
