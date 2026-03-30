import { z } from "zod"

export const profileSchema = z.object({
  personType: z.enum(["INDIVIDUAL", "COMPANY"], {
    message: "Selecione o tipo de pessoa",
  }),
  document: z
    .string()
    .min(11, "Documento inválido")
    .max(18, "Documento inválido"),
  phone: z.string().min(8, "Telefone inválido").max(20, "Telefone inválido"),
  zipCode: z.string().min(8, "CEP inválido").max(9, "CEP inválido"),
  street: z.string().min(2, "Informe o logradouro"),
  number: z.string().min(1, "Informe o número"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Informe o bairro"),
  city: z.string().min(2, "Informe a cidade"),
  state: z.string().length(2, "UF deve ter 2 letras"),
})

export type ProfileInput = z.infer<typeof profileSchema>
