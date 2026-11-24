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
  ...props
}: ButtonProps) {
  const baseStyles = 'btn inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'btn-primary bg-[#5965B3] hover:bg-[#4E59A3] text-white shadow-xs',
    secondary: 'btn-secondary bg-white hover:bg-[#FAF9F6] border border-[#E7E5E0] text-[#252525] hover:border-[#D4D2CD] shadow-xs',
    outline: 'border border-[#E7E5E0] bg-transparent text-[#252525] hover:bg-[#FAF9F6] hover:border-[#D4D2CD]',
    ghost: 'btn-ghost text-[#707070] hover:text-[#252525] hover:bg-[#FAF9F6]',
    danger: 'btn-danger bg-[#B45D5D] hover:bg-[#9E4F4F] text-white shadow-xs',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-xs px-4 py-2 gap-2 h-9',
    lg: 'text-sm px-5 py-2.5 gap-2 h-10',
    icon: 'p-2 w-9 h-9 flex items-center justify-center',
  }

  return (
    <motion.button
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...(props as unknown as React.ComponentProps<typeof motion.button>)}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  )
}
