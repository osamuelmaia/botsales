import { type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/cn"

type Variant = "neutral" | "success" | "warning" | "error" | "info" | "primary"

const variantCls: Record<Variant, string> = {
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error:   "bg-red-50 text-red-700 border-red-200",
  info:    "bg-blue-50 text-blue-700 border-blue-200",
  primary: "bg-blue-600 text-white border-blue-600",
}

type Size = "sm" | "md"

const sizeCls: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-0.5 text-xs gap-1.5",
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  dot?: boolean
}

export function Badge({
  variant = "neutral",
  size = "md",
  leftIcon,
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const dotColor: Record<Variant, string> = {
    neutral: "bg-gray-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error:   "bg-red-500",
    info:    "bg-blue-500",
    primary: "bg-white",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant])} />}
      {leftIcon && <span className="inline-flex">{leftIcon}</span>}
      {children}
    </span>
  )
}
