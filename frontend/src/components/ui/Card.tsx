import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover'
}

export function Card({ className, children, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        variant === 'hover'
          ? 'card-hover bg-white border border-[#E7E5E0] rounded-xl shadow-xs transition-all'
          : 'card bg-white border border-[#E7E5E0] rounded-xl shadow-xs transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-semibold text-[#252525] text-sm tracking-tight', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-[#707070] mt-0.5', className)} {...props}>
      {children}
    </p>
  )
}
