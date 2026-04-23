interface Props {
  feePercent: number
  feeCents: number
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function FeeInfo({ feePercent, feeCents }: Props) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex flex-wrap items-center gap-6">
      <div>
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Taxas da plataforma</p>
        <p className="text-xs text-blue-400">Descontadas automaticamente em cada venda</p>
      </div>
      <div className="flex gap-6 ml-auto">
        <div>
          <p className="text-xs text-blue-400">Taxa percentual</p>
          <p className="text-sm font-semibold text-blue-700 tabular-nums">{feePercent.toFixed(2)}% por venda</p>
        </div>
        <div>
          <p className="text-xs text-blue-400">Taxa fixa</p>
          <p className="text-sm font-semibold text-blue-700 tabular-nums">{formatBRL(feeCents)} por venda</p>
        </div>
      </div>
    </div>
  )
}
