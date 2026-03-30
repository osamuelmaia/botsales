"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as Dialog from "@radix-ui/react-dialog"
import { Loader2, ArrowRight, ArrowLeft, Search } from "lucide-react"

// ─── Country codes ────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: "+55", flag: "🇧🇷", label: "Brasil (+55)" },
  { code: "+1", flag: "🇺🇸", label: "EUA / Canadá (+1)" },
  { code: "+351", flag: "🇵🇹", label: "Portugal (+351)" },
  { code: "+54", flag: "🇦🇷", label: "Argentina (+54)" },
  { code: "+57", flag: "🇨🇴", label: "Colômbia (+57)" },
  { code: "+52", flag: "🇲🇽", label: "México (+52)" },
  { code: "+34", flag: "🇪🇸", label: "Espanha (+34)" },
  { code: "+44", flag: "🇬🇧", label: "Reino Unido (+44)" },
  { code: "+49", flag: "🇩🇪", label: "Alemanha (+49)" },
]

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function maskCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

function maskPhoneBR(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
}

function maskZip(v: string) {
  return v.replace(/\D/g, "").slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, "$1-$2")
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
]

const inputCls =
  "w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"

// ─── Component ────────────────────────────────────────────────────────────────

export function CompleteRegistrationModal() {
  const router = useRouter()
  const numberRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

  // Step 1
  const [personType, setPersonType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL")
  const [document, setDocument] = useState("")
  const [countryCode, setCountryCode] = useState("+55")
  const [phone, setPhone] = useState("")

  // Step 2
  const [zipCode, setZipCode] = useState("")
  const [street, setStreet] = useState("")
  const [number, setNumber] = useState("")
  const [complement, setComplement] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")

  // ─── CEP lookup ─────────────────────────────────────────────────────────────

  async function lookupCep(digits: string) {
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast.error("CEP não encontrado")
        return
      }
      setStreet(data.logradouro ?? "")
      setNeighborhood(data.bairro ?? "")
      setCity(data.localidade ?? "")
      setState(data.uf ?? "")
      // Move focus to number field
      setTimeout(() => numberRef.current?.focus(), 50)
    } catch {
      toast.error("Erro ao buscar CEP")
    } finally {
      setLoadingCep(false)
    }
  }

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskZip(e.target.value)
    setZipCode(masked)
    if (masked.replace(/\D/g, "").length === 8) {
      lookupCep(masked.replace(/\D/g, ""))
    }
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleOpen(v: boolean) {
    setOpen(v)
    if (!v) setStep(1)
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personType,
        document: document.replace(/\D/g, ""),
        phone: `${countryCode}${phone.replace(/\D/g, "")}`,
        zipCode: zipCode.replace(/\D/g, ""),
        street,
        number,
        complement: complement || undefined,
        neighborhood,
        city,
        state,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar cadastro")
      return
    }

    toast.success("Cadastro concluído! Agora você pode receber pagamentos.")
    setOpen(false)
    router.refresh()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Trigger asChild>
        <button className="text-sm font-semibold text-amber-900 underline underline-offset-2 hover:no-underline shrink-0">
          Completar agora →
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Completar Cadastro
              </Dialog.Title>
              <p className="text-xs text-gray-400 mt-0.5">
                Passo {step} de 2 —{" "}
                <span className="font-medium text-gray-500">
                  {step === 1 ? "Dados pessoais" : "Endereço"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-2 w-6 rounded-full bg-gray-900" />
              <span className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? "w-6 bg-gray-900" : "w-2 bg-gray-200"}`} />
            </div>
          </div>

          {/* ── Step 1: Dados pessoais ────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleNext} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">

                {/* Tipo pessoa */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de pessoa
                  </label>
                  <div className="flex gap-3">
                    {(["INDIVIDUAL", "COMPANY"] as const).map((type) => (
                      <label
                        key={type}
                        className={`flex-1 flex items-center justify-center h-10 rounded-md border cursor-pointer text-sm font-medium transition-colors ${
                          personType === type
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-300 text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="personType"
                          value={type}
                          checked={personType === type}
                          onChange={() => { setPersonType(type); setDocument("") }}
                          className="sr-only"
                        />
                        {type === "INDIVIDUAL" ? "Pessoa Física" : "Pessoa Jurídica"}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {personType === "INDIVIDUAL" ? "CPF" : "CNPJ"}
                  </label>
                  <input
                    value={document}
                    onChange={(e) =>
                      setDocument(personType === "INDIVIDUAL" ? maskCPF(e.target.value) : maskCNPJ(e.target.value))
                    }
                    required
                    className={inputCls}
                    placeholder={personType === "INDIVIDUAL" ? "000.000.000-00" : "00.000.000/0000-00"}
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => { setCountryCode(e.target.value); setPhone("") }}
                      className="h-10 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white shrink-0"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      value={phone}
                      onChange={(e) =>
                        setPhone(countryCode === "+55"
                          ? maskPhoneBR(e.target.value)
                          : e.target.value.replace(/\D/g, "").slice(0, 15))
                      }
                      required
                      className={inputCls}
                      placeholder={countryCode === "+55" ? "(00) 00000-0000" : "Número"}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 shrink-0">
                <button
                  type="submit"
                  className="w-full h-10 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
                >
                  Avançar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Endereço ─────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">

                {/* CEP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <div className="relative">
                    <input
                      value={zipCode}
                      onChange={handleZipChange}
                      required
                      maxLength={9}
                      className={inputCls + " pr-9"}
                      placeholder="00000-000"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {loadingCep
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Search className="h-4 w-4" />}
                    </span>
                  </div>
                </div>

                {/* Logradouro + Número */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="Rua, Av., Travessa..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                    <input
                      ref={numberRef}
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="123"
                    />
                  </div>
                </div>

                {/* Complemento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Complemento <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    className={inputCls}
                    placeholder="Apto 101, Bloco B..."
                  />
                </div>

                {/* Bairro */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="Centro, Jardim América..."
                  />
                </div>

                {/* Cidade + UF */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="São Paulo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="w-full h-10 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      <option value="">UF</option>
                      {BR_STATES.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-10 px-4 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingCep}
                  className="flex-1 h-10 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Salvando..." : "Salvar e concluir"}
                </button>
              </div>
            </form>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
