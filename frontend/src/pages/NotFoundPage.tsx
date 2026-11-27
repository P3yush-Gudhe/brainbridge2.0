import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Bookmark, ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="w-14 h-14 rounded-2xl bg-[#5965B3] text-white flex items-center justify-center mx-auto mb-6 shadow-xs">
          <Bookmark className="w-7 h-7 fill-white/20" aria-hidden="true" />
        </div>
        <h1 className="text-5xl font-bold text-text-primary font-mono mb-2">404</h1>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Page not found</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-xs">The requested path does not exist in your workspace.</p>
        <Link to="/dashboard" className="btn btn-primary gap-2 inline-flex">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Go to Home
        </Link>
      </motion.div>
    </div>
  )
}
