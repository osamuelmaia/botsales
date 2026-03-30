"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { Loader2, Check, ChevronDown } from "lucide-react"
import * as Checkbox from "@radix-ui/react-checkbox"
import * as Select from "@radix-ui/react-select"

// ─── Client-side form schema (price as string, billingCycles as string) ───────

const formSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
    description: z.string().max(300, "Máximo 300 caracteres").optional(),
    price: z.string().min(1, "Informe o preço"),
    paymentMethods: z
      .array(z.enum(["PIX", "CREDIT_CARD"]))
      .min(1, "Selecione ao menos uma forma de pagamento"),
    isRecurring: z.boolean(),
    billingType: z.enum(["MONTHLY", "ANNUAL"]).optional(),
    billingCycles: z.string().optional(),
  })
  .refine(
    (d) => !(d.isRecurring && !d.billingType),
    { message: "Selecione o tipo de cobrança", path: ["billingType"] }
  )
  .refine(
    (d) => {
      if (d.isRecurring) {
        const n = parseInt(d.billingCycles ?? "")
        return !isNaN(n) && n > 0
      }
      return true
    },
    { message: "Informe um número de ciclos válido", path: ["billingCycles"] }
  )

type FormValues = z.infer<typeof formSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductData {
  id: string
  name: string
  description?: string | null
  priceInCents: number
  paymentMethods: ("PIX" | "CREDIT_CARD")[]
  isRecurring: boolean
  billingType?: "MONTHLY" | "ANNUAL" | null
  billingCycles?: number | null
}

interface Props {
  product?: ProductData
  onSuccess: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ product, onSuccess }: Props) {
  const [serverError, setServerError] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description ?? "",
          price: (product.priceInCents / 100).toFixed(2).replace(".", ","),
          paymentMethods: product.paymentMethods,
          isRecurring: product.isRecurring,
          billingType: product.billingType ?? undefined,
          billingCycles: product.billingCycles?.toString() ?? "",
        }
      : {
          name: "",
          description: "",
          price: "",
          paymentMethods: [],
          isRecurring: false,
          billingType: undefined,
          billingCycles: "",
        },
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const paymentMethods = watch("paymentMethods") ?? []
  const isRecurring = watch("isRecurring")
  const description = watch("description") ?? ""
  const hasAnyMethod = paymentMethods.length > 0

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
      billingCycles:
        values.isRecurring && values.billingCycles
          ? parseInt(values.billingCycles)
          : undefined,
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input
          {...register("name")}
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          placeholder="Ex: Curso de Marketing Digital"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          {...register("description")}
          rows={3}
          maxLength={300}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
          placeholder="Descreva seu produto..."
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {description.length}/300
        </p>
        {errors.description && (
          <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Preço */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Preço</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
            R$
          </span>
          <input
            {...register("price")}
            className="w-full h-10 rounded-md border border-gray-300 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>
        {errors.price && (
          <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>
        )}
      </div>

      {/* Formas de pagamento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Formas de pagamento
        </label>

        <Controller
          control={control}
          name="paymentMethods"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              {/* PIX */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox.Root
                  checked={field.value?.includes("PIX")}
                  onCheckedChange={(checked) => {
                    const curr = field.value ?? []
                    field.onChange(
                      checked ? [...curr, "PIX"] : curr.filter((m) => m !== "PIX")
                    )
                  }}
                  className="h-4 w-4 shrink-0 rounded border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center"
                >
                  <Checkbox.Indicator>
                    <Check className="h-3 w-3 text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm text-gray-700">PIX</span>
              </label>

              {/* Cartão de crédito */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox.Root
                  checked={field.value?.includes("CREDIT_CARD")}
                  onCheckedChange={(checked) => {
                    const curr = field.value ?? []
                    field.onChange(
                      checked
                        ? [...curr, "CREDIT_CARD"]
                        : curr.filter((m) => m !== "CREDIT_CARD")
                    )
                  }}
                  className="h-4 w-4 shrink-0 rounded border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center"
                >
                  <Checkbox.Indicator>
                    <Check className="h-3 w-3 text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm text-gray-700">Cartão de Crédito</span>
              </label>
            </div>
          )}
        />

        {errors.paymentMethods && (
          <p className="text-red-500 text-xs mt-1">{errors.paymentMethods.message}</p>
        )}

        {/* Recorrência — aparece quando qualquer método estiver selecionado */}
        {hasAnyMethod && (
          <div className="mt-3 ml-7 pl-4 border-l-2 border-gray-100 flex flex-col gap-3">
            <Controller
              control={control}
              name="isRecurring"
              render={({ field }) => (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Checkbox.Root
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                    className="h-4 w-4 shrink-0 rounded border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 flex items-center justify-center"
                  >
                    <Checkbox.Indicator>
                      <Check className="h-3 w-3 text-white" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="text-sm text-gray-700">Cobrança recorrente</span>
                </label>
              )}
            />

            {isRecurring && (
              <div className="flex flex-col gap-3">
                {/* Periodicidade */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Periodicidade
                  </label>
                  <Controller
                    control={control}
                    name="billingType"
                    render={({ field }) => (
                      <Select.Root value={field.value} onValueChange={field.onChange}>
                        <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 px-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                          <Select.Value placeholder="Selecione..." />
                          <Select.Icon>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            className="z-[60] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md"
                            position="popper"
                            sideOffset={4}
                          >
                            <Select.Viewport className="p-1">
                              <Select.Item
                                value="MONTHLY"
                                className="flex items-center px-3 py-2 text-sm text-gray-900 cursor-pointer rounded outline-none data-[highlighted]:bg-gray-100"
                              >
                                <Select.ItemText>Mensal</Select.ItemText>
                              </Select.Item>
                              <Select.Item
                                value="ANNUAL"
                                className="flex items-center px-3 py-2 text-sm text-gray-900 cursor-pointer rounded outline-none data-[highlighted]:bg-gray-100"
                              >
                                <Select.ItemText>Anual</Select.ItemText>
                              </Select.Item>
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    )}
                  />
                  {errors.billingType && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.billingType.message}
                    </p>
                  )}
                </div>

                {/* Ciclos */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Número de ciclos
                  </label>
                  <input
                    {...register("billingCycles")}
                    type="number"
                    min="1"
                    className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Ex: 12"
                  />
                  {errors.billingCycles && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.billingCycles.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {serverError && (
        <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-md">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-10 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors mt-2"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting
          ? "Salvando..."
          : product
          ? "Salvar alterações"
          : "Criar produto"}
      </button>
    </form>
  )
}
