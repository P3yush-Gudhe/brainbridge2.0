import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Brain, List, HelpCircle, Zap,
  Download, Loader2, X, MessageSquare, RotateCcw, AlertCircle, BookOpen, Copy, Check
} from 'lucide-react'
import { pdfjs } from 'react-pdf'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { toast } from 'react-hot-toast'
import { cn, formatBytes } from '@/lib/utils'
import api from '@/lib/api'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

type PDFTab = 'text' | 'summary' | 'keypoints' | 'quiz' | 'flashcards' | 'chat'

interface PDFQuizItem {
  q: string
  options: string[]
  answer: number
}

interface PDFFlashcard {
  front: string
  back: string
}

interface PDFAnalysis {
  summary: string
  keyPoints: string[]
  quiz: PDFQuizItem[]
  flashcards: PDFFlashcard[]
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIdx = result.indexOf(',')
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const pageCount = doc.numPages
  const parts: string[] = []
  for (let p = 1; p <= Math.min(pageCount, 40); p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(`--- Page ${p} ---\n${line}`)
  }
  return {
    text: parts.join('\n\n'),
    pages: pageCount,
  }
}

export function PDFReaderPage() {
  const [file, setFile] = useState<File | null>(null)
  const [fileBase64, setFileBase64] = useState<string>('')
  const [extractedText, setExtractedText] = useState('')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [extractingText, setExtractingText] = useState(false)
  const [activeTab, setActiveTab] = useState<PDFTab>('text')
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PDFAnalysis | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({})
  const [copiedText, setCopiedText] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file')
      return
    }
    if (f.size > 18 * 1024 * 1024) {
      toast.error('Please upload a PDF smaller than 18MB')
      return
    }
    try {
      setExtractingText(true)
      const b64 = await fileToBase64(f)
      setFile(f)
      setFileBase64(b64)
      setAnalysis(null)
      setAiError(null)
      setChatMessages([])
      setQuizAnswers({})
      setQuizSubmitted(false)
      setFlippedCards({})
      setActiveTab('text')

      try {
        const res = await extractPdfText(f)
        setExtractedText(res.text)
        setPageCount(res.pages)
      } catch {
        setExtractedText('')
        setPageCount(null)
      } finally {
        setExtractingText(false)
      }
    } catch {
      setExtractingText(false)
      toast.error('Could not read PDF file')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const processFile = async () => {
    if (!file || !fileBase64) return
    setIsProcessing(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/pdf', {
        action: 'process',
        fileName: file.name,
        fileBase64,
      })
      setAnalysis(response.data as PDFAnalysis)
      setActiveTab('summary')
      toast.success('PDF processed successfully')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to process PDF'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !file || !fileBase64 || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(m => [...m, { role: 'user', text: userMsg }])
    setChatLoading(true)
    try {
      const response = await api.post('/ai/pdf', {
        action: 'chat',
        fileName: file.name,
        fileBase64,
        question: userMsg,
      })
      setChatMessages(m => [...m, { role: 'ai', text: response.data?.answer || 'No answer returned.' }])
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to query PDF'
      toast.error(msg)
      setChatMessages(m => [...m, { role: 'ai', text: `Error: ${msg}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const exportSummary = () => {
    if (!analysis?.summary) return
    const blob = new Blob([analysis.summary], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(file?.name || 'document').replace(/\.pdf$/i, '')}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Summary exported')
  }

  const saveTextToNotes = async () => {
    const content = analysis?.summary || extractedText
    if (!content.trim() || !file) return
    setSavingNote(true)
    try {
      await api.post('/notes', {
        title: file.name.replace(/\.pdf$/i, ''),
        content: content.slice(0, 50000),
        tags: ['pdf'],
      })
      toast.success('Saved to Notes library')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const tabs: { id: PDFTab; label: string; icon: React.ComponentType<{ className?: string }>; requiresAi?: boolean }[] = [
    { id: 'text', label: 'Document Text', icon: FileText },
    { id: 'summary', label: 'AI Summary', icon: Brain, requiresAi: true },
    { id: 'keypoints', label: 'Key Points', icon: List, requiresAi: true },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle, requiresAi: true },
    { id: 'flashcards', label: 'Flashcards', icon: Zap, requiresAi: true },
    { id: 'chat', label: 'Ask document', icon: MessageSquare, requiresAi: true },
  ]

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">PDF Reader</h1>
        <p className="text-[#707070] text-sm mt-1">Read PDF text immediately, save to notes, or generate AI study guides</p>
      </div>

      {!file ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#E7E5E0] bg-white rounded-2xl p-14 text-center cursor-pointer hover:border-[#5965B3] hover:bg-[#FAF9F6] transition-all"
        >
          <div className="w-14 h-14 rounded-xl bg-[#F0F0ED] flex items-center justify-center mx-auto mb-4 text-[#707070]">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#252525] mb-1">Drop your PDF here</h3>
          <p className="text-[#707070] text-xs mb-5">or click to select from your computer</p>
          <Button variant="secondary" size="sm">Browse files</Button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <p className="text-[11px] text-[#999999] mt-4 font-mono">Supports standard PDF files up to 18MB</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* File Header */}
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-white border border-[#E7E5E0] shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-[#FBEFEF] border border-[#B45D5D]/20 flex items-center justify-center flex-shrink-0 text-[#B45D5D]">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[#252525] truncate">{file.name}</div>
              <div className="text-xs text-[#707070] font-mono mt-0.5">
                {formatBytes(file.size)} • PDF{pageCount ? ` • ${pageCount} pages` : ''}
              </div>
            </div>
            {extractedText && (
              <Button variant="secondary" size="sm" isLoading={savingNote} onClick={() => void saveTextToNotes()} leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
                Save to Notes
              </Button>
            )}
            {!analysis && (
              <Button onClick={processFile} isLoading={isProcessing} leftIcon={<Brain className="w-4 h-4" />}>
                {isProcessing ? 'Processing...' : 'AI Summarize'}
              </Button>
            )}
            {analysis && <Badge variant="success">AI Processed ✓</Badge>}
            <button onClick={() => { setFile(null); setFileBase64(''); setAnalysis(null); setExtractedText(''); setPageCount(null) }} className="btn-icon text-[#707070] hover:text-[#252525]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {aiError && (
            <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}

          {isProcessing && (
            <Card className="p-8 text-center bg-white border-[#E7E5E0]">
              <Loader2 className="w-6 h-6 text-[#5965B3] animate-spin mx-auto mb-3" />
              <h3 className="font-semibold text-[#252525] text-sm mb-2">Analyzing document...</h3>
              <p className="text-xs text-[#707070]">Extracting key topics, formulas, and generating study resources</p>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-[#E7E5E0] overflow-x-auto no-scrollbar">
            {tabs
              .filter(t => !t.requiresAi || Boolean(analysis))
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                    activeTab === tab.id
                      ? 'bg-[#ECEEF7] text-[#5965B3]'
                      : 'text-[#707070] hover:text-[#252525] hover:bg-[#FAF9F6]'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'text' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Extracted Document Text</CardTitle>
                    {extractedText && (
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">{extractedText.split(/\s+/).filter(Boolean).length} words</Badge>
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(extractedText)
                            setCopiedText(true)
                            setTimeout(() => setCopiedText(false), 2000)
                          }}
                          className={cn('btn-icon-sm btn-ghost', copiedText ? 'text-[#5C8A6A]' : 'text-[#707070]')}
                          title="Copy text"
                        >
                          {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </CardHeader>
                  {extractingText ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-xs text-[#707070]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#5965B3]" /> Extracting text from PDF...
                    </div>
                  ) : extractedText ? (
                    <pre className="whitespace-pre-wrap text-xs text-[#252525] leading-relaxed font-sans max-h-[520px] overflow-y-auto bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E0]">
                      {extractedText}
                    </pre>
                  ) : (
                    <div className="text-center py-8 text-xs text-[#707070]">
                      No selectable text layer found in this PDF (it may be a scanned image PDF).
                    </div>
                  )}
                </Card>
              )}

              {analysis && activeTab === 'summary' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Document Summary</CardTitle>
                    <Button size="sm" variant="secondary" onClick={exportSummary} leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
                  </CardHeader>
                  <div className="prose-studymate text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.summary}</ReactMarkdown>
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'keypoints' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Key Points</CardTitle>
                    <Badge variant="brand">{analysis.keyPoints.length} points</Badge>
                  </CardHeader>
                  <div className="space-y-2.5">
                    {analysis.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#FAF9F6] border border-[#E7E5E0]">
                        <span className="text-xs font-mono font-semibold text-[#5965B3] w-5 flex-shrink-0 pt-0.5">{i + 1}.</span>
                        <span className="text-xs text-[#252525] leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'quiz' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Generated Quiz</CardTitle>
                    {quizSubmitted && (
                      <Badge variant="success">
                        Score: {analysis.quiz.filter((q, i) => quizAnswers[i] === q.answer).length}/{analysis.quiz.length}
                      </Badge>
                    )}
                  </CardHeader>
                  <div className="space-y-5">
                    {analysis.quiz.map((q, qi) => (
                      <div key={qi} className="space-y-2">
                        <p className="font-semibold text-[#252525] text-xs">{qi + 1}. {q.q}</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                              className={cn(
                                'w-full text-left px-3.5 py-2.5 rounded-lg border text-xs transition-all bg-white',
                                quizAnswers[qi] === oi && !quizSubmitted ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' :
                                quizSubmitted && oi === q.answer ? 'bg-[#EDF5F0] border-[#5C8A6A] text-[#5C8A6A]' :
                                quizSubmitted && quizAnswers[qi] === oi && oi !== q.answer ? 'bg-[#FBEFEF] border-[#B45D5D] text-[#B45D5D]' :
                                'border-[#E7E5E0] text-[#707070] hover:bg-[#FAF9F6]'
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!quizSubmitted ? (
                      <Button onClick={() => setQuizSubmitted(true)} className="w-full">Submit answers</Button>
                    ) : (
                      <Button variant="secondary" onClick={() => { setQuizAnswers({}); setQuizSubmitted(false) }} className="w-full">Reset quiz</Button>
                    )}
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'flashcards' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Generated Flashcards ({analysis.flashcards.length})</CardTitle>
                    <Button size="sm" variant="secondary" onClick={() => setFlippedCards({})} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
                      Reset flips
                    </Button>
                  </CardHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analysis.flashcards.map((card, i) => {
                      const flipped = Boolean(flippedCards[i])
                      return (
                        <button
                          key={i}
                          onClick={() => setFlippedCards(prev => ({ ...prev, [i]: !prev[i] }))}
                          className={cn(
                            'text-left p-4 rounded-xl border transition-all min-h-28 flex flex-col justify-between',
                            flipped
                              ? 'bg-[#ECEEF7]/50 border-[#5965B3]/40'
                              : 'bg-[#FAF9F6] border-[#E7E5E0] hover:border-[#D4D2CD]'
                          )}
                        >
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5965B3]">
                            {flipped ? 'Answer' : `Card ${i + 1} · Question`}
                          </span>
                          <p className="text-xs font-medium text-[#252525] my-2 leading-relaxed">
                            {flipped ? card.back : card.front}
                          </p>
                          <span className="text-[10px] text-[#999999]">Click to flip</span>
                        </button>
                      )
                    })}
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'chat' && (
                <Card className="p-5 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-3">
                    <CardTitle>Ask questions about this PDF</CardTitle>
                  </CardHeader>
                  <div className="min-h-56 max-h-80 overflow-y-auto space-y-3 mb-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 text-[#999999] text-xs">
                        Ask any question about the document content...
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={cn('flex gap-3 text-xs', m.role === 'user' && 'flex-row-reverse')}>
                        <div className={cn('max-w-lg p-3 rounded-xl', m.role === 'user' ? 'bg-[#ECEEF7] text-[#252525]' : 'bg-[#FAF9F6] border border-[#E7E5E0] text-[#252525]')}>
                          {m.role === 'ai' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown> : m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-[#5965B3]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading document...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Ask about document..."
                      className="input flex-1 py-1.5 text-xs"
                    />
                    <Button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} size="sm">Ask</Button>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
