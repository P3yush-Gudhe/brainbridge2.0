import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, Zap, BookOpen, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface SearchResult {
  type: 'note' | 'chat' | 'flashcard'
  title: string
  desc: string
  path: string
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await api.get('/search', { params: { q: query } })
        if (!active) return
        const data = res.data as {
          notes?: Array<{ id: number; title: string; content: string }>
          conversations?: Array<{ id: number; title: string }>
          flashcardDecks?: Array<{ id: number; name: string; subject: string }>
        }
        const combined: SearchResult[] = [
          ...(data.notes || []).map(n => ({
            type: 'note' as const,
            title: n.title,
            desc: n.content ? n.content.replace(/[#*`]/g, '').slice(0, 80) : 'Study note',
            path: '/notes',
          })),
          ...(data.conversations || []).map(c => ({
            type: 'chat' as const,
            title: c.title,
            desc: 'Saved chat conversation',
            path: '/chat',
          })),
          ...(data.flashcardDecks || []).map(d => ({
            type: 'flashcard' as const,
            title: d.name,
            desc: `${d.subject} flashcard deck`,
            path: '/flashcards',
          })),
        ]
        setResults(combined)
      } catch {
        if (active) {
          setResults([])
          setError('Search failed. Please try again.')
          toast.error('Workspace search failed')
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 220)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  const filtered = results.filter(item => !filter || item.type === filter)

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'note') return BookOpen
    if (type === 'chat') return MessageSquare
    return Zap
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Search Workspace</h1>
        <p className="text-text-secondary text-sm mt-1">Search your saved notes, conversations, and flashcard decks</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          id="global-search"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search notes, conversations, flashcard decks..."
          aria-label="Search workspace"
          className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-accent transition-all shadow-xs"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search query"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[null, 'note', 'chat', 'flashcard'].map(f => (
          <button
            key={f ?? 'all'}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              filter === f
                ? 'bg-accent-light border-accent text-accent-text'
                : 'border-border text-text-secondary bg-surface hover:bg-surface-subtle'
            )}
          >
            {f ? f.charAt(0).toUpperCase() + f.slice(1) + 's' : 'All items'}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {loading ? (
          <SkeletonList count={4} />
        ) : error ? (
          <div className="p-4 rounded-xl bg-error-light border border-error/30 text-center text-xs text-error">{error}</div>
        ) : filtered.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {filtered.map((r, i) => {
              const Icon = iconFor(r.type)
              return (
                <Link key={`${r.type}-${r.title}-${i}`} to={r.path}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-xs transition-all mb-2"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0 text-accent-text">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary text-xs truncate">{r.title}</div>
                      <div className="text-xs text-text-secondary mt-0.5 truncate">{r.desc}</div>
                    </div>
                    <span className="text-[10px] text-text-secondary font-mono capitalize bg-surface-subtle px-2 py-0.5 rounded border border-border">
                      {r.type}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </motion.div>
        ) : (
          <EmptyState
            icon={Search}
            title={query ? `No results for "${query}"` : 'Nothing to search yet'}
            description={query ? 'Try a different keyword or clear filters.' : 'Create notes, flashcard decks, or AI chat conversations to search them here.'}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
