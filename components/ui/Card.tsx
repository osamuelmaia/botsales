import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/cn"

type Variant = "default" | "muted" | "interactive"

const variantCls: Record<Variant, string> = {
  default: "bg-white border-gray-200 shadow-sm",
  muted: "bg-gray-50 border-gray-200",
  interactive:
    "bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer",
}

type Padding = "none" | "sm" | "md" | "lg"

const paddingCls: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border",
          variantCls[variant],
          paddingCls[padding],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Card.displayName = "Card"

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-5 py-4 border-b border-gray-100", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-gray-900", className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-gray-500 mt-0.5", className)} {...props}>
      {children}
    </p>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100", className)}
      {...props}
    >
      {children}
    </div>
  )
}
