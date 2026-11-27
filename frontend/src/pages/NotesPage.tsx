import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Trash2, Tag, Download, Eye, Edit3,
  Clock, FileText, Brain, Wand2, Languages, Sparkles, AlertCircle, X, List,
  Zap, HelpCircle, WifiOff, Code2, Sigma, Bold, Heading2, GitBranch
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { MermaidDiagram } from '@/components/common/MermaidDiagram'
import { toast } from 'react-hot-toast'
import { cn, formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'

interface Note {
  id: number
  title: string
  content: string
  tags: string[]
  updatedAt: Date
  createdAt: Date
}

interface RawNote {
  id: number
  title: string
  content: string
  tags: string[]
  updatedAt: string
  createdAt: string
}

const OFFLINE_NOTES_KEY = 'studymate_offline_notes'

function mapNote(raw: RawNote): Note {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    updatedAt: new Date(raw.updatedAt),
    createdAt: new Date(raw.createdAt),
  }
}

const ASSIST_TOOLS = [
  { icon: Sparkles, label: 'Generate', action: 'generate' },
  { icon: Wand2, label: 'Improve', action: 'improve' },
  { icon: Brain, label: 'Summarize', action: 'summarize' },
  { icon: Languages, label: 'Translate', action: 'translate' },
]

