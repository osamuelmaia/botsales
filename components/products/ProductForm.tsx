"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { Check, ChevronDown, AlertCircle } from "lucide-react"
import * as Checkbox from "@radix-ui/react-checkbox"
import * as Select from "@radix-ui/react-select"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

const formSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
    description: z.string().max(300, "Máximo 300 caracteres").optional(),
    price: z.string().min(1, "Informe o preço"),
    paymentMethods: z
      .array(z.enum(["PIX", "CREDIT_CARD"]))
      .min(1, "Selecione ao menos uma forma de pagamento"),
    isRecurring: z.boolean(),
    billingType: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]).optional(),
  })
  .refine(
    (d) => !(d.isRecurring && !d.billingType),
    { message: "Selecione o intervalo de cobrança", path: ["billingType"] }
  )

type FormValues = z.infer<typeof formSchema>

export interface ProductData {
  id: string
  shortId?: string | null
  name: string
  description?: string | null
  priceInCents: number
  paymentMethods: ("PIX" | "CREDIT_CARD")[]
  isRecurring: boolean
  billingType?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | null
}

interface Props {
  product?: ProductData
  onSuccess: () => void
}

function formatPriceMask(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  const number = parseInt(digits) / 100
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const PAYMENT_OPTIONS = [
  { id: "PIX",         label: "PIX",              desc: "Pagamento instantâneo" },
  { id: "CREDIT_CARD", label: "Cartão de crédito", desc: "Cobrado na fatura do cliente" },
] as const

export function ProductForm({ product, onSuccess }: Props) {
  const [serverError, setServerError] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description ?? "",
          price: formatPriceMask(String(product.priceInCents).padStart(3, "0")),
          paymentMethods: product.paymentMethods,
          isRecurring: product.isRecurring,
          billingType: product.billingType ?? undefined,
        }
      : {
          name: "",
          description: "",
          price: "",
          paymentMethods: [],
          isRecurring: false,
          billingType: undefined,
        },
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = form

  const paymentMethods = watch("paymentMethods") ?? []
  const isRecurring    = watch("isRecurring")
  const description    = watch("description") ?? ""
  const hasAnyMethod   = paymentMethods.length > 0

  async function onSubmit(values: FormValues) {
    setServerError("")

    const priceRaw = values.price.replace(/\./g, "").replace(",", ".")
    const priceInCents = Math.round(parseFloat(priceRaw) * 100)

    if (isNaN(priceInCents) || priceInCents <= 0) {
      form.setError("price", { message: "Informe um preço válido" })
      return
    }

    const body = {
      name: values.name,
      description: values.description || undefined,
      priceInCents,
      paymentMethods: values.paymentMethods,
      isRecurring: values.isRecurring,
      billingType: values.isRecurring ? values.billingType : undefined,
    }

    const url = product ? `/api/products/${product.id}` : "/api/products"
    const method = product ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const json = await res.json()

    if (!res.ok) {
      setServerError(json.error ?? "Erro ao salvar produto")
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Nome */}
      <Input
        {...register("name")}
        label="Nome"
        placeholder="Ex: Pack de fotos, E-book, Mentoria..."
        error={errors.name?.message}
      />

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descrição <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          {...register("description")}
          rows={3}
          maxLength={300}
          placeholder="Descreva seu produto em poucas palavras..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none transition-colors"
        />
        <div className="flex items-center justify-between mt-1">
          {errors.description
            ? <p className="text-xs text-red-600">{errors.description.message}</p>
            : <span />}
          <p className="text-xs text-gray-400 tabular-nums">{description.length}/300</p>
        </div>
      </div>

      {/* Preço */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Preço</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
            R$
          </span>
          <input
            {...register("price")}
            onChange={(e) => {
              const formatted = formatPriceMask(e.target.value)
              form.setValue("price", formatted, { shouldValidate: true })
            }}
            placeholder="0,00"
            inputMode="numeric"
            className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors tabular-nums"
          />
        </div>
        {errors.price && (
          <p className="text-xs text-red-600 mt-1">{errors.price.message}</p>
        )}
      </div>

      {/* Formas de pagamento — visual card selectors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2.5">
          Formas de pagamento
        </label>
        <Controller
          control={control}
          name="paymentMethods"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_OPTIONS.map(({ id, label, desc }) => {
                const checked = field.value?.includes(id) ?? false
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox.Root
                      checked={checked}
                      onCheckedChange={(c) => {
                        const curr = field.value ?? []
                        field.onChange(
                          c ? [...curr, id] : curr.filter((m) => m !== id)
                        )
                      }}
                      className="h-[18px] w-[18px] shrink-0 rounded-md border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center transition-colors"
                    >
                      <Checkbox.Indicator>
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5">{desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        />
        {errors.paymentMethods && (
          <p className="text-xs text-red-600 mt-1.5">{errors.paymentMethods.message}</p>
        )}
      </div>

      {/* Cobrança recorrente — só aparece quando tem método selecionado */}
      {hasAnyMethod && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <Controller
            control={control}
            name="isRecurring"
            render={({ field }) => (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <Checkbox.Root
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(!!c)}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center transition-colors"
                >
                  <Checkbox.Indicator>
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Assinatura recorrente</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    O cliente assina e é cobrado automaticamente no intervalo escolhido — semanal, mensal, trimestral etc.
                  </p>
                </div>
              </label>
            )}
          />

          {isRecurring && (
            <div className="mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Intervalo de cobrança
                </label>
                <Controller
                  control={control}
                  name="billingType"
                  render={({ field }) => (
                    <Select.Root value={field.value} onValueChange={field.onChange}>
                      <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 px-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors">
                        <Select.Value placeholder="Selecione..." />
                        <Select.Icon>
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content
                          className="z-[60] min-w-[8rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                          position="popper"
                          sideOffset={4}
                        >
                          <Select.Viewport className="p-1">
                            {[
                              { value: "WEEKLY",     label: "Semanal" },
                              { value: "MONTHLY",    label: "Mensal" },
                              { value: "QUARTERLY",  label: "Trimestral" },
                              { value: "SEMIANNUAL", label: "Semestral" },
                              { value: "ANNUAL",     label: "Anual" },
                            ].map((opt) => (
                              <Select.Item
                                key={opt.value}
                                value={opt.value}
                                className="flex items-center px-3 py-2 text-sm text-gray-900 cursor-pointer rounded-md outline-none data-[highlighted]:bg-gray-100"
                              >
                                <Select.ItemText>{opt.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  )}
                />
                {errors.billingType && (
                  <p className="text-xs text-red-600 mt-1">{errors.billingType.message}</p>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {serverError && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{serverError}</p>
        </div>
      )}

      <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2">
        {isSubmitting ? "Salvando..." : product ? "Salvar alterações" : "Criar produto"}
      </Button>
    </form>
  )
}
