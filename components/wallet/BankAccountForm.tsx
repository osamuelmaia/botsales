"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Building2, X, Info } from "lucide-react"

// ─── Banks ────────────────────────────────────────────────────────────────────

const BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "003", name: "Banco da Amazônia" },
  { code: "004", name: "Banco do Nordeste do Brasil" },
  { code: "021", name: "Banestes" },
  { code: "033", name: "Santander" },
  { code: "037", name: "Banco do Estado do Pará" },
  { code: "041", name: "Banrisul" },
  { code: "047", name: "Banco do Estado de Sergipe" },
  { code: "070", name: "BRB - Banco de Brasília" },
  { code: "077", name: "Banco Inter" },
  { code: "082", name: "Banco Topázio" },
  { code: "084", name: "Uniprime Norte do Paraná" },
  { code: "085", name: "Cooperativa Central de Crédito Noroeste" },
  { code: "099", name: "Uniprime Central" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "133", name: "Cresol" },
  { code: "136", name: "Unicred" },
  { code: "197", name: "Stone Pagamentos" },
  { code: "208", name: "BTG Pactual" },
  { code: "212", name: "Banco Original" },
  { code: "218", name: "Banco BS2" },
  { code: "237", name: "Bradesco" },
  { code: "246", name: "Banco ABC Brasil" },
  { code: "260", name: "Nubank" },
  { code: "290", name: "PagSeguro" },
  { code: "318", name: "Banco BMG" },
  { code: "323", name: "Mercado Pago" },
  { code: "336", name: "C6 Bank" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "348", name: "Banco XP" },
  { code: "380", name: "PicPay" },
  { code: "389", name: "Banco Mercantil do Brasil" },
  { code: "394", name: "Banco Bradesco Financiamentos" },
  { code: "403", name: "Cora" },
  { code: "413", name: "Banco BV" },
  { code: "422", name: "Banco Safra" },
  { code: "456", name: "Banco MUFG Brasil" },
  { code: "461", name: "Asaas IP" },
  { code: "477", name: "Citibank" },
  { code: "487", name: "Deutsche Bank" },
  { code: "505", name: "Banco Credit Suisse" },
  { code: "604", name: "Banco Industrial" },
  { code: "611", name: "Banco Paulista" },
  { code: "613", name: "Banco Omni" },
  { code: "623", name: "Banco Pan" },
  { code: "633", name: "Banco Rendimento" },
  { code: "637", name: "Banco Sofisa" },
  { code: "643", name: "Banco Pine" },
  { code: "655", name: "Neon" },
  { code: "707", name: "Banco Daycoval" },
  { code: "739", name: "Banco Cetelem" },
  { code: "741", name: "Banco Ribeirão Preto" },
  { code: "745", name: "Citibank S.A." },
  { code: "746", name: "Banco Modal" },
  { code: "747", name: "Banco Rabobank Internacional" },
  { code: "748", name: "Sicredi" },
  { code: "751", name: "Scotiabank" },
  { code: "752", name: "BNP Paribas" },
  { code: "755", name: "Bank of America Merrill Lynch" },
  { code: "756", name: "Sicoob" },
]

// ─── Document mask ─────────────────────────────────────────────────────────────

function applyDocumentMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

function validateDocument(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11) return validateCPF(digits)
  if (digits.length === 14) return validateCNPJ(digits)
  return false
}

