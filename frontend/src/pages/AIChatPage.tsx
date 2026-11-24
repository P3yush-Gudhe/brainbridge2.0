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
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
      await api.delete(`/chats/${target.dbId}`).catch(() => {})
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
      await api.patch(`/chats/${target.dbId}`, { title: nextTitle }).catch(() => {})
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
    navigator.clipboard.writeText(content)
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
      void api.patch(`/chats/messages/${dbId}/like`, { liked: nextLiked }).catch(() => {})
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
    <div className="flex h-full bg-[#F7F7F5]">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r border-[#E7E5E0] bg-white flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-[#E7E5E0]">
              <button onClick={createConversation} className="btn btn-primary w-full gap-2 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> New conversation
              </button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999999]" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="input pl-9 py-1.5 text-xs bg-[#F7F7F5]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {filteredConvs.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs',
                    activeConv?.id === conv.id ? 'bg-[#ECEEF7] text-[#5965B3] font-medium' : 'text-[#707070] hover:bg-[#F0F0ED] hover:text-[#252525]'
                  )}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  {editingTitle === conv.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => void saveTitle(conv.id)}
                      onKeyDown={e => e.key === 'Enter' && void saveTitle(conv.id)}
                      className="flex-1 bg-transparent text-xs text-[#252525] outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate">{conv.title}</span>
                  )}
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingTitle(conv.id); setEditTitle(conv.title) }}
                      className="p-1 rounded hover:bg-white text-[#999999] hover:text-[#252525]"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); void deleteConversation(conv.id) }}
                      className="p-1 rounded hover:bg-[#FBEFEF] text-[#999999] hover:text-[#B45D5D]"
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
        <div className="h-12 border-b border-[#E7E5E0] bg-white flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-icon text-[#707070] hover:text-[#252525]">
            <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>
          <span className="font-semibold text-[#252525] text-sm flex-1 truncate">{activeConv?.title}</span>
          <button onClick={exportConversation} className="btn-icon text-[#707070] hover:text-[#252525]" title="Export conversation">
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8 space-y-6">
          {activeConv?.messages.length === 1 && activeConv.messages[0].role === 'assistant' && (
            <div className="max-w-2xl mx-auto py-6">
              <div className="text-center mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#5965B3] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-[#252525] mb-1">What would you like to learn?</h2>
                <p className="text-[#707070] text-xs">Ask a question or select a topic to begin studying</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.prompt}
                    onClick={() => { setInput(p.prompt); textareaRef.current?.focus() }}
                    className="text-left p-4 rounded-xl border border-[#E7E5E0] bg-white hover:border-[#D4D2CD] hover:shadow-xs transition-all"
                  >
                    <span className="text-lg mb-1.5 block">{p.icon}</span>
                    <div className="text-xs font-semibold text-[#252525] mb-0.5">{p.title}</div>
                    <div className="text-xs text-[#707070] line-clamp-2">{p.prompt}</div>
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
                  : 'bg-white border border-[#E7E5E0] text-[#5965B3]'
              )}>
                {message.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={cn(
                'group relative rounded-xl px-4 py-3 max-w-full text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-[#ECEEF7] text-[#252525]'
                  : 'bg-white border border-[#E7E5E0] text-[#252525] shadow-xs'
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
                          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#5965B3]"
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
                  'absolute -bottom-7 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                  message.role === 'user' ? 'right-0' : 'left-0'
                )}>
                  <button
                    onClick={() => copyMessage(message.content, message.id)}
                    className="p-1 rounded hover:bg-[#F0F0ED] text-[#999999] hover:text-[#252525] transition-colors"
                    title="Copy text"
                  >
                    {copiedId === message.id ? <Check className="w-3 h-3 text-[#5C8A6A]" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {message.role === 'assistant' && (
                    <>
                      <button onClick={() => likeMessage(message.id, true, message.dbId)} className={cn('p-1 rounded hover:bg-[#F0F0ED] transition-colors', message.liked === true ? 'text-[#5C8A6A]' : 'text-[#999999] hover:text-[#252525]')}>
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => likeMessage(message.id, false, message.dbId)} className={cn('p-1 rounded hover:bg-[#F0F0ED] transition-colors', message.liked === false ? 'text-[#B45D5D]' : 'text-[#999999] hover:text-[#252525]')}>
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

        <div className="border-t border-[#E7E5E0] bg-white p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#F7F7F5] border border-[#E7E5E0] rounded-xl p-2.5 focus-within:border-[#5965B3] transition-colors">
              <button
                id="voice-input-btn"
                onClick={toggleVoice}
                className={cn('btn-icon flex-shrink-0 mb-0.5', isListening ? 'text-[#B45D5D] bg-[#FBEFEF]' : 'text-[#707070] hover:text-[#252525]')}
                title="Voice input"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <textarea
                ref={textareaRef}
                id="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                rows={1}
                className="flex-1 bg-transparent text-[#252525] placeholder-[#999999] text-sm resize-none outline-none max-h-40 leading-relaxed"
              />
              <button
                id="send-btn"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'btn-icon flex-shrink-0 mb-0.5 transition-all',
                  input.trim() && !isLoading
                    ? 'bg-[#5965B3] hover:bg-[#4E59A3] text-white shadow-xs'
                    : 'text-[#999999] cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#999999] text-center mt-2">StudyMate is designed to assist your learning journey.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
