import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import {
  Plus, Send, Mic, MicOff, Copy, ThumbsUp, ThumbsDown,
  MessageSquare, Trash2, Edit3, Download, User, Bot,
  ChevronRight, Search, Check
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn, generateId } from '@/lib/utils'
import api, { getFreshIdToken } from '@/lib/api'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any
  }
}

interface Message {
  id: string
  dbId?: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  liked?: boolean | null
}

interface Conversation {
  id: string
  dbId?: number
  title: string
  subject?: string
  topic?: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

const SUGGESTED_PROMPTS = [
  { icon: '🧮', title: 'Explain a concept', prompt: 'Explain the concept of integration by parts with examples' },
  { icon: '📝', title: 'Summarize topic', prompt: 'Summarize the key points of the French Revolution' },
  { icon: '💡', title: 'Study plan', prompt: 'Create a 2-week study plan for my Physics exam' },
  { icon: '🔍', title: 'Solve a problem', prompt: 'Help me solve this differential equation: dy/dx = 2x + 3' },
  { icon: '📊', title: 'Compare concepts', prompt: 'Compare and contrast RAM vs ROM with a table' },
  { icon: '🎯', title: 'Practice questions', prompt: 'Give me 5 practice MCQ questions on Organic Chemistry' },
]

const INITIAL_AI_RESPONSE = `Hello! I'm your study assistant. I can help you with:

- **Explaining complex concepts** in simple terms
- **Solving math problems** with step-by-step solutions
- **Creating study plans** tailored to your schedule
- **Generating practice questions** for any subject
- **Summarizing topics** and key points
- **Writing and debugging code**

What would you like to work on today?`

function makeDraftConversation(subject?: string, topic?: string): Conversation {
  const initialMsg = subject
    ? `Welcome to your **${subject}${topic ? ` — ${topic}` : ''}** tutoring session! What concept or problem would you like to explore first?`
    : INITIAL_AI_RESPONSE
  return {
    id: `draft-${generateId()}`,
    title: topic ? `${subject}: ${topic}` : subject || 'New conversation',
    subject,
    topic,
    messages: [{
      id: 'welcome',
      role: 'assistant',
      content: initialMsg,
      timestamp: new Date(),
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function AIChatPage() {
  const [searchParams] = useSearchParams()
  const tutorSubject = searchParams.get('subject') || undefined
  const tutorTopic = searchParams.get('topic') || undefined

  const [conversations, setConversations] = useState<Conversation[]>(() => [
    makeDraftConversation(tutorSubject, tutorTopic),
  ])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [input, setInput] = useState(() =>
    tutorSubject && tutorTopic
      ? `Teach me ${tutorTopic} in ${tutorSubject} step by step with an example.`
      : ''
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/chats')
        if (!active) return
        const rawConvs = (res.data?.conversations || []) as Array<{
          id: number
          title: string
          subject: string | null
          topic: string | null
          createdAt: string
          updatedAt: string
          messages: Array<{
            id: number
            role: 'user' | 'assistant'
            content: string
            liked: boolean | null
            createdAt: string
          }>
        }>

        const loaded: Conversation[] = rawConvs.map(c => ({
          id: `db-${c.id}`,
          dbId: c.id,
          title: c.title,
          subject: c.subject || undefined,
          topic: c.topic || undefined,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          messages: c.messages.length > 0
            ? c.messages.map(m => ({
                id: `msg-${m.id}`,
                dbId: m.id,
                role: m.role,
                content: m.content,
                liked: m.liked,
                timestamp: new Date(m.createdAt),
              }))
            : [{ id: 'welcome', role: 'assistant', content: INITIAL_AI_RESPONSE, timestamp: new Date(c.createdAt) }],
        }))

        if (tutorSubject) {
          const tutorDraft = makeDraftConversation(tutorSubject, tutorTopic)
          setConversations([tutorDraft, ...loaded])
          setActiveConvId(tutorDraft.id)
        } else if (loaded.length > 0) {
          setConversations(loaded)
          setActiveConvId(loaded[0].id)
        } else {
          const fresh = makeDraftConversation()
          setConversations([fresh])
          setActiveConvId(fresh.id)
        }
      } catch {
        toast.error('Failed to load conversations')
        setActiveConvId(prev => prev || conversations[0]?.id || '')
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorSubject, tutorTopic])

  const activeConv = conversations.find(c => c.id === activeConvId) ?? conversations[0]
  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const createConversation = () => {
    const newConv = makeDraftConversation()
    setConversations(prev => [newConv, ...prev])
    setActiveConvId(newConv.id)
  }

  const deleteConversation = async (id: string) => {
    const target = conversations.find(c => c.id === id)
    if (target?.dbId) {
      try {
        await api.delete(`/chats/${target.dbId}`)
      } catch {
        toast.error('Failed to delete conversation')
        return
      }
    }
    const remaining = conversations.filter(c => c.id !== id)
    if (remaining.length > 0) {
      setConversations(remaining)
      if (activeConvId === id || activeConv?.id === id) {
        setActiveConvId(remaining[0].id)
      }
    } else {
      const fresh = makeDraftConversation()
      setConversations([fresh])
      setActiveConvId(fresh.id)
    }
  }

  const saveTitle = async (id: string) => {
    const target = conversations.find(c => c.id === id)
    const nextTitle = editTitle.trim() || target?.title || 'New conversation'
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: nextTitle } : c))
    setEditingTitle(null)
    if (target?.dbId) {
      await api.patch(`/chats/${target.dbId}`, { title: nextTitle }).catch(() => {
        toast.error('Failed to rename conversation')
      })
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !activeConv) return
    const userInput = input.trim()
    let convId = activeConv.id
    let dbConvId = activeConv.dbId
    const nextTitle = activeConv.title === 'New conversation' ? userInput.slice(0, 40) : activeConv.title

    setInput('')
    setIsLoading(true)

    const userMsgId = generateId()
    const assistantMsgId = generateId()
    const historyForApi = [
      ...activeConv.messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userInput },
    ]

    setConversations(prev => prev.map(c => c.id === convId ? {
      ...c,
      title: nextTitle,
      messages: [
        ...c.messages,
        { id: userMsgId, role: 'user', content: userInput, timestamp: new Date() },
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() },
      ],
      updatedAt: new Date(),
    } : c))

