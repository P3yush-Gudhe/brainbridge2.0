import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  label,
  error,
  leftIcon,
  rightIcon,
  hint,
  id,
  type = 'text',
  ...props
}, ref) => {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center" aria-hidden="true">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          type={type}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'input w-full bg-surface border border-border rounded-lg px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted transition-all outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            error && 'border-error focus:border-error focus:ring-error',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-text-muted flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-[11px] text-error font-medium mt-1" role="alert">{error}</p>}
      {hint && !error && <p className="text-[11px] text-text-secondary mt-1">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
