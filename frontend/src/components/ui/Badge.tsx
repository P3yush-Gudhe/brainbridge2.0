import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[#F0F0ED] text-[#707070] border-[#E7E5E0]',
    brand: 'bg-[#ECEEF7] text-[#5965B3] border-[#5965B3]/20 font-semibold',
    success: 'bg-[#EDF5F0] text-[#5C8A6A] border-[#5C8A6A]/20 font-semibold',
    warning: 'bg-[#FDF8EE] text-[#B4863A] border-[#B4863A]/20 font-semibold',
    danger: 'bg-[#FBEFEF] text-[#B45D5D] border-[#B45D5D]/20 font-semibold',
    neutral: 'bg-[#FAF9F6] text-[#707070] border-[#E7E5E0]',
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
