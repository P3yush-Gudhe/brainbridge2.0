import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Volume2, Brain, MessageSquare, Send, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any
  }
}

export function VoiceAssistantPage() {
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [response, setResponse] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef('')

  const processQuery = async (query: string) => {
    const clean = query.trim()
    if (!clean || loading) return
    setLoading(true)
    setAiError(null)
    try {
      const res = await api.post('/ai/chat', {
        messages: [{ role: 'user', content: clean }],
        stream: false,
        concise: true,
      })
      const aiResponse = String(res.data?.reply || '').trim()
      if (!aiResponse) throw new Error('Empty response from assistant')
      setResponse(aiResponse)
      setHistory(h => [{ q: clean, a: aiResponse }, ...h])
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(aiResponse)
        u.rate = 0.95
        setSpeaking(true)
        u.onend = () => setSpeaking(false)
        window.speechSynthesis.speak(u)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Voice assistant request failed'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Speech recognition not supported in this browser. Type your question below.'); return }
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    latestTranscriptRef.current = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      latestTranscriptRef.current = text
      setTranscript(text)
    }
    recognition.onend = () => {
      setListening(false)
      if (latestTranscriptRef.current.trim()) {
        void processQuery(latestTranscriptRef.current)
      }
    }
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
    setTranscript('')
  }

  const stopListening = () => { recognitionRef.current?.stop(); setListening(false) }

  const submitManual = () => {
    if (!manualInput.trim()) return
    const q = manualInput.trim()
    setManualInput('')
    setTranscript(q)
    void processQuery(q)
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Voice Assistant</h1>
        <p className="text-text-secondary text-sm mt-1">Speak or type to ask questions and listen to study explanations</p>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop voice recording' : 'Start voice recording'}
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center shadow-xs transition-all',
              listening ? 'bg-error text-white' : 'bg-accent text-white hover:bg-accent-hover'
            )}
          >
            {listening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </motion.button>
        </div>
        <p className="text-xs text-text-secondary font-medium mb-5">
          {listening ? 'Listening... tap to stop' : loading ? 'Thinking...' : 'Tap to start speaking'}
        </p>

        <div className="w-full max-w-md flex gap-2">
          <input
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder="Or type a question to hear it explained..."
            aria-label="Ask voice assistant by typing"
            className="input flex-1 text-xs py-2"
          />
          <button
            onClick={submitManual}
            disabled={!manualInput.trim() || loading}
            className="btn btn-primary btn-icon"
            title="Ask"
            aria-label="Send question"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 p-3.5 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2 max-w-md w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{aiError}</span>
          </div>
        )}

        {transcript && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-surface border border-border rounded-xl px-5 py-3 text-center max-w-md shadow-xs">
            <p className="text-xs text-text-primary italic">"{transcript}"</p>
          </motion.div>
        )}

        {response && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-accent-light border border-accent/20 rounded-xl px-5 py-4 max-w-md">
            <div className="flex items-center gap-2 mb-1.5">
              <Brain className="w-3.5 h-3.5 text-accent-text" />
              <span className="text-xs text-accent-text font-semibold">Study Assistant</span>
              {speaking && <Volume2 className="w-3.5 h-3.5 text-accent-text animate-pulse" />}
            </div>
            <p className="text-xs text-text-primary leading-relaxed">{response}</p>
          </motion.div>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Recent Voice History
          </h3>
          <div className="space-y-2.5">
            {history.map((item, i) => (
              <div key={i} className="card p-4 bg-surface border-border space-y-2 text-xs">
                <div className="flex gap-2">
                  <span className="font-semibold text-text-secondary w-8 flex-shrink-0">You:</span>
                  <p className="text-text-primary">{item.q}</p>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-accent-text w-8 flex-shrink-0">AI:</span>
                  <p className="text-text-secondary">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
