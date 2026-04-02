import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FlowEditor } from "@/components/bots/flow/FlowEditor"

interface Props {
  params: { id: string }
}

export default async function BotFlowPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      botProducts: {
        include: { product: true },
        orderBy: { position: "asc" },
      },
    },
  })

  if (!bot) notFound()

  const products = bot.botProducts.map((bp) => ({
    id: bp.product.id,
    name: bp.product.name,
    priceInCents: bp.product.priceInCents,
  }))

  return (
    <FlowEditor
      botId={bot.id}
      botName={bot.name}
      channelPermissionError={(bot as Record<string, unknown>).channelPermissionError as string | null ?? null}
      products={products}
    />
  )
}
