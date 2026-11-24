import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Trash2, Tag, Download, Eye, Edit3,
  Clock, FileText, Brain, Wand2, Languages, Sparkles
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
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
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saved, setSaved] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/notes')
        if (!active) return
        const items = ((res.data?.notes || []) as RawNote[]).map(mapNote)
        setNotes(items)
        setActiveNote(items[0] ?? null)
      } catch (error: unknown) {
        if (!active) return
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load notes')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  const createNote = async () => {
    try {
      const res = await api.post('/notes', {
        title: 'Untitled Note',
        content: '',
        tags: [],
      })
      const created = mapNote(res.data.note as RawNote)
      setNotes(n => [created, ...n])
      setActiveNote(created)
      setPreviewMode(false)
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
    const nextTags = [...activeNote.tags, newTag.trim()]
    const updated = { ...activeNote, tags: nextTags }
    setActiveNote(updated)
    setNotes(n => n.map(note => note.id === activeNote.id ? updated : note))
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
    try {
      const response = await api.post('/ai/notes', {
        action,
        title: activeNote.title,
        content: activeNote.content,
        targetLanguage: 'Spanish',
      })
      const { result, mode } = response.data as { result?: string; mode?: 'replace' | 'append' }
      if (!result) {
        toast.error('No output returned')
        return
      }
      const nextContent = mode === 'append'
        ? `${activeNote.content.trimEnd()}\n\n---\n${result}`
        : result
      updateNote('content', nextContent)
      toast.success(`Note ${action}d`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'AI action failed')
    } finally {
      setAiLoading(false)
    }
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
    <div className="flex h-full bg-[#F7F7F5]">
      {/* Notes Sidebar List */}
      <div className="w-64 border-r border-[#E7E5E0] bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-[#E7E5E0] space-y-2">
          <button onClick={createNote} className="btn btn-primary w-full text-xs font-medium gap-2">
            <Plus className="w-3.5 h-3.5" /> Create note
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999999]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="input pl-9 py-1.5 text-xs bg-[#F7F7F5]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-[#707070]">Loading notes...</div>
          ) : loadError ? (
            <div className="text-center py-8 px-3 text-xs text-[#B45D5D]">{loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#707070]">No notes yet</div>
          ) : filtered.map(note => (
            <div
              key={note.id}
              onClick={() => setActiveNote(note)}
              className={cn(
                'group p-3 rounded-lg cursor-pointer transition-all',
                activeNote?.id === note.id ? 'bg-[#ECEEF7] border border-transparent' : 'hover:bg-[#F7F7F5]'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-semibold text-[#252525] truncate flex-1">{note.title}</h4>
                <button
                  onClick={e => { e.stopPropagation(); void deleteNote(note.id) }}
                  className="hidden group-hover:block text-[#999999] hover:text-[#B45D5D] flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[#707070] mt-1 line-clamp-2">
                {note.content ? `${note.content.replace(/[#*`]/g, '').slice(0, 60)}...` : 'Empty note'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="w-3 h-3 text-[#999999]" />
                <span className="text-[10px] text-[#999999]">{formatRelativeTime(note.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      {activeNote ? (
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="h-12 border-b border-[#E7E5E0] flex items-center px-6 gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              {ASSIST_TOOLS.map(tool => (
                <button
                  key={tool.action}
                  onClick={() => handleAITool(tool.action)}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-[#707070] hover:text-[#252525] hover:bg-[#F0F0ED] transition-all disabled:opacity-50"
                >
                  <tool.icon className="w-3.5 h-3.5 text-[#5965B3]" />
                  {tool.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <span className={cn('text-xs font-mono mr-2', saved ? 'text-[#5C8A6A]' : 'text-[#999999]')}>
              {saved ? '✓ Saved' : 'Saving...'}
            </span>
            <button onClick={() => setPreviewMode(m => !m)} className={cn('btn-icon-sm btn-ghost text-xs', previewMode ? 'text-[#5965B3]' : 'text-[#707070]')}>
              {previewMode ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={() => setShowTagModal(true)} className="btn-icon-sm btn-ghost text-[#707070]">
              <Tag className="w-4 h-4" />
            </button>
            <button onClick={exportNote} className="btn-icon-sm btn-ghost text-[#707070]">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="px-8 pt-6 pb-2">
            <input
              value={activeNote.title}
              onChange={e => updateNote('title', e.target.value)}
              className="w-full text-2xl font-bold text-[#252525] bg-transparent outline-none placeholder-[#999999]"
              placeholder="Note title..."
            />
            {activeNote.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {activeNote.tags.map(tag => (
                  <span key={tag} className="text-[11px] font-medium text-[#5965B3] bg-[#ECEEF7] px-2 py-0.5 rounded cursor-pointer hover:bg-[#FBEFEF] hover:text-[#B45D5D]" onClick={() => void removeTag(tag)}>
                    #{tag} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden px-8 pb-6">
            <AnimatePresence mode="wait">
              {previewMode ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full overflow-y-auto prose-studymate text-sm leading-relaxed"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNote.content}</ReactMarkdown>
                </motion.div>
              ) : (
                <motion.textarea
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  value={activeNote.content}
                  onChange={e => updateNote('content', e.target.value)}
                  placeholder="Start writing... (supports Markdown)"
                  className="w-full h-full bg-transparent text-[#252525] text-sm leading-relaxed font-mono resize-none outline-none placeholder-[#999999]"
                />
              )}
            </AnimatePresence>
          </div>

          <div className="px-8 pb-3 border-t border-[#E7E5E0] pt-2 flex justify-between items-center bg-[#FAF9F6]">
            <span className="text-[11px] text-[#999999] font-mono">{activeNote.content.length} characters</span>
            <span className="text-[11px] text-[#999999]">{previewMode ? 'Preview mode' : 'Markdown editor'}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white">
          <EmptyState
            icon={FileText}
            title="No note selected"
            description="Create a new study note or select one from your sidebar."
            action={<Button onClick={createNote} leftIcon={<Plus className="w-4 h-4" />}>Create note</Button>}
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