export function NotesPage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [offlineFallback, setOfflineFallback] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [previewMode, setPreviewMode] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [convertingToDeck, setConvertingToDeck] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saved, setSaved] = useState(true)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/notes', {
          params: {
            q: debouncedSearch || undefined,
            tag: selectedTag || undefined,
          },
        })
        if (!active) return
        const raw = (res.data?.notes || []) as RawNote[]
        if (!debouncedSearch && !selectedTag) {
          try {
            localStorage.setItem(OFFLINE_NOTES_KEY, JSON.stringify(raw))
          } catch {}
        }
        const items = raw.map(mapNote)
        setOfflineFallback(false)
        setNotes(items)
        if (!debouncedSearch && !selectedTag) {
          const tagsSet = new Set<string>()
          for (const item of items) {
            for (const t of item.tags) tagsSet.add(t)
          }
          setKnownTags(Array.from(tagsSet).sort())
        }
        setActiveNote(curr => {
          if (curr && items.some(i => i.id === curr.id)) {
            return items.find(i => i.id === curr.id) ?? items[0] ?? null
          }
          return items[0] ?? null
        })
      } catch (error: unknown) {
        if (!active) return
        try {
          const cached = localStorage.getItem(OFFLINE_NOTES_KEY)
          if (cached) {
            const parsed = (JSON.parse(cached) as RawNote[]).map(mapNote)
            const localFiltered = parsed.filter(n => {
              const matchesSearch = !debouncedSearch ||
                n.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                n.content.toLowerCase().includes(debouncedSearch.toLowerCase())
              const matchesTag = !selectedTag || n.tags.includes(selectedTag)
              return matchesSearch && matchesTag
            })
            setNotes(localFiltered)
            setActiveNote(localFiltered[0] ?? null)
            setOfflineFallback(true)
            setLoadError(null)
            return
          }
        } catch {}
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load notes')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [debouncedSearch, selectedTag])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const allTags = useMemo(() => {
    const merged = new Set(knownTags)
    for (const n of notes) {
      for (const t of n.tags) merged.add(t)
    }
    return Array.from(merged).sort()
  }, [knownTags, notes])

  const createNote = async () => {
    try {
      const res = await api.post('/notes', {
        title: 'Untitled Note',
        content: '',
        tags: selectedTag ? [selectedTag] : [],
      })
      const created = mapNote(res.data.note as RawNote)
      setNotes(n => [created, ...n])
      setActiveNote(created)
      setPreviewMode(false)
      setMobileListOpen(false)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to create note')
    }
  }

  const persistUpdate = async (noteId: number, updates: { title?: string; content?: string; tags?: string[] }) => {
    try {
      const res = await api.patch(`/notes/${noteId}`, updates)
      const savedNote = mapNote(res.data.note as RawNote)
      setNotes(n => n.map(item => item.id === noteId ? savedNote : item))
      setActiveNote(curr => (curr?.id === noteId ? { ...curr, updatedAt: savedNote.updatedAt } : curr))
      setSaved(true)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to save note')
    }
  }

  const updateNote = (field: 'title' | 'content', value: string) => {
    if (!activeNote) return
    setSaved(false)
    const updated = { ...activeNote, [field]: value, updatedAt: new Date() }
    setActiveNote(updated)
    setNotes(n => n.map(note => note.id === activeNote.id ? updated : note))

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const noteId = activeNote.id
    saveTimerRef.current = setTimeout(() => {
      void persistUpdate(noteId, { [field]: value })
    }, 600)
  }

  const insertMarkdownSnippet = (snippet: string) => {
    if (!activeNote) return
    setPreviewMode(false)
    const el = textareaRef.current
    if (!el) {
      updateNote('content', `${activeNote.content}${activeNote.content ? '\n' : ''}${snippet}`)
      return
    }
    const start = el.selectionStart ?? activeNote.content.length
    const end = el.selectionEnd ?? activeNote.content.length
    const next = `${activeNote.content.slice(0, start)}${snippet}${activeNote.content.slice(end)}`
    updateNote('content', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  const deleteNote = async (id: number) => {
    try {
      await api.delete(`/notes/${id}`)
      const remaining = notes.filter(note => note.id !== id)
      setNotes(remaining)
      if (activeNote?.id === id) {
        setActiveNote(remaining[0] ?? null)
      }
      toast.success('Note deleted')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to delete note')
    }
  }

  const addTag = async () => {
    if (!activeNote || !newTag.trim() || activeNote.tags.includes(newTag.trim())) return
    const clean = newTag.trim()
    const nextTags = [...activeNote.tags, clean]
    const updated = { ...activeNote, tags: nextTags }
    setActiveNote(updated)
    setNotes(n => n.map(note => note.id === activeNote.id ? updated : note))
    setKnownTags(prev => prev.includes(clean) ? prev : [...prev, clean].sort())
    setNewTag('')
    setShowTagModal(false)
    await persistUpdate(activeNote.id, { tags: nextTags })
  }

  const removeTag = async (tag: string) => {
    if (!activeNote) return
    const nextTags = activeNote.tags.filter(t => t !== tag)
    const updated = { ...activeNote, tags: nextTags }
    setActiveNote(updated)
    setNotes(n => n.map(note => note.id === activeNote.id ? updated : note))
    await persistUpdate(activeNote.id, { tags: nextTags })
  }

  const handleAITool = async (action: string) => {
    if (!activeNote) return
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/notes', {
        action,
        title: activeNote.title,
        content: activeNote.content,
        targetLanguage: 'Spanish',
      })
      const { result, mode } = response.data as { result?: string; mode?: 'replace' | 'append' }
      if (!result) {
        const msg = 'No output returned'
        setAiError(msg)
        toast.error(msg)
        return
      }
      const nextContent = mode === 'append'
        ? `${activeNote.content.trimEnd()}\n\n---\n${result}`
        : result
      updateNote('content', nextContent)
      toast.success(`Note ${action}d`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'AI action failed'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setAiLoading(false)
    }
  }

  const turnNoteIntoFlashcards = async () => {
    if (!activeNote) return
    if (!activeNote.content.trim()) {
      toast.error('Write some note content before creating flashcards')
      return
    }
    setConvertingToDeck(true)
    try {
      const aiRes = await api.post('/ai/flashcards', {
        topic: activeNote.title || 'Study Note',
        subject: activeNote.tags[0] || 'General',
        sourceText: activeNote.content,
        count: 8,
      })
      const cards: Array<{ front: string; back: string }> = aiRes.data?.cards || []
      if (!cards.length) {
        toast.error('No flashcards could be generated from this note')
        return
      }
      await api.post('/flashcards/decks', {
        name: activeNote.title || 'Note Deck',
        subject: activeNote.tags[0] || 'General',
        cards,
      })
      toast.success(`Saved ${cards.length} flashcards to Flashcards`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to turn note into flashcards')
    } finally {
      setConvertingToDeck(false)
    }
  }

  const turnNoteIntoQuiz = () => {
    if (!activeNote) return
    if (!activeNote.content.trim()) {
      toast.error('Write some note content before generating a quiz')
      return
    }
    navigate('/quiz', {
      state: {
        sourceMode: 'ai',
        topic: activeNote.title,
        subject: activeNote.tags[0] || 'Computer Science',
        sourceText: activeNote.content,
      },
    })
  }

  const exportNote = () => {
    if (!activeNote) return
    const blob = new Blob([`# ${activeNote.title}\n\n${activeNote.content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeNote.title}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Note exported')
  }

  return (
    <div className="flex h-full bg-bg relative">
      {/* Notes Sidebar List */}
      <aside
        aria-label="Saved notes list"
        className={cn(
          'w-64 border-r border-border bg-surface flex-col flex-shrink-0',
          mobileListOpen ? 'flex fixed inset-y-0 left-0 z-40 shadow-lg md:static md:shadow-none' : 'hidden md:flex'
        )}
      >
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void createNote()} className="btn btn-primary flex-1 text-xs font-medium gap-2">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Create note
            </button>
            <button
              type="button"
              onClick={() => setMobileListOpen(false)}
              aria-label="Close notes sidebar"
              className="md:hidden btn-icon-sm btn-ghost text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Full-text search..."
              aria-label="Search notes"
              className="input pl-9 py-1.5 text-xs bg-bg"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedTag('')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors',
                  selectedTag === '' ? 'bg-accent-light text-accent-text' : 'text-text-secondary hover:bg-surface-subtle'
                )}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => setSelectedTag(t => (t === tag ? '' : tag))}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors',
                    selectedTag === tag ? 'bg-accent-light text-accent-text' : 'text-text-secondary hover:bg-surface-subtle'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {offlineFallback && (
          <div className="px-3 py-1.5 bg-warning-light text-warning text-[11px] flex items-center gap-1.5 border-b border-warning/20">
            <WifiOff className="w-3 h-3 flex-shrink-0" />
            <span>Offline cached notes</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-2"><SkeletonList count={4} /></div>
          ) : loadError ? (
            <div className="text-center py-8 px-3 text-xs text-error">{loadError}</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">No matching notes</div>
          ) : notes.map(note => (
            <div
              key={note.id}
              onClick={() => { setActiveNote(note); setMobileListOpen(false) }}
              className={cn(
                'group p-3 rounded-lg cursor-pointer transition-all',
                activeNote?.id === note.id ? 'bg-accent-light border border-accent/20' : 'hover:bg-surface-subtle'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-semibold text-text-primary truncate flex-1">{note.title}</h4>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); void deleteNote(note.id) }}
                  aria-label={`Delete note ${note.title}`}
                  className="hidden group-hover:block text-text-muted hover:text-error flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">
                {note.content ? `${note.content.replace(/[#*`]/g, '').slice(0, 60)}...` : 'Empty note'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="w-3 h-3 text-text-muted" aria-hidden="true" />
                <span className="text-[10px] text-text-muted">{formatRelativeTime(note.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Editor */}
      {activeNote ? (
        <div className="flex-1 flex flex-col min-w-0 bg-surface">
          <div className="min-h-12 border-b border-border flex flex-wrap items-center px-3 sm:px-6 py-1.5 gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMobileListOpen(true)}
              aria-label="Open notes list"
              className="md:hidden btn-icon-sm btn-ghost text-text-secondary"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {ASSIST_TOOLS.map(tool => (
                <button
                  type="button"
                  key={tool.action}
                  onClick={() => void handleAITool(tool.action)}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  <tool.icon className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                  {tool.label}
                </button>
              ))}
              <span className="h-4 w-px bg-border mx-1 hidden sm:inline-block" />
              <button
                type="button"
                onClick={() => void turnNoteIntoFlashcards()}
                disabled={convertingToDeck}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-accent-text bg-accent-light hover:opacity-85 transition-all disabled:opacity-50 whitespace-nowrap"
                title="Turn note into flashcard deck"
              >
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                {convertingToDeck ? 'Creating...' : 'To Flashcards'}
              </button>
              <button
                type="button"
                onClick={turnNoteIntoQuiz}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all whitespace-nowrap"
                title="Turn note into practice quiz"
              >
                <HelpCircle className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                To Quiz
              </button>
            </div>
            <div className="flex-1" />
            <span className={cn('text-xs font-mono mr-2', saved ? 'text-success' : 'text-text-muted')}>
              {saved ? '✓ Saved' : 'Saving...'}
            </span>
            <button
              type="button"
              onClick={() => setPreviewMode(m => !m)}
              aria-label={previewMode ? 'Switch to Markdown editor' : 'Switch to preview mode'}
              title={previewMode ? 'Edit Markdown' : 'Preview Markdown'}
              className={cn('btn-icon-sm btn-ghost text-xs', previewMode ? 'text-accent-text bg-accent-light' : 'text-text-secondary')}
            >
              {previewMode ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              aria-label="Add tag"
              title="Add tag"
              className="btn-icon-sm btn-ghost text-text-secondary"
            >
              <Tag className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={exportNote}
              aria-label="Export note as Markdown"
              title="Export .md"
              className="btn-icon-sm btn-ghost text-text-secondary"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          {!previewMode && (
            <div className="px-4 sm:px-8 py-1.5 border-b border-border bg-surface-subtle flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button type="button" onClick={() => insertMarkdownSnippet('\n## Heading\n')} className="btn btn-ghost btn-sm px-2 py-1 text-[11px] gap-1" title="Insert heading">
                <Heading2 className="w-3 h-3" /> H2
              </button>
              <button type="button" onClick={() => insertMarkdownSnippet('**bold text**')} className="btn btn-ghost btn-sm px-2 py-1 text-[11px] gap-1" title="Insert bold text">
                <Bold className="w-3 h-3" /> Bold
              </button>
              <button type="button" onClick={() => insertMarkdownSnippet('\n```python\n# code here\n```\n')} className="btn btn-ghost btn-sm px-2 py-1 text-[11px] gap-1" title="Insert code block">
                <Code2 className="w-3 h-3" /> Code
              </button>
              <button type="button" onClick={() => insertMarkdownSnippet(' $$E = mc^2$$ ')} className="btn btn-ghost btn-sm px-2 py-1 text-[11px] gap-1" title="Insert LaTeX math">
                <Sigma className="w-3 h-3" /> Math
              </button>
              <button type="button" onClick={() => insertMarkdownSnippet('\n```mermaid\ngraph TD;\n  A-->B;\n```\n')} className="btn btn-ghost btn-sm px-2 py-1 text-[11px] gap-1" title="Insert Mermaid diagram">
                <GitBranch className="w-3 h-3" /> Diagram
              </button>
            </div>
          )}

          {aiError && (
            <div role="alert" className="mx-4 sm:mx-8 mt-4 p-3 rounded-lg bg-error-light border border-error/30 text-xs text-error flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{aiError}</span>
              </div>
              <button type="button" onClick={() => setAiError(null)} aria-label="Dismiss error" className="text-error hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="px-4 sm:px-8 pt-6 pb-2">
            <input
              value={activeNote.title}
              onChange={e => updateNote('title', e.target.value)}
              aria-label="Note title"
              className="w-full text-2xl font-bold text-text-primary bg-transparent outline-none placeholder:text-text-muted"
              placeholder="Note title..."
            />
            {activeNote.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {activeNote.tags.map(tag => (
                  <button
                    type="button"
                    key={tag}
                    className="text-[11px] font-medium text-accent-text bg-accent-light px-2 py-0.5 rounded hover:bg-error-light hover:text-error transition-colors"
                    onClick={() => void removeTag(tag)}
                    title={`Remove tag #${tag}`}
                  >
                    #{tag} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden px-4 sm:px-8 pb-6">
            <AnimatePresence mode="wait">
              {previewMode ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full overflow-y-auto prose-studymate text-sm leading-relaxed"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeHighlight]}
                    components={{
                      code({ className, children, ...props }) {
                        const langMatch = /language-(\w+)/.exec(className || '')
                        if (langMatch?.[1] === 'mermaid') {
                          return <MermaidDiagram chart={String(children)} />
                        }
                        return <code className={className} {...props}>{children}</code>
                      },
                    }}
                  >
                    {activeNote.content}
                  </ReactMarkdown>
                </motion.div>
              ) : (
                <motion.textarea
                  ref={textareaRef}
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  value={activeNote.content}
                  onChange={e => updateNote('content', e.target.value)}
                  aria-label="Note content editor"
                  placeholder="Start writing... (supports Markdown, LaTeX $...$, code blocks, and ```mermaid diagrams)"
                  className="w-full h-full bg-transparent text-text-primary text-sm leading-relaxed font-mono resize-none outline-none placeholder:text-text-muted"
                />
              )}
            </AnimatePresence>
          </div>

          <div className="px-4 sm:px-8 pb-3 border-t border-border pt-2 flex justify-between items-center bg-surface-subtle">
            <span className="text-[11px] text-text-muted font-mono">{activeNote.content.length} characters</span>
            <span className="text-[11px] text-text-muted">{previewMode ? 'Preview mode' : 'Markdown editor'}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-surface p-6">
          <EmptyState
            icon={FileText}
            title="No note selected"
            description="Create a new study note or select one from your sidebar."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" className="md:hidden" onClick={() => setMobileListOpen(true)}>Browse notes</Button>
                <Button onClick={() => void createNote()} leftIcon={<Plus className="w-4 h-4" />}>Create note</Button>
              </div>
            }
          />
        </div>
      )}

      <Modal open={showTagModal} onClose={() => setShowTagModal(false)} title="Add Tag" size="sm">
        <div className="space-y-4">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void addTag()}
            placeholder="Tag name..."
            aria-label="New tag name"
            className="input"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowTagModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => void addTag()}>Add tag</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
