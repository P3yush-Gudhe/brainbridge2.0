import { Fragment, type ReactNode } from 'react'
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
  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                'relative w-full bg-white border border-[#E7E5E0] rounded-xl shadow-lg p-6',
                sizes[size],
                className
              )}
            >
              {(title || description) && (
                <div className="mb-5">
                  {title && <h2 className="text-lg font-semibold text-[#252525]">{title}</h2>}
                  {description && <p className="text-sm text-[#707070] mt-1">{description}</p>}
                </div>
              )}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 btn-icon text-[#707070] hover:text-[#252525] hover:bg-[#F0F0ED]"
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
