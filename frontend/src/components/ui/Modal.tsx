import { Fragment, useEffect, useId, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-5xl',
}

export function Modal({ open, onClose, title, description, children, className, size = 'md' }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                'relative w-full bg-surface border border-border rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto',
                sizes[size],
                className
              )}
            >
              {(title || description) && (
                <div className="mb-5 pr-8">
                  {title && <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>}
                  {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-4 right-4 btn-icon text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
              >
                <X className="w-4 h-4" />
              </button>
              {children}
            </motion.div>
          </div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
