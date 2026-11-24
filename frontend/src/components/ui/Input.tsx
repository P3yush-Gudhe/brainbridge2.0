import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
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
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-[#252525] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-[#707070] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            'input w-full bg-white border border-[#E7E5E0] rounded-lg px-3.5 py-2 text-xs text-[#252525] placeholder-[#999999] transition-all outline-none focus:border-[#5965B3] focus:ring-1 focus:ring-[#5965B3]',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            error && 'border-[#B45D5D] focus:border-[#B45D5D] focus:ring-[#B45D5D]',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-[#707070] flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-[11px] text-[#B45D5D] font-medium mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-[#707070] mt-1">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
