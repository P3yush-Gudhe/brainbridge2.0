import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload, ScanLine, Copy, Wand2, Languages, Brain, Check, Loader2, X, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

function imageToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIdx = result.indexOf(',')
      resolve({
        base64: commaIdx >= 0 ? result.slice(commaIdx + 1) : result,
        mimeType: file.type || 'image/png',
      })
    }
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

export function OCRScannerPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    try {
      const data = await imageToBase64(file)
      setImageUrl(URL.createObjectURL(file))
      setImageData(data)
      setExtractedText('')
      setAiText('')
    } catch {
      toast.error('Failed to read image file')
    }
  }

  const processOCR = async () => {
    if (!imageData) return
    setProcessing(true)
    setAiError(null)
    try {
      const response = await api.post('/uploads/image', {
        action: 'extract',
        imageBase64: imageData.base64,
        mimeType: imageData.mimeType,
      })
      setExtractedText(response.data?.text || '')
      toast.success('Text extracted')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'OCR extraction failed'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleAI = async (action: 'summarize' | 'translate' | 'notes') => {
    if (!extractedText.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/ocr', {
        action,
        text: extractedText,
        targetLanguage: 'Spanish',
      })
      setAiText(response.data?.result || '')
      toast.success('Action completed')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'AI action failed'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">OCR Text Extractor</h1>
        <p className="text-text-secondary text-sm mt-1">Extract text from textbook pages, handwritten notes, or images</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {!imageUrl ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload an image to extract text"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border bg-surface rounded-2xl p-12 text-center cursor-pointer hover:border-accent hover:bg-surface-subtle transition-all"
            >
              <Upload className="w-8 h-8 text-text-secondary mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-text-primary mb-1">Drop image here</h3>
              <p className="text-xs text-text-secondary">PNG, JPG, WEBP formats supported</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="relative">
              <img src={imageUrl} alt="Uploaded study page for OCR extraction" className="w-full rounded-xl border border-border" />
              <button
                onClick={() => { setImageUrl(null); setImageData(null); setExtractedText(''); setAiText('') }}
                aria-label="Remove uploaded image"
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-surface/90 border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {imageUrl && !extractedText && <Button onClick={processOCR} isLoading={processing} className="w-full mt-4" leftIcon={<ScanLine className="w-4 h-4" />}>{processing ? 'Extracting...' : 'Extract text'}</Button>}
        </div>

        <div className="space-y-4">
          {aiError && (
            <div className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
          {extractedText ? (
            <>
              <Card className="p-5 bg-surface border-border">
                <CardHeader className="mb-2">
                  <CardTitle>Extracted Text</CardTitle>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(extractedText); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    className={cn('btn-icon-sm btn-ghost', copied ? 'text-success' : 'text-text-secondary')}
                    aria-label="Copy extracted text"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </CardHeader>
                <pre className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed font-mono">{extractedText}</pre>
              </Card>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleAI('summarize')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-surface border border-border text-accent-text text-xs font-semibold hover:bg-accent-light transition-all disabled:opacity-50">
                  <Brain className="w-3.5 h-3.5" /> Summarize
                </button>
                <button onClick={() => handleAI('translate')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-surface border border-border text-accent-text text-xs font-semibold hover:bg-accent-light transition-all disabled:opacity-50">
                  <Languages className="w-3.5 h-3.5" /> Translate
                </button>
                <button onClick={() => handleAI('notes')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-surface border border-border text-accent-text text-xs font-semibold hover:bg-accent-light transition-all disabled:opacity-50">
                  <Wand2 className="w-3.5 h-3.5" /> Gen notes
                </button>
              </div>

              {(aiText || aiLoading) && (
                <Card className="p-5 bg-surface border-border">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-text-secondary text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-text" /> Processing...
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose-studymate text-xs text-text-primary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                    </motion.div>
                  )}
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-text-muted border border-border rounded-xl bg-surface">
              <ScanLine className="w-8 h-8 mb-2 opacity-40 text-text-secondary" />
              <p className="text-xs">Upload an image to extract text</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
