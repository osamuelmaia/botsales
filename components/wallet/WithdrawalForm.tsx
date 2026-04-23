"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowUpRight, Loader2 } from "lucide-react"

interface BankAccount {
  id: string
  bankCode: string
  agency: string
  account: string
  accountType: "CHECKING" | "SAVINGS"
  holderName: string
  isDefault: boolean
  pixKey: string | null
}

interface Props {
  balanceCents: number
  bankAccounts: BankAccount[]
  onSuccess: () => void
}

const schema = z.object({
  amountCents: z.number().int().positive("Informe um valor válido"),
  bankAccountId: z.string().cuid("Selecione uma conta"),
})

type FormData = z.infer<typeof schema>

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const inputCls =
  "w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
const labelCls = "block text-xs font-medium text-gray-600 mb-1.5"

export function WithdrawalForm({ balanceCents, bankAccounts, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const defaultAccount = bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0]

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bankAccountId: defaultAccount?.id ?? "" },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erro ao solicitar saque"); return }
      toast.success("Saque solicitado com sucesso!")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  if (bankAccounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
        <p className="text-sm text-gray-500">Cadastre uma conta bancária para solicitar saques.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Solicitar saque</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        <div>
          <label className={labelCls}>
            Valor <span className="font-normal text-gray-400">disponível: {formatBRL(balanceCents)}</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">R$</span>
            <input
              type="number"
              step="0.01"
              min="1"
              max={balanceCents / 100}
              placeholder="0,00"
              className={`${inputCls} pl-8`}
              onChange={(e) => {
                const v = Math.round(parseFloat(e.target.value) * 100)
                setValue("amountCents", isNaN(v) ? 0 : v)
              }}
            />
          </div>
          {errors.amountCents && <p className="text-xs text-red-500 mt-1">{errors.amountCents.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Conta destino</label>
          <select {...register("bankAccountId")} className={inputCls}>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankCode} • Ag {a.agency} • Cc {a.account}{a.isDefault ? " (principal)" : ""}
              </option>
            ))}
          </select>
          {errors.bankAccountId && <p className="text-xs text-red-500 mt-1">{errors.bankAccountId.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || balanceCents <= 0}
          className="w-full h-10 rounded-lg bg-[#111627] text-sm text-white font-medium hover:bg-[#1c2434] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-black/10"
        >
          {loading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Solicitando...</>
            : <><ArrowUpRight className="h-3.5 w-3.5" /> Solicitar saque</>
          }
        </button>

        {balanceCents <= 0 && (
          <p className="text-xs text-center text-gray-400">Saldo disponível insuficiente para saque</p>
        )}
      </form>
    </div>
  )
}
