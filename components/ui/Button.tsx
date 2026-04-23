import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

const variantCls: Record<Variant, string> = {
  primary:
    "bg-[#111627] text-white hover:bg-[#1c2434] active:bg-[#0a0f1c] shadow-sm shadow-black/10",
  secondary:
    "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger:
    "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm shadow-red-600/20",
}

const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-11 px-5 text-sm rounded-lg gap-2",
}

const iconSizeCls: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2",
          variantCls[variant],
          sizeCls[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className={cn("animate-spin", iconSizeCls[size])} />
        ) : (
          leftIcon && <span className={cn("inline-flex", iconSizeCls[size])}>{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className={cn("inline-flex", iconSizeCls[size])}>{rightIcon}</span>
        )}
      </button>
    )
  },
)
Button.displayName = "Button"
