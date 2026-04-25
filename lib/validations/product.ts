import { z } from "zod"

export const productSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
    description: z.string().max(300, "Máximo 300 caracteres").optional(),
    priceInCents: z
      .number({ message: "Informe um preço válido" })
      .int()
      .positive("Preço deve ser maior que zero"),
    paymentMethods: z
      .array(z.enum(["PIX", "CREDIT_CARD"]))
      .min(1, "Selecione ao menos uma forma de pagamento"),
    isRecurring: z.boolean().default(false),
    billingType: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]).nullish(),
    billingCycles: z.number().int().positive().nullish(),
  })
  .refine(
    (d) => !(d.isRecurring && !d.billingType),
    { message: "Selecione o intervalo de cobrança", path: ["billingType"] }
  )
  .refine(
    (d) => !(d.isRecurring && !d.billingCycles),
    { message: "Informe o número de cobranças", path: ["billingCycles"] }
  )

export type ProductInput = z.infer<typeof productSchema>
