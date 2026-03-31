"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Building2, X } from "lucide-react"

const BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "077", name: "Inter" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "208", name: "BTG Pactual" },
  { code: "237", name: "Bradesco" },
  { code: "260", name: "Nu Pagamentos (Nubank)" },
  { code: "341", name: "Itaú" },
  { code: "336", name: "C6 Bank" },
  { code: "380", name: "PicPay" },
  { code: "403", name: "Cora" },
  { code: "422", name: "Safra" },
  { code: "655", name: "Neon" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
]

const schema = z.object({
  bankCode: z.string().min(1, "Selecione um banco"),
  agency: z.string().min(1, "Informe a agência").max(10),
  account: z.string().min(1, "Informe a conta").max(20),
  accountType: z.enum(["CHECKING", "SAVINGS"]),
  holderName: z.string().min(2, "Informe o nome do titular"),
  document: z.string().min(11, "Informe o CPF/CNPJ"),
  pixKey: z.string().max(100).optional(),
  isDefault: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

const inputCls =
  "w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

const labelCls = "block text-xs font-medium text-gray-600 mb-1"

export function BankAccountForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: "CHECKING", isDefault: true },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao salvar conta")
        return
      }
      toast.success("Conta bancária cadastrada!")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Nova conta bancária</h3>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bank */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Banco</label>
            <select {...register("bankCode")} className={inputCls}>
              <option value="">Selecione...</option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
            {errors.bankCode && <p className="text-xs text-red-500 mt-1">{errors.bankCode.message}</p>}
          </div>

          {/* Agency */}
          <div>
            <label className={labelCls}>Agência (sem dígito)</label>
            <input {...register("agency")} placeholder="0001" className={inputCls} />
            {errors.agency && <p className="text-xs text-red-500 mt-1">{errors.agency.message}</p>}
          </div>

          {/* Account */}
          <div>
            <label className={labelCls}>Conta (com dígito)</label>
            <input {...register("account")} placeholder="12345-6" className={inputCls} />
            {errors.account && <p className="text-xs text-red-500 mt-1">{errors.account.message}</p>}
          </div>

          {/* Account type */}
          <div>
            <label className={labelCls}>Tipo de conta</label>
            <select {...register("accountType")} className={inputCls}>
              <option value="CHECKING">Conta Corrente</option>
              <option value="SAVINGS">Conta Poupança</option>
            </select>
          </div>

          {/* PIX key */}
          <div>
            <label className={labelCls}>Chave PIX (opcional)</label>
            <input {...register("pixKey")} placeholder="CPF, email, celular ou chave aleatória" className={inputCls} />
          </div>

          {/* Holder name */}
          <div>
            <label className={labelCls}>Nome do titular</label>
            <input {...register("holderName")} placeholder="Nome completo" className={inputCls} />
            {errors.holderName && <p className="text-xs text-red-500 mt-1">{errors.holderName.message}</p>}
          </div>

          {/* Document */}
          <div>
            <label className={labelCls}>CPF / CNPJ</label>
            <input {...register("document")} placeholder="000.000.000-00" className={inputCls} />
            {errors.document && <p className="text-xs text-red-500 mt-1">{errors.document.message}</p>}
          </div>
        </div>

        {/* Default checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register("isDefault")} className="rounded border-gray-300 text-gray-900" />
          <span className="text-sm text-gray-600">Definir como conta principal</span>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 h-9 rounded-lg bg-gray-900 text-sm text-white font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Salvando..." : "Salvar conta"}
          </button>
        </div>
      </form>
    </div>
  )
}
