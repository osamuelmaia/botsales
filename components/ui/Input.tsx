import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/cn"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      leftIcon,
      rightIcon,
      className,
      wrapperClassName,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = id ?? props.name
    const hasError = Boolean(error)

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none inline-flex">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={generatedId}
            className={cn(
              "w-full h-10 rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors",
              "focus:outline-none focus:ring-2",
              "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
              hasError
                ? "border-red-300 focus:ring-red-500/30 focus:border-red-500"
                : "border-gray-200 focus:ring-blue-500/30 focus:border-blue-500",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className,
            )}
            aria-invalid={hasError || undefined}
            aria-describedby={
              error ? `${generatedId}-error` : helper ? `${generatedId}-helper` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 inline-flex">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={`${generatedId}-error`} className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${generatedId}-helper`} className="text-xs text-gray-500 mt-1">
            {helper}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = "Input"