function validateCPF(digits: string): boolean {
  if (/^(\d)\1{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  if (rem !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  return rem === parseInt(digits[10])
}

function validateCNPJ(digits: string): boolean {
  if (/^(\d)\1{13}$/.test(digits)) return false
  const calc = (d: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(d[i]) * w, 0)
  const mod = (n: number) => { const r = n % 11; return r < 2 ? 0 : 11 - r }
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    mod(calc(digits, w1)) === parseInt(digits[12]) &&
    mod(calc(digits, w2)) === parseInt(digits[13])
  )
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  bankCode: z.string().min(1, "Selecione um banco"),
  agency: z.string().min(1, "Informe a agência").max(10),
  account: z.string().min(1, "Informe a conta").max(20),
  accountType: z.enum(["CHECKING", "SAVINGS"]),
  holderName: z.string().min(2, "Informe o nome do titular"),
  document: z
    .string()
    .min(14, "Informe o CPF ou CNPJ")
    .refine((v) => validateDocument(v), { message: "CPF ou CNPJ inválido" }),
  pixKey: z.string().min(1, "Informe a chave PIX"),
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

// ─── Component ────────────────────────────────────────────────────────────────

export function BankAccountForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [docDisplay, setDocDisplay] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: "CHECKING", isDefault: true },
  })

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyDocumentMask(e.target.value)
    setDocDisplay(masked)
    setValue("document", masked, { shouldValidate: false })
  }

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
        toast.error(
          typeof json.error === "string" ? json.error : "Erro ao salvar conta"
        )
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
              <option value="">Selecione o banco...</option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
            {errors.bankCode && (
              <p className="text-xs text-red-500 mt-1">{errors.bankCode.message}</p>
            )}
          </div>

          {/* Agency */}
          <div>
            <label className={labelCls}>Agência (sem dígito)</label>
            <input
              {...register("agency")}
              placeholder="0001"
              className={inputCls}
            />
            {errors.agency && (
              <p className="text-xs text-red-500 mt-1">{errors.agency.message}</p>
            )}
          </div>

          {/* Account */}
          <div>
            <label className={labelCls}>Conta (com dígito)</label>
            <input
              {...register("account")}
              placeholder="12345-6"
              className={inputCls}
            />
            {errors.account && (
              <p className="text-xs text-red-500 mt-1">{errors.account.message}</p>
            )}
          </div>

          {/* Account type */}
          <div>
            <label className={labelCls}>Tipo de conta</label>
            <select {...register("accountType")} className={inputCls}>
              <option value="CHECKING">Conta Corrente</option>
              <option value="SAVINGS">Conta Poupança</option>
            </select>
          </div>

          {/* Holder name */}
          <div>
            <label className={labelCls}>Nome do titular</label>
            <input
              {...register("holderName")}
              placeholder="Nome completo"
              className={inputCls}
            />
            {errors.holderName && (
              <p className="text-xs text-red-500 mt-1">{errors.holderName.message}</p>
            )}
          </div>

          {/* Document — CPF/CNPJ with mask */}
          <div className="sm:col-span-2">
            <label className={labelCls}>CPF / CNPJ do titular</label>
            <input
              type="text"
              inputMode="numeric"
              value={docDisplay}
              onChange={handleDocChange}
              placeholder="000.000.000-00"
              maxLength={18}
              className={inputCls}
            />
            {/* hidden field for RHF */}
            <input type="hidden" {...register("document")} />
            {errors.document && (
              <p className="text-xs text-red-500 mt-1">{errors.document.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Digite CPF (11 dígitos) — a máscara muda automaticamente para CNPJ (14 dígitos)
            </p>
          </div>

          {/* PIX key */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Chave PIX</label>
            <input
              {...register("pixKey")}
              placeholder="CPF, CNPJ, e-mail, celular (+55...) ou chave aleatória"
              className={inputCls}
            />
            {errors.pixKey && (
              <p className="text-xs text-red-500 mt-1">{errors.pixKey.message}</p>
            )}
            {/* Warning */}
            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <Info className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                A chave PIX informada deve pertencer <strong>exatamente à mesma conta bancária</strong> cadastrada acima. Saques serão processados via PIX para essa chave — chaves de contas diferentes serão recusadas.
              </p>
            </div>
          </div>
        </div>

        {/* Default checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register("isDefault")}
            className="rounded border-gray-300 text-gray-900"
          />
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
