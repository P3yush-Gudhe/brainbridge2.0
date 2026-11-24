import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, Zap, BookOpen, X } from 'lucide-react'
import { Link } from 'react-router-dom'
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

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
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
        if (active) setResults([])
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
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Search Workspace</h1>
        <p className="text-[#707070] text-sm mt-1">Search your saved notes, conversations, and flashcard decks</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707070]" />
        <input
          id="global-search"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search notes, conversations, flashcard decks..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E7E5E0] rounded-xl text-[#252525] placeholder-[#999999] text-sm outline-none focus:border-[#5965B3] transition-all shadow-xs"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#252525]">
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
                ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]'
                : 'border-[#E7E5E0] text-[#707070] bg-white hover:bg-[#FAF9F6]'
            )}
          >
            {f ? f.charAt(0).toUpperCase() + f.slice(1) + 's' : 'All items'}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {loading ? (
          <div className="text-center py-8 text-xs text-[#707070]">Searching...</div>
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
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-[#E7E5E0] bg-white hover:border-[#D4D2CD] hover:shadow-xs transition-all mb-2"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#ECEEF7] flex items-center justify-center flex-shrink-0 text-[#5965B3]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#252525] text-xs truncate">{r.title}</div>
                      <div className="text-xs text-[#707070] mt-0.5 truncate">{r.desc}</div>
                    </div>
                    <span className="text-[10px] text-[#707070] font-mono capitalize bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E7E5E0]">
                      {r.type}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </motion.div>
        ) : (
          <div className="text-center py-12 text-xs text-[#707070]">
            {query ? `No results found for "${query}"` : 'No workspace items yet. Create notes, decks, or chat conversations to search them here.'}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
