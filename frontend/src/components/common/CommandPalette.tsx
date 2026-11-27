import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MessageSquare, FileText, BookOpen, Zap, HelpCircle,
  Calendar, BarChart3, Clock, Trophy, Settings, Brain, Video,
  ScanLine, Map, Percent, Calculator, Code2, UserCircle, Plus,
  Command, ArrowRight, Home, Users, Mic, Sun, Moon
} from 'lucide-react'
import { useAppStore, resolveTheme } from '@/stores/appStore'
import api from '@/lib/api'

interface CommandItem {
  id: string
  title: string
  category: 'Pages' | 'Quick Actions' | 'Study Tools' | 'Your Library'
  icon: React.ElementType
  action: () => void
  shortcut?: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [libraryItems, setLibraryItems] = useState<CommandItem[]>([])
  const [searchError, setSearchError] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)

  const staticItems: CommandItem[] = useMemo(() => [
    { id: 'dashboard', title: 'Home / Dashboard', category: 'Pages', icon: Home, action: () => navigate('/dashboard'), shortcut: '⌘1' },
    { id: 'chat', title: 'AI Chat Workspace', category: 'Study Tools', icon: MessageSquare, action: () => navigate('/chat'), shortcut: '⌘2' },
    { id: 'ai-tutor', title: 'Personalized Tutor', category: 'Study Tools', icon: Brain, action: () => navigate('/ai-tutor') },
    { id: 'pdf', title: 'PDF Reader & Summarizer', category: 'Study Tools', icon: FileText, action: () => navigate('/pdf') },
    { id: 'notes', title: 'Study Notes Library', category: 'Pages', icon: BookOpen, action: () => navigate('/notes') },
    { id: 'voice', title: 'Voice Assistant', category: 'Study Tools', icon: Mic, action: () => navigate('/voice') },
    { id: 'youtube', title: 'YouTube Learning', category: 'Study Tools', icon: Video, action: () => navigate('/youtube') },
    { id: 'ocr', title: 'OCR Text Scanner', category: 'Study Tools', icon: ScanLine, action: () => navigate('/ocr') },
    { id: 'mindmap', title: 'Mind Map Generator', category: 'Study Tools', icon: Map, action: () => navigate('/mindmap') },
    { id: 'quiz', title: 'Quiz Generator & History', category: 'Pages', icon: HelpCircle, action: () => navigate('/quiz') },
    { id: 'flashcards', title: 'Flashcards & Spaced Repetition', category: 'Pages', icon: Zap, action: () => navigate('/flashcards') },
    { id: 'code', title: 'Code Playground', category: 'Pages', icon: Code2, action: () => navigate('/code') },
    { id: 'planner', title: 'Study Planner & Exams', category: 'Pages', icon: Calendar, action: () => navigate('/planner') },
    { id: 'pomodoro', title: 'Focus Timer (Pomodoro)', category: 'Pages', icon: Clock, action: () => navigate('/pomodoro') },
    { id: 'analytics', title: 'Academic Analytics', category: 'Pages', icon: BarChart3, action: () => navigate('/analytics') },
    { id: 'attendance', title: 'Attendance Tracker', category: 'Pages', icon: Percent, action: () => navigate('/attendance') },
    { id: 'cgpa', title: 'CGPA Calculator', category: 'Pages', icon: Calculator, action: () => navigate('/cgpa') },
    { id: 'achievements', title: 'Achievements & XP', category: 'Pages', icon: Trophy, action: () => navigate('/achievements') },
    { id: 'leaderboard', title: 'Study Leaderboard', category: 'Pages', icon: Users, action: () => navigate('/leaderboard') },
    { id: 'search-page', title: 'Full Workspace Search', category: 'Pages', icon: Search, action: () => navigate('/search') },
    { id: 'profile', title: 'Profile', category: 'Pages', icon: UserCircle, action: () => navigate('/profile') },
    { id: 'settings', title: 'Settings & Preferences', category: 'Pages', icon: Settings, action: () => navigate('/settings') },
    {
      id: 'toggle-theme',
      title: effectiveTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      category: 'Quick Actions',
      icon: effectiveTheme === 'dark' ? Sun : Moon,
      action: () => toggleTheme(),
      shortcut: 'T',
    },
    { id: 'new-note', title: 'Create new note', category: 'Quick Actions', icon: Plus, action: () => navigate('/notes'), shortcut: 'N' },
    { id: 'start-pomo', title: 'Start Pomodoro focus session', category: 'Quick Actions', icon: Clock, action: () => navigate('/pomodoro'), shortcut: 'P' },
    { id: 'new-chat', title: 'Start new AI chat', category: 'Quick Actions', icon: MessageSquare, action: () => navigate('/chat'), shortcut: 'C' },
    { id: 'take-quiz', title: 'Take a practice quiz', category: 'Quick Actions', icon: HelpCircle, action: () => navigate('/quiz'), shortcut: 'Q' },
  ], [navigate, effectiveTheme, toggleTheme])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    let active = true
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        if (active) setLibraryItems([])
        return
      }
      try {
        setSearchError(false)
        const res = await api.get('/search', { params: { q: query.trim() } })
        if (!active) return
        const data = res.data as {
          notes?: Array<{ id: number; title: string }>
          conversations?: Array<{ id: number; title: string }>
          flashcardDecks?: Array<{ id: number; name: string }>
          pdfs?: Array<{ id: number; fileName: string }>
        }
        const results: CommandItem[] = [
          ...(data.notes || []).slice(0, 4).map((n) => ({
            id: `note-${n.id}`,
            title: n.title,
            category: 'Your Library' as const,
            icon: BookOpen,
            action: () => navigate('/notes'),
          })),
          ...(data.flashcardDecks || []).slice(0, 4).map((d) => ({
            id: `deck-${d.id}`,
            title: d.name,
            category: 'Your Library' as const,
            icon: Zap,
            action: () => navigate('/flashcards'),
          })),
          ...(data.pdfs || []).slice(0, 4).map((p) => ({
            id: `pdf-${p.id}`,
            title: p.fileName,
            category: 'Your Library' as const,
            icon: FileText,
            action: () => navigate('/pdf'),
          })),
          ...(data.conversations || []).slice(0, 4).map((c) => ({
            id: `conv-${c.id}`,
            title: c.title,
            category: 'Your Library' as const,
            icon: MessageSquare,
            action: () => navigate('/chat'),
          })),
        ]
        setLibraryItems(results)
      } catch {
        if (active) {
          setLibraryItems([])
          setSearchError(true)
        }
      }
    }, 180)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query, navigate])

  const filteredStatic = staticItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  )

  const filteredItems = [...libraryItems, ...filteredStatic]

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, filteredItems, selectedIndex])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-10"
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3 border-b border-border gap-3 bg-surface-subtle">
              <Search className="w-4 h-4 text-text-secondary flex-shrink-0" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, notes, decks, PDFs, or actions..."
                aria-label="Command palette search"
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface border border-border rounded">
                ESC
              </kbd>
            </div>

            {/* Command List */}
            <div role="listbox" aria-label="Command results" className="max-h-80 overflow-y-auto p-2 space-y-0.5">
              {searchError && query.trim() && (
                <div className="px-3 py-1.5 text-[11px] text-error bg-error-light rounded-md mb-1">
                  Library search unavailable — showing app commands below.
                </div>
              )}
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-text-secondary">
                  No results found for "{query}"
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex
                  const Icon = item.icon
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      key={item.id}
                      onClick={() => {
                        item.action()
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected ? 'bg-surface-secondary text-text-primary' : 'text-text-secondary hover:bg-surface-subtle'
                      }`}
                    >
                      <div className={`p-1.5 rounded-md ${isSelected ? 'bg-surface text-accent-text shadow-xs' : 'bg-surface-secondary text-text-secondary'}`}>
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                      <span className="flex-1 font-medium text-sm text-text-primary truncate">{item.title}</span>
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface border border-border rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                      <span className="text-[10px] uppercase font-mono text-text-muted px-1.5 py-0.5 bg-surface-secondary rounded border border-border">
                        {item.category}
                      </span>
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />}
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-surface-subtle border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">↵</kbd> Select</span>
              </div>
              <div className="flex items-center gap-1">
                <Command className="w-3 h-3 text-accent-text" aria-hidden="true" />
                <span className="font-medium text-text-primary">Command Palette</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
