import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Brain, FileText, List, HelpCircle, Zap, Loader2, Clock, RotateCcw, AlertCircle, BookOpen, Play } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

type YTTab = 'summary' | 'notes' | 'transcript' | 'quiz' | 'flashcards'

interface VideoPreview {
  videoId: string
  title: string
  channel: string
}

interface YouTubeAnalysis {
  title: string
  duration: string
  channel: string
  summary: string
  notes: Array<{ heading: string; bullets: string[] }>
  transcript: Array<{ time: string; text: string }>
  quiz: Array<{ q: string; opts: string[]; ans: number }>
  flashcards: Array<{ front: string; back: string }>
}

export function YouTubeLearningPage() {
  const [url, setUrl] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<VideoPreview | null>(null)
  const [videoNotes, setVideoNotes] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<YouTubeAnalysis | null>(null)
  const [activeTab, setActiveTab] = useState<YTTab>('summary')
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({})

  const loadVideoPreview = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? url).trim()
    if (!targetUrl) { toast.error('Please enter a YouTube URL'); return }
    setLoadingPreview(true)
    setAiError(null)
    try {
      const res = await api.get('/youtube/info', { params: { url: targetUrl } })
      setPreview(res.data as VideoPreview)
      toast.success('Video loaded')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Could not load YouTube video')
    } finally {
      setLoadingPreview(false)
    }
  }

  const processVideo = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? url).trim()
    if (!targetUrl) { toast.error('Please enter a YouTube URL'); return }
    setProcessing(true)
    setAiError(null)
    setAnalysis(null)
    setQuizAnswers({})
    setQuizSubmitted(false)
    setFlippedCards({})

    // Also load the embedded player & metadata cleanly in parallel
    void api.get('/youtube/info', { params: { url: targetUrl } })
      .then((res) => setPreview(res.data as VideoPreview))
      .catch(() => {})

    try {
      const response = await api.post('/ai/youtube', { url: targetUrl })
      setAnalysis(response.data as YouTubeAnalysis)
      setActiveTab('summary')
      toast.success('Video analyzed')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to analyze YouTube video'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setProcessing(false)
    }
  }

  const saveStudyNotes = async () => {
    if (!videoNotes.trim()) {
      toast.error('Write some notes first')
      return
    }
    setSavingNote(true)
    try {
      await api.post('/notes', {
        title: preview?.title || 'YouTube Lecture Notes',
        content: `Source: ${url.trim()}\n\n${videoNotes.trim()}`,
        tags: ['youtube', 'lecture'],
      })
      toast.success('Lecture notes saved to Notes library')
    } catch {
      toast.error('Failed to save lecture notes')
    } finally {
      setSavingNote(false)
    }
  }

  const tabs = [
    { id: 'summary' as YTTab, label: 'Summary', icon: Brain },
    { id: 'notes' as YTTab, label: 'Notes', icon: FileText },
    { id: 'transcript' as YTTab, label: 'Transcript', icon: List },
    { id: 'quiz' as YTTab, label: 'Quiz', icon: HelpCircle },
    { id: 'flashcards' as YTTab, label: 'Flashcards', icon: Zap },
  ]

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">YouTube Learning</h1>
        <p className="text-[#707070] text-sm mt-1">Watch lectures, take study notes, or generate AI summaries and quizzes</p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Input id="yt-url" placeholder="Paste YouTube video URL..." value={url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void loadVideoPreview()} leftIcon={<Video className="w-4 h-4 text-[#707070]" />} className="flex-1 min-w-60" />
        <Button variant="secondary" onClick={() => void loadVideoPreview()} isLoading={loadingPreview} leftIcon={<Play className="w-4 h-4" />}>
          Load Video
        </Button>
        <Button onClick={() => void processVideo()} isLoading={processing} leftIcon={<Brain className="w-4 h-4" />}>
          {processing ? 'Processing...' : 'AI Study Guide'}
        </Button>
      </div>

      {!preview && !analysis && !processing && (
        <button
          onClick={() => {
            const sample = 'https://www.youtube.com/watch?v=IHZwWFHWa-w'
            setUrl(sample)
            void loadVideoPreview(sample)
          }}
          className="text-xs text-[#5965B3] hover:underline font-medium"
        >
          Load sample 3Blue1Brown lecture →
        </button>
      )}

      {aiError && (
        <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {preview && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3 p-4 bg-white border-[#E7E5E0] space-y-3">
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${preview.videoId}`}
                title={preview.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#252525]">{preview.title}</h3>
              <p className="text-xs text-[#707070] mt-0.5">{preview.channel}</p>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4 bg-white border-[#E7E5E0] flex flex-col space-y-3">
            <CardHeader className="mb-0">
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#5965B3]" /> Lecture Notes</CardTitle>
              <Button size="sm" isLoading={savingNote} onClick={() => void saveStudyNotes()}>Save to Notes</Button>
            </CardHeader>
            <textarea
              value={videoNotes}
              onChange={e => setVideoNotes(e.target.value)}
              placeholder="Take Markdown notes while watching the lecture..."
              className="input flex-1 min-h-56 text-xs font-mono resize-none"
            />
          </Card>
        </div>
      )}

      {processing && (
        <Card className="p-8 text-center bg-white border-[#E7E5E0]">
          <Loader2 className="w-6 h-6 text-[#5965B3] animate-spin mx-auto mb-3" />
          <h3 className="font-semibold text-[#252525] text-sm mb-2">Analyzing video content...</h3>
          <p className="text-xs text-[#707070]">Extracting timestamps, summary notes, and practice items</p>
        </Card>
      )}

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-4 bg-white border-[#E7E5E0]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-12 rounded-lg bg-[#FAF9F6] border border-[#E7E5E0] flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-[#B45D5D]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-[#252525] truncate">{analysis.title}</h3>
                <div className="flex items-center gap-3 text-xs text-[#707070] mt-0.5">
                  {analysis.channel && <span>{analysis.channel}</span>}
                  {analysis.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#999999]" /> {analysis.duration}</span>}
                  <Badge variant="success">AI Guide Ready</Badge>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-[#E7E5E0] overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-[#ECEEF7] text-[#5965B3]' : 'text-[#707070] hover:text-[#252525] hover:bg-[#FAF9F6]')}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {activeTab === 'summary' && (
                <Card className="p-6 bg-white border-[#E7E5E0] prose-studymate text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.summary}</ReactMarkdown>
                </Card>
              )}
              {activeTab === 'transcript' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-3"><CardTitle>Topic Breakdown & Highlights</CardTitle></CardHeader>
                  <div className="space-y-3">{analysis.transcript.map((seg, i) => (<div key={i} className="flex gap-3"><span className="text-xs font-mono text-[#5965B3] w-14 flex-shrink-0 pt-0.5">{seg.time}</span><p className="text-xs text-[#252525] leading-relaxed">{seg.text}</p></div>))}</div>
                </Card>
              )}
              {activeTab === 'notes' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-3"><CardTitle>Key Notes</CardTitle></CardHeader>
                  <div className="space-y-3 text-xs text-[#252525]">
                    {analysis.notes.map((section, idx) => (
                      <div key={idx} className="p-3.5 bg-[#FAF9F6] border border-[#E7E5E0] rounded-lg space-y-1.5">
                        <h4 className="font-semibold text-xs">{section.heading}</h4>
                        <ul className="space-y-1 text-[#707070]">
                          {section.bullets.map((b, bi) => <li key={bi}>• {b}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {activeTab === 'quiz' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Video Quiz</CardTitle>
                    {quizSubmitted && (
                      <Badge variant="success">
                        Score: {analysis.quiz.filter((q, i) => quizAnswers[i] === q.ans).length}/{analysis.quiz.length}
                      </Badge>
                    )}
                  </CardHeader>
                  <div className="space-y-4">
                    {analysis.quiz.map((q, qi) => (
                      <div key={qi} className="space-y-2">
                        <p className="font-semibold text-[#252525] text-xs">{qi + 1}. {q.q}</p>
                        <div className="space-y-1.5">{q.opts.map((opt, oi) => (
                          <button key={oi} onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                            className={cn('w-full text-left px-3.5 py-2 rounded-lg border text-xs transition-all bg-white',
                              quizAnswers[qi] === oi && !quizSubmitted ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' :
                              quizSubmitted && oi === q.ans ? 'bg-[#EDF5F0] border-[#5C8A6A] text-[#5C8A6A]' :
                              quizSubmitted && quizAnswers[qi] === oi ? 'bg-[#FBEFEF] border-[#B45D5D] text-[#B45D5D]' :
                              'border-[#E7E5E0] text-[#707070] hover:bg-[#FAF9F6]')}>{opt}</button>
                        ))}</div>
                      </div>
                    ))}
                    {!quizSubmitted ? <Button onClick={() => setQuizSubmitted(true)} className="w-full">Submit</Button> : <Button variant="secondary" onClick={() => { setQuizAnswers({}); setQuizSubmitted(false) }} className="w-full">Try Again</Button>}
                  </div>
                </Card>
              )}
              {activeTab === 'flashcards' && (
                <Card className="p-6 bg-white border-[#E7E5E0]">
                  <CardHeader className="mb-4">
                    <CardTitle>Video Flashcards ({analysis.flashcards.length})</CardTitle>
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
                            flipped ? 'bg-[#ECEEF7]/50 border-[#5965B3]/40' : 'bg-[#FAF9F6] border-[#E7E5E0] hover:border-[#D4D2CD]'
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
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
