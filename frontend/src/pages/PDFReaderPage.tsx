import { lazy, Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Brain, List, HelpCircle, Zap,
  Download, Loader2, X, MessageSquare, RotateCcw, AlertCircle,
  BookOpen, Copy, Check, Save, FolderOpen, Trash2, Highlighter, StickyNote, Eye
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { cn, formatBytes, formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'

const PdfDocumentPreview = lazy(() => import('@/components/pdf/PdfDocumentPreview'))

type PDFTab = 'text' | 'preview' | 'summary' | 'keypoints' | 'quiz' | 'flashcards' | 'chat' | 'notes'

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

interface PdfHighlight {
  id: string
  page: number
  text: string
  color: string
  createdAt: string
}

interface SavedPdfRecord {
  id: number
  fileName: string
  pageCount: number
  extractedText: string
  summary: string
  keyPoints: string[]
  highlights: PdfHighlight[]
  notes: string
  updatedAt: string
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
  const { pdfjs } = await import('react-pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

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

function extractCitedPages(text: string): number[] {
  const matches = text.match(/\[Page\s+(\d+)\]/gi) || []
  const pages = new Set<number>()
  for (const m of matches) {
    const num = Number(m.replace(/\D/g, ''))
    if (num > 0) pages.add(num)
  }
  return Array.from(pages).sort((a, b) => a - b)
}

export function PDFReaderPage() {
  const [savedPdfs, setSavedPdfs] = useState<SavedPdfRecord[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [activeSavedId, setActiveSavedId] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [fileBase64, setFileBase64] = useState<string>('')
  const [extractedText, setExtractedText] = useState('')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [extractingText, setExtractingText] = useState(false)
  const [activeTab, setActiveTab] = useState<PDFTab>('text')
  const [isProcessing, setIsProcessing] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
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
  const [highlights, setHighlights] = useState<PdfHighlight[]>([])
  const [highlightDraft, setHighlightDraft] = useState('')
  const [highlightPage, setHighlightPage] = useState(1)
  const [pdfNotes, setPdfNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const textPreRef = useRef<HTMLPreElement>(null)

  const loadSavedPdfs = useCallback(async () => {
    try {
      setLoadingSaved(true)
      const res = await api.get('/pdfs')
      setSavedPdfs((res.data?.pdfs || []) as SavedPdfRecord[])
    } catch {
      toast.error('Failed to load saved PDFs')
    } finally {
      setLoadingSaved(false)
    }
  }, [])

  useEffect(() => {
    void loadSavedPdfs()
  }, [loadSavedPdfs])

  const resetActiveDoc = () => {
    setActiveSavedId(null)
    setFileName('')
    setFileSize(null)
    setFileBase64('')
    setExtractedText('')
    setPageCount(null)
    setCurrentPage(1)
    setAnalysis(null)
    setAiError(null)
    setChatMessages([])
    setQuizAnswers({})
    setQuizSubmitted(false)
    setFlippedCards({})
    setHighlights([])
    setPdfNotes('')
  }

  const jumpToPage = (pageNum: number) => {
    const safePage = Math.max(1, pageNum)
    setCurrentPage(safePage)
    setHighlightPage(safePage)
    if (fileBase64) {
      setActiveTab('preview')
    } else {
      setActiveTab('text')
      setTimeout(() => {
        const marker = `--- Page ${safePage} ---`
        const idx = extractedText.indexOf(marker)
        if (idx >= 0 && textPreRef.current && extractedText.length > 0) {
          const ratio = idx / extractedText.length
          textPreRef.current.scrollTop = Math.floor(textPreRef.current.scrollHeight * ratio)
        }
      }, 100)
    }
    toast.success(`Jumped to Page ${safePage}`)
  }

  const openSavedPdf = (doc: SavedPdfRecord) => {
    setActiveSavedId(doc.id)
    setFileName(doc.fileName)
    setFileSize(null)
    setFileBase64('')
    setExtractedText(doc.extractedText || '')
    setPageCount(doc.pageCount || 1)
    setCurrentPage(1)
    setHighlights(Array.isArray(doc.highlights) ? doc.highlights : [])
    setPdfNotes(doc.notes || '')
    setAiError(null)
    setChatMessages([])
    setQuizAnswers({})
    setQuizSubmitted(false)
    setFlippedCards({})
    if (doc.summary || doc.keyPoints?.length) {
      setAnalysis({
        summary: doc.summary || '',
        keyPoints: doc.keyPoints || [],
        quiz: [],
        flashcards: [],
      })
      setActiveTab(doc.summary ? 'summary' : 'text')
    } else {
      setAnalysis(null)
      setActiveTab('text')
    }
  }

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
      setActiveSavedId(null)
      setFileName(f.name)
      setFileSize(f.size)
      setFileBase64(b64)
      setCurrentPage(1)
      setAnalysis(null)
      setAiError(null)
      setChatMessages([])
      setQuizAnswers({})
      setQuizSubmitted(false)
      setFlippedCards({})
      setHighlights([])
      setPdfNotes('')
      setActiveTab('preview')

      try {
        const res = await extractPdfText(f)
        setExtractedText(res.text)
        setPageCount(res.pages)
      } catch {
        setExtractedText('')
        setPageCount(1)
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
    if (f) void handleFile(f)
  }

  const processFile = async () => {
    if (!fileBase64 && !extractedText) return
    setIsProcessing(true)
    setAiError(null)
    try {
      const endpoint = fileBase64 ? '/uploads/pdf' : '/ai/pdf'
      const response = await api.post(endpoint, {
        action: 'process',
        fileName,
        fileBase64: fileBase64 || undefined,
        extractedText: extractedText || undefined,
      })
      const result = response.data as PDFAnalysis
      setAnalysis(result)
      setActiveTab('summary')
      toast.success('PDF processed successfully')

      if (activeSavedId) {
        const patched = await api.patch(`/pdfs/${activeSavedId}`, {
          summary: result.summary,
          keyPoints: result.keyPoints,
        })
        const updated = patched.data.pdf as SavedPdfRecord
        setSavedPdfs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to process PDF'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const savePdfToDb = async (overrideHighlights?: PdfHighlight[], overrideNotes?: string) => {
    if (!fileName) return
    setSavingPdf(true)
    const nextHighlights = overrideHighlights ?? highlights
    const nextNotes = overrideNotes ?? pdfNotes
    try {
      if (activeSavedId) {
        const res = await api.patch(`/pdfs/${activeSavedId}`, {
          summary: analysis?.summary,
          keyPoints: analysis?.keyPoints,
          highlights: nextHighlights,
          notes: nextNotes,
        })
        const updated = res.data.pdf as SavedPdfRecord
        setSavedPdfs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast.success('Saved PDF workspace updated')
      } else {
        const res = await api.post('/pdfs', {
          fileName,
          pageCount: pageCount || 1,
          extractedText,
          summary: analysis?.summary || '',
          keyPoints: analysis?.keyPoints || [],
          highlights: nextHighlights,
          notes: nextNotes,
        })
        const created = res.data.pdf as SavedPdfRecord
        setActiveSavedId(created.id)
        setSavedPdfs((prev) => [created, ...prev])
        toast.success('PDF saved to library (+15 XP)')
      }
    } catch {
      toast.error('Failed to save PDF to library')
    } finally {
      setSavingPdf(false)
    }
  }

  const deleteSavedPdf = async (id: number) => {
    try {
      await api.delete(`/pdfs/${id}`)
      setSavedPdfs((prev) => prev.filter((p) => p.id !== id))
      if (activeSavedId === id) resetActiveDoc()
      toast.success('PDF removed from library')
    } catch {
      toast.error('Failed to delete saved PDF')
    }
  }

  const addHighlight = async () => {
    const text = highlightDraft.trim()
    if (!text) return
    const next: PdfHighlight[] = [
      ...highlights,
      {
        id: `${Date.now()}`,
        page: Math.max(1, highlightPage),
        text,
        color: '#FEF08A',
        createdAt: new Date().toISOString(),
      },
    ]
    setHighlights(next)
    setHighlightDraft('')
    if (activeSavedId) {
      await savePdfToDb(next, pdfNotes)
    } else {
      toast.success('Highlight added (click Save PDF to store permanently)')
    }
  }

  const removeHighlight = async (id: string) => {
    const next = highlights.filter((h) => h.id !== id)
    setHighlights(next)
    if (activeSavedId) {
      await savePdfToDb(next, pdfNotes)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || (!fileBase64 && !extractedText) || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(m => [...m, { role: 'user', text: userMsg }])
    setChatLoading(true)
    try {
      const endpoint = fileBase64 ? '/uploads/pdf' : '/ai/pdf'
      const response = await api.post(endpoint, {
        action: 'chat',
        fileName,
        fileBase64: fileBase64 || undefined,
        extractedText: extractedText || undefined,
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
    a.download = `${(fileName || 'document').replace(/\.pdf$/i, '')}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Summary exported')
  }

  const saveTextToNotes = async () => {
    const content = analysis?.summary || pdfNotes || extractedText
    if (!content.trim() || !fileName) return
    setSavingNote(true)
    try {
      await api.post('/notes', {
        title: fileName.replace(/\.pdf$/i, ''),
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

  const tabs: { id: PDFTab; label: string; icon: React.ComponentType<{ className?: string }>; requiresAi?: boolean; requiresFile?: boolean }[] = [
    { id: 'preview', label: 'Page Viewer', icon: Eye, requiresFile: true },
    { id: 'text', label: 'Document Text', icon: FileText },
    { id: 'notes', label: `Highlights & Notes (${highlights.length})`, icon: StickyNote },
    { id: 'chat', label: 'Ask Document', icon: MessageSquare },
    { id: 'summary', label: 'AI Summary', icon: Brain, requiresAi: true },
    { id: 'keypoints', label: 'Key Points', icon: List, requiresAi: true },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle, requiresAi: true },
    { id: 'flashcards', label: 'Flashcards', icon: Zap, requiresAi: true },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">PDF Reader</h1>
          <p className="text-text-secondary text-sm mt-1">Read PDFs, save highlights & notes, and chat with page citations</p>
        </div>
        {fileName && (
          <Button variant="secondary" size="sm" onClick={resetActiveDoc}>
            Open Another PDF
          </Button>
        )}
      </div>

      {!fileName ? (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border bg-surface rounded-2xl p-10 sm:p-14 text-center cursor-pointer hover:border-accent hover:bg-surface-subtle transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-surface-secondary flex items-center justify-center mx-auto mb-4 text-text-secondary">
              <Upload className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">Drop your PDF here</h3>
            <p className="text-text-secondary text-xs mb-5">or click to select from your computer</p>
            <Button variant="secondary" size="sm">Browse files</Button>
            <input ref={fileRef} type="file" accept=".pdf" aria-label="Upload PDF file" className="hidden" onChange={e => e.target.files?.[0] && void handleFile(e.target.files[0])} />
            <p className="text-[11px] text-text-muted mt-4 font-mono">Supports standard PDF files up to 18MB</p>
          </motion.div>

          <Card className="p-5">
            <CardHeader className="mb-3">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-accent-text" aria-hidden="true" /> Saved PDF Library
              </CardTitle>
              <Badge variant="neutral">{savedPdfs.length} saved</Badge>
            </CardHeader>
            {loadingSaved ? (
              <SkeletonList count={2} />
            ) : savedPdfs.length === 0 ? (
              <div className="text-xs text-text-secondary py-4">
                No PDFs saved yet. Upload a PDF above and click Save PDF to keep highlights, notes, and AI summaries in your library.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedPdfs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => openSavedPdf(doc)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-subtle hover:border-accent cursor-pointer transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent-light text-accent-text flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate">{doc.fileName}</div>
                      <div className="text-[11px] text-text-secondary">
                        {doc.pageCount} pages • {doc.highlights?.length || 0} highlights • {formatRelativeTime(doc.updatedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void deleteSavedPdf(doc.id)
                      }}
                      aria-label={`Delete saved PDF ${doc.fileName}`}
                      className="p-1.5 text-text-muted hover:text-error"
                      title="Delete saved PDF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface border border-border shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-error-light border border-error/20 flex items-center justify-center flex-shrink-0 text-error">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-text-primary truncate">{fileName}</div>
              <div className="text-xs text-text-secondary font-mono mt-0.5">
                {fileSize ? `${formatBytes(fileSize)} • ` : ''}PDF{pageCount ? ` • ${pageCount} pages` : ''}
                {activeSavedId ? ' • Saved in library' : ''}
              </div>
            </div>
            <Button variant="secondary" size="sm" isLoading={savingPdf} onClick={() => void savePdfToDb()} leftIcon={<Save className="w-3.5 h-3.5" />}>
              {activeSavedId ? 'Update Saved' : 'Save PDF'}
            </Button>
            {(extractedText || analysis?.summary) && (
              <Button variant="secondary" size="sm" isLoading={savingNote} onClick={() => void saveTextToNotes()} leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
                Copy to Notes
              </Button>
            )}
            {(!analysis || !analysis.quiz.length) && (
              <Button onClick={() => void processFile()} isLoading={isProcessing} leftIcon={<Brain className="w-4 h-4" />}>
                {isProcessing ? 'Processing...' : 'AI Summarize'}
              </Button>
            )}
            {analysis?.summary && <Badge variant="success">AI Processed ✓</Badge>}
            <button type="button" onClick={resetActiveDoc} aria-label="Close document" className="btn-icon text-text-secondary hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {aiError && (
            <div role="alert" className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{aiError}</span>
            </div>
          )}

          {isProcessing && (
            <Card className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-accent-text animate-spin mx-auto mb-3" />
              <h3 className="font-semibold text-text-primary text-sm mb-2">Analyzing document...</h3>
              <p className="text-xs text-text-secondary">Extracting key topics, formulas, and generating study resources</p>
            </Card>
          )}

          <div className="flex gap-1.5 p-1 bg-surface rounded-xl border border-border overflow-x-auto no-scrollbar">
            {tabs
              .filter(t => (!t.requiresFile || Boolean(fileBase64)) && (!t.requiresAi || Boolean(analysis && (t.id !== 'quiz' || analysis.quiz.length) && (t.id !== 'flashcards' || analysis.flashcards.length))))
              .map(tab => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                    activeTab === tab.id
                      ? 'bg-accent-light text-accent-text'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
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
              {activeTab === 'preview' && fileBase64 && (
                <Card className="p-4 sm:p-6">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-12 text-xs text-text-secondary gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent-text" /> Loading PDF viewer...
                      </div>
                    }
                  >
                    <PdfDocumentPreview
                      fileBase64={fileBase64}
                      currentPage={currentPage}
                      onPageChange={(p) => {
                        setCurrentPage(p)
                        setHighlightPage(p)
                      }}
                    />
                  </Suspense>
                </Card>
              )}

              {activeTab === 'text' && (
                <Card className="p-6">
                  <CardHeader className="mb-4">
                    <CardTitle>Extracted Document Text</CardTitle>
                    {extractedText && (
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">{extractedText.split(/\s+/).filter(Boolean).length} words</Badge>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(extractedText)
                            setCopiedText(true)
                            setTimeout(() => setCopiedText(false), 2000)
                          }}
                          aria-label="Copy extracted text"
                          className={cn('btn-icon-sm btn-ghost', copiedText ? 'text-success' : 'text-text-secondary')}
                          title="Copy text"
                        >
                          {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </CardHeader>
                  {extractingText ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-xs text-text-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-text" /> Extracting text from PDF...
                    </div>
                  ) : extractedText ? (
                    <pre ref={textPreRef} className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed font-sans max-h-[520px] overflow-y-auto bg-surface-subtle p-4 rounded-xl border border-border">
                      {extractedText}
                    </pre>
                  ) : (
                    <div className="text-center py-8 text-xs text-text-secondary">
                      No selectable text layer found in this PDF (you can still run AI Summarize on the uploaded PDF).
                    </div>
                  )}
                </Card>
              )}

              {activeTab === 'notes' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-5 space-y-4">
                    <CardHeader className="mb-0">
                      <CardTitle className="flex items-center gap-2">
                        <Highlighter className="w-4 h-4 text-warning" aria-hidden="true" /> Page Highlights
                      </CardTitle>
                    </CardHeader>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={pageCount || 999}
                        value={highlightPage}
                        onChange={(e) => setHighlightPage(Math.max(1, Number(e.target.value) || 1))}
                        className="input w-20 text-xs"
                        aria-label="Highlight page number"
                        placeholder="Pg"
                      />
                      <input
                        value={highlightDraft}
                        onChange={(e) => setHighlightDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void addHighlight()}
                        placeholder="Paste or type key quote to highlight..."
                        aria-label="Highlight quote"
                        className="input flex-1 text-xs"
                      />
                      <Button size="sm" onClick={() => void addHighlight()} disabled={!highlightDraft.trim()}>
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {highlights.length === 0 ? (
                        <div className="text-xs text-text-secondary py-6 text-center">No highlights saved for this PDF yet.</div>
                      ) : (
                        highlights.map((h) => (
                          <div key={h.id} className="p-3 rounded-lg bg-warning-light border border-warning/30 flex items-start justify-between gap-2 text-xs">
                            <div>
                              <button
                                type="button"
                                onClick={() => jumpToPage(h.page)}
                                className="inline-block text-left hover:underline"
                                title={`Jump to page ${h.page}`}
                              >
                                <Badge variant="warning">Page {h.page} →</Badge>
                              </button>
                              <p className="text-text-primary mt-1 leading-relaxed">{h.text}</p>
                            </div>
                            <button type="button" onClick={() => void removeHighlight(h.id)} aria-label="Remove highlight" className="text-text-muted hover:text-error">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="p-5 flex flex-col space-y-3">
                    <CardHeader className="mb-0">
                      <CardTitle className="flex items-center gap-2">
                        <StickyNote className="w-4 h-4 text-accent-text" aria-hidden="true" /> Margin Notes
                      </CardTitle>
                      <Button size="sm" isLoading={savingPdf} onClick={() => void savePdfToDb()}>
                        Save Notes
                      </Button>
                    </CardHeader>
                    <textarea
                      value={pdfNotes}
                      onChange={(e) => setPdfNotes(e.target.value)}
                      aria-label="PDF margin notes"
                      placeholder="Write your notes, questions, and formula derivations for this PDF..."
                      className="input flex-1 min-h-64 text-xs resize-none"
                    />
                  </Card>
                </div>
              )}

              {activeTab === 'chat' && (
                <Card className="p-5">
                  <CardHeader className="mb-3">
                    <CardTitle>Ask questions about this PDF (cites clickable page numbers)</CardTitle>
                  </CardHeader>
                  <div className="min-h-56 max-h-80 overflow-y-auto space-y-3 mb-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 text-text-muted text-xs">
                        Ask any question about "{fileName}" — answers will cite clickable [Page X] references.
                      </div>
                    )}
                    {chatMessages.map((m, i) => {
                      const citedPages = m.role === 'ai' ? extractCitedPages(m.text) : []
                      return (
                        <div key={i} className={cn('flex gap-3 text-xs', m.role === 'user' && 'flex-row-reverse')}>
                          <div className={cn('max-w-lg p-3 rounded-xl space-y-2', m.role === 'user' ? 'bg-accent-light text-text-primary' : 'bg-surface-subtle border border-border text-text-primary')}>
                            {m.role === 'ai' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown> : m.text}
                            {citedPages.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                                {citedPages.map((pg) => (
                                  <button
                                    type="button"
                                    key={pg}
                                    onClick={() => jumpToPage(pg)}
                                    className="px-2 py-0.5 rounded bg-accent-light text-accent-text font-mono text-[11px] hover:opacity-80"
                                  >
                                    Jump to Page {pg}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-accent-text">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading document...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && void sendChat()}
                      placeholder="Ask a question about this PDF..."
                      aria-label="Ask a question about this PDF"
                      className="input flex-1 py-1.5 text-xs"
                    />
                    <Button onClick={() => void sendChat()} disabled={!chatInput.trim() || chatLoading} size="sm">Ask</Button>
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'summary' && (
                <Card className="p-6">
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
                <Card className="p-6">
                  <CardHeader className="mb-4">
                    <CardTitle>Key Points</CardTitle>
                    <Badge variant="brand">{analysis.keyPoints.length} points</Badge>
                  </CardHeader>
                  <div className="space-y-2.5">
                    {analysis.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-subtle border border-border">
                        <span className="text-xs font-mono font-semibold text-accent-text w-5 flex-shrink-0 pt-0.5">{i + 1}.</span>
                        <span className="text-xs text-text-primary leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {analysis && activeTab === 'quiz' && (
                <Card className="p-6">
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
                        <p className="font-semibold text-text-primary text-xs">{qi + 1}. {q.q}</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => (
                            <button
                              type="button"
                              key={oi}
                              onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                              className={cn(
                                'w-full text-left px-3.5 py-2.5 rounded-lg border text-xs transition-all bg-surface',
                                quizAnswers[qi] === oi && !quizSubmitted ? 'bg-accent-light border-accent text-accent-text' :
                                quizSubmitted && oi === q.answer ? 'bg-success-light border-success text-success' :
                                quizSubmitted && quizAnswers[qi] === oi && oi !== q.answer ? 'bg-error-light border-error text-error' :
                                'border-border text-text-secondary hover:bg-surface-subtle'
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
                <Card className="p-6">
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
                          type="button"
                          key={i}
                          onClick={() => setFlippedCards(prev => ({ ...prev, [i]: !prev[i] }))}
                          className={cn(
                            'text-left p-4 rounded-xl border transition-all min-h-28 flex flex-col justify-between',
                            flipped
                              ? 'bg-accent-light/50 border-accent/40'
                              : 'bg-surface-subtle border-border hover:border-border-strong'
                          )}
                        >
                          <span className="text-[10px] font-mono uppercase tracking-wider text-accent-text">
                            {flipped ? 'Answer' : `Card ${i + 1} · Question`}
                          </span>
                          <p className="text-xs font-medium text-text-primary my-2 leading-relaxed">
                            {flipped ? card.back : card.front}
                          </p>
                          <span className="text-[10px] text-text-muted">Click to flip</span>
                        </button>
                      )
                    })}
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
