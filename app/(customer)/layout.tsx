import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Minhas Assinaturas",
  description: "Gerencie suas assinaturas e pagamentos",
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return children
}
