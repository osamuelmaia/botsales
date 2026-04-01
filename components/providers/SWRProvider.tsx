"use client"

import { SWRConfig } from "swr"

export function SWRProvider({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback: Record<string, unknown>
}) {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>
}
