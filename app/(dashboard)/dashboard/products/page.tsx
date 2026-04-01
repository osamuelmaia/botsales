import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ProductsClient } from "./ProductsClient"

export default async function ProductsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, description: true, priceInCents: true,
      paymentMethods: true, isRecurring: true, billingType: true, billingCycles: true,
    },
  })

  return <ProductsClient initialProducts={products} />
}
