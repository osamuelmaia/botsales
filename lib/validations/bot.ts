import { z } from "zod"

export const botCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  token: z.string().min(10, "Token do bot inválido"),
  productIds: z.array(z.string()).max(3, "Máximo de 3 produtos por bot").optional(),
})

export const botUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").optional(),
  token: z.string().min(10, "Token do bot inválido").optional(),
  productIds: z.array(z.string()).max(3, "Máximo de 3 produtos por bot").optional(),
  isActive: z.boolean().optional(),
})

export type BotCreateInput = z.infer<typeof botCreateSchema>
export type BotUpdateInput = z.infer<typeof botUpdateSchema>
