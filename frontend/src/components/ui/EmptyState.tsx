import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl border border-dashed border-border bg-surface-subtle/60"
    >
      <div className="w-14 h-14 rounded-xl bg-surface-secondary border border-border flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-text-secondary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary max-w-sm text-balance mb-5">{description}</p>
      {action}
    </motion.div>
  )
}
