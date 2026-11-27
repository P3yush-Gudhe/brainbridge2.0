import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-surface-secondary text-text-secondary border-border',
    brand: 'bg-accent-light text-accent-text border-accent/25 font-semibold',
    success: 'bg-success-light text-success border-success/25 font-semibold',
    warning: 'bg-warning-light text-warning border-warning/25 font-semibold',
    danger: 'bg-error-light text-error border-error/25 font-semibold',
    neutral: 'bg-surface-subtle text-text-secondary border-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
