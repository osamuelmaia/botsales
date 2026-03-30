"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Loader2, CheckCircle2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string
  email: string
  registrationStep: number
  personType: "INDIVIDUAL" | "COMPANY" | null
  document: string | null
  phone: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
}

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function maskCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

function maskPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
}

function maskZip(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, "$1-$2")
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const [personType, setPersonType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL")
  const [document, setDocument] = useState("")
  const [phone, setPhone] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [street, setStreet] = useState("")
  const [number, setNumber] = useState("")
  const [complement, setComplement] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")

  // ─── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data: UserProfile) => {
        if (data.registrationStep >= 2) setDone(true)
        if (data.personType) setPersonType(data.personType)
        if (data.document) setDocument(
          data.personType === "COMPANY" ? maskCNPJ(data.document) : maskCPF(data.document)
        )
        if (data.phone) setPhone(maskPhone(data.phone))
        if (data.zipCode) setZipCode(maskZip(data.zipCode))
        if (data.street) setStreet(data.street)
        if (data.number) setNumber(data.number)
        if (data.complement) setComplement(data.complement)
        if (data.neighborhood) setNeighborhood(data.neighborhood)
        if (data.city) setCity(data.city)
        if (data.state) setState(data.state)
      })
      .finally(() => setLoading(false))
  }, [])

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personType,
        document: document.replace(/\D/g, ""),
        phone: phone.replace(/\D/g, ""),
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

    await updateSession({ registrationStep: 2 })
    toast.success("Cadastro concluído! Agora você pode receber pagamentos.")
    setDone(true)
    router.refresh()
    router.push("/dashboard")
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Cadastro completo!</h2>
          <p className="text-sm text-gray-500">
            Seus dados estão salvos. Você pode editá-los a qualquer momento.
          </p>
          <button
            onClick={() => setDone(false)}
            className="text-sm text-gray-700 underline"
          >
            Editar dados
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Completar Cadastro</h1>
        <p className="text-gray-500 mt-1">
          Preencha seus dados para começar a receber pagamentos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Dados pessoais ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Dados pessoais
          </h2>

          {/* Tipo de pessoa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de pessoa
            </label>
            <div className="flex gap-3">
              {(["INDIVIDUAL", "COMPANY"] as const).map((type) => (
                <label
                  key={type}
                  className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-md border cursor-pointer text-sm font-medium transition-colors ${
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
                    onChange={() => {
                      setPersonType(type)
                      setDocument("")
                    }}
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
                setDocument(
                  personType === "INDIVIDUAL"
                    ? maskCPF(e.target.value)
                    : maskCNPJ(e.target.value)
                )
              }
              required
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder={personType === "INDIVIDUAL" ? "000.000.000-00" : "00.000.000/0000-00"}
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              required
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        {/* ── Endereço ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Endereço
          </h2>

          {/* CEP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <input
              value={zipCode}
              onChange={(e) => setZipCode(maskZip(e.target.value))}
              required
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="00000-000"
            />
          </div>

          {/* Rua + Número */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="Rua, Av., Travessa..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Centro, Jardim América..."
            />
          </div>

          {/* Cidade + Estado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="São Paulo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
              >
                <option value="">UF</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Submit ──────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando..." : "Salvar e concluir cadastro"}
        </button>
      </form>
    </div>
  )
}