    try {
      const idToken = await getFreshIdToken()
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          messages: historyForApi,
          subject: activeConv.subject,
          topic: activeConv.topic,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Request failed (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Streaming is not supported by this browser')

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              accumulated += parsed.text
              setConversations(prev => prev.map(c => c.id === convId ? {
                ...c,
                messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: accumulated } : m),
              } : c))
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      if (accumulated) {
        if (!dbConvId) {
          const created = await api.post('/chats', {
            title: nextTitle,
            subject: activeConv.subject,
            topic: activeConv.topic,
          })
          dbConvId = created.data.conversation.id as number
          const newId = `db-${dbConvId}`
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, id: newId, dbId: dbConvId } : c))
          setActiveConvId(newId)
          convId = newId
        } else if (activeConv.title === 'New conversation') {
          void api.patch(`/chats/${dbConvId}`, { title: nextTitle }).catch(() => {})
        }

        const savedMsgsRes = await api.post(`/chats/${dbConvId}/messages`, {
          messages: [
            { role: 'user', content: userInput },
            { role: 'assistant', content: accumulated },
          ],
        }).catch(() => null)
        const savedMsgs = (savedMsgsRes?.data?.messages || []) as Array<{ id: number; role: string }>
        const savedAssistant = savedMsgs.find(m => m.role === 'assistant')
        if (savedAssistant) {
          setConversations(prev => prev.map(c => c.id === convId ? {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, dbId: savedAssistant.id } : m),
          } : c))
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to get AI response'
      toast.error(msg)
      setConversations(prev => prev.map(c => c.id === convId ? {
        ...c,
        messages: c.messages.map(m =>
          m.id === assistantMsgId && !m.content
            ? { ...m, content: `Unable to generate response: ${msg}` }
            : m
        ),
      } : c))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const copyMessage = (content: string, id: string) => {
    void navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Copied to clipboard')
  }

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) { toast.error('Speech recognition not supported'); return }
      const recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('')
        setInput(transcript)
      }
      recognition.onend = () => setIsListening(false)
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    }
  }

  const likeMessage = (msgId: string, liked: boolean, dbId?: number) => {
    const currentConv = activeConv
    const target = currentConv?.messages.find(m => m.id === msgId)
    const nextLiked = target?.liked === liked ? null : liked
    setConversations(prev => prev.map(c => c.id === currentConv?.id ? {
      ...c,
      messages: c.messages.map(m => m.id === msgId ? { ...m, liked: nextLiked } : m),
    } : c))
    if (dbId) {
      void api.patch(`/chats/messages/${dbId}/like`, { liked: nextLiked }).catch(() => {
        toast.error('Failed to save feedback')
      })
    }
  }

  const exportConversation = () => {
    if (!activeConv) return
    const text = activeConv.messages.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeConv.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Conversation exported')
  }

  return (
    <div className="flex h-full bg-bg relative">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-border">
              <button type="button" onClick={createConversation} className="btn btn-primary w-full gap-2 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New conversation
              </button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  className="input pl-9 py-1.5 text-xs bg-bg"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {filteredConvs.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs',
                    activeConv?.id === conv.id ? 'bg-accent-light text-accent-text font-medium' : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                  )}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  {editingTitle === conv.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => void saveTitle(conv.id)}
                      onKeyDown={e => e.key === 'Enter' && void saveTitle(conv.id)}
                      className="flex-1 bg-transparent text-xs text-text-primary outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate">{conv.title}</span>
                  )}
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setEditingTitle(conv.id); setEditTitle(conv.title) }}
                      aria-label={`Rename conversation ${conv.title}`}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); void deleteConversation(conv.id) }}
                      aria-label={`Delete conversation ${conv.title}`}
                      className="p-1 rounded hover:bg-error-light text-text-muted hover:text-error"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border bg-surface flex items-center px-4 gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Hide conversation sidebar' : 'Show conversation sidebar'}
            className="btn-icon text-text-secondary hover:text-text-primary"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>
          <span className="font-semibold text-text-primary text-sm flex-1 truncate">{activeConv?.title}</span>
          <button
            type="button"
            onClick={exportConversation}
            aria-label="Export conversation"
            className="btn-icon text-text-secondary hover:text-text-primary"
            title="Export conversation"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8 space-y-6">
          {activeConv?.messages.length === 1 && activeConv.messages[0].role === 'assistant' && (
            <div className="max-w-2xl mx-auto py-6">
              <div className="text-center mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#5965B3] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Bot className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-1">What would you like to learn?</h2>
                <p className="text-text-secondary text-xs">Ask a question or select a topic to begin studying</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    type="button"
                    key={p.prompt}
                    onClick={() => { setInput(p.prompt); textareaRef.current?.focus() }}
                    className="text-left p-4 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-xs transition-all"
                  >
                    <span className="text-lg mb-1.5 block" aria-hidden="true">{p.icon}</span>
                    <div className="text-xs font-semibold text-text-primary mb-0.5">{p.title}</div>
                    <div className="text-xs text-text-secondary line-clamp-2">{p.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConv?.messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('flex gap-3.5 max-w-4xl', message.role === 'user' ? 'ml-auto flex-row-reverse max-w-2xl' : 'mr-auto')}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold',
                message.role === 'user'
                  ? 'bg-[#5965B3] text-white'
                  : 'bg-surface border border-border text-accent-text'
              )}>
                {message.role === 'user' ? <User className="w-3.5 h-3.5" aria-hidden="true" /> : <Bot className="w-3.5 h-3.5" aria-hidden="true" />}
              </div>
              <div className={cn(
                'group relative rounded-xl px-4 py-3 max-w-full text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-accent-light text-text-primary'
                  : 'bg-surface border border-border text-text-primary shadow-xs'
              )}>
                {message.role === 'assistant' ? (
                  <div className="prose-studymate">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeHighlight]}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {message.content === '' && (
                      <div className="flex gap-1 py-1">
                        {[0,1,2].map(i => (
                          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-accent"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                <div className={cn(
                  'absolute -bottom-7 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
                  message.role === 'user' ? 'right-0' : 'left-0'
                )}>
                  <button
                    type="button"
                    onClick={() => copyMessage(message.content, message.id)}
                    aria-label="Copy message"
                    className="p-1 rounded hover:bg-surface-secondary text-text-muted hover:text-text-primary transition-colors"
                    title="Copy text"
                  >
                    {copiedId === message.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {message.role === 'assistant' && (
                    <>
                      <button type="button" onClick={() => likeMessage(message.id, true, message.dbId)} aria-label="Thumbs up" className={cn('p-1 rounded hover:bg-surface-secondary transition-colors', message.liked === true ? 'text-success' : 'text-text-muted hover:text-text-primary')}>
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => likeMessage(message.id, false, message.dbId)} aria-label="Thumbs down" className={cn('p-1 rounded hover:bg-surface-secondary transition-colors', message.liked === false ? 'text-error' : 'text-text-muted hover:text-text-primary')}>
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border bg-surface p-3 sm:p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2 bg-bg border border-border rounded-xl p-2.5 focus-within:border-accent transition-colors">
              <button
                type="button"
                id="voice-input-btn"
                onClick={toggleVoice}
                aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                className={cn('btn-icon flex-shrink-0 mb-0.5', isListening ? 'text-error bg-error-light' : 'text-text-secondary hover:text-text-primary')}
                title="Voice input"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <textarea
                ref={textareaRef}
                id="chat-input"
                aria-label="Ask your study assistant"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                rows={1}
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-sm resize-none outline-none max-h-40 leading-relaxed"
              />
              <button
                type="button"
                id="send-btn"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className={cn(
                  'btn-icon flex-shrink-0 mb-0.5 transition-all',
                  input.trim() && !isLoading
                    ? 'bg-[#5965B3] hover:bg-[#4B56A1] text-white shadow-xs'
                    : 'text-text-muted cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-text-muted text-center mt-2">StudyMate is designed to assist your learning journey.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
