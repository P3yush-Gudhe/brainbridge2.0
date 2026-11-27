import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const baseStyles =
    'btn inline-flex items-center justify-center rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'btn-primary shadow-xs',
    secondary: 'btn-secondary bg-surface hover:bg-surface-subtle border border-border text-text-primary hover:border-border-strong shadow-xs',
    outline: 'border border-border bg-transparent text-text-primary hover:bg-surface-subtle hover:border-border-strong',
    ghost: 'btn-ghost text-text-secondary hover:text-text-primary hover:bg-surface-secondary',
    danger: 'bg-[#A64444] hover:bg-[#923939] text-white border border-[#A64444] shadow-xs',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-xs px-4 py-2 gap-2 h-9',
    lg: 'text-sm px-5 py-2.5 gap-2 h-10',
    icon: 'p-2 w-9 h-9 flex items-center justify-center',
  }

  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...(props as unknown as React.ComponentProps<typeof motion.button>)}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  )
}
