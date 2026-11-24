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
      const response = await api.post('/ai/ocr', {
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
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">OCR Text Extractor</h1>
        <p className="text-[#707070] text-sm mt-1">Extract text from textbook pages, handwritten notes, or images</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {!imageUrl ? (
            <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#E7E5E0] bg-white rounded-2xl p-12 text-center cursor-pointer hover:border-[#5965B3] hover:bg-[#FAF9F6] transition-all">
              <Upload className="w-8 h-8 text-[#707070] mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-[#252525] mb-1">Drop image here</h3>
              <p className="text-xs text-[#707070]">PNG, JPG, WEBP formats supported</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="relative">
              <img src={imageUrl} alt="Uploaded" className="w-full rounded-xl border border-[#E7E5E0]" />
              <button onClick={() => { setImageUrl(null); setImageData(null); setExtractedText(''); setAiText('') }} className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-white/90 border border-[#E7E5E0] flex items-center justify-center text-[#707070] hover:text-[#252525]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {imageUrl && !extractedText && <Button onClick={processOCR} isLoading={processing} className="w-full mt-4" leftIcon={<ScanLine className="w-4 h-4" />}>{processing ? 'Extracting...' : 'Extract text'}</Button>}
        </div>

        <div className="space-y-4">
          {aiError && (
            <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
          {extractedText ? (
            <>
              <Card className="p-5 bg-white border-[#E7E5E0]">
                <CardHeader className="mb-2">
                  <CardTitle>Extracted Text</CardTitle>
                  <button onClick={() => { navigator.clipboard.writeText(extractedText); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={cn('btn-icon-sm btn-ghost', copied ? 'text-[#5C8A6A]' : 'text-[#707070]')}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </CardHeader>
                <pre className="whitespace-pre-wrap text-xs text-[#252525] leading-relaxed font-mono">{extractedText}</pre>
              </Card>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleAI('summarize')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-white border border-[#E7E5E0] text-[#5965B3] text-xs font-semibold hover:bg-[#ECEEF7] transition-all disabled:opacity-50">
                  <Brain className="w-3.5 h-3.5" /> Summarize
                </button>
                <button onClick={() => handleAI('translate')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-white border border-[#E7E5E0] text-[#5965B3] text-xs font-semibold hover:bg-[#ECEEF7] transition-all disabled:opacity-50">
                  <Languages className="w-3.5 h-3.5" /> Translate
                </button>
                <button onClick={() => handleAI('notes')} disabled={aiLoading} className="flex items-center justify-center gap-1.5 p-3 rounded-lg bg-white border border-[#E7E5E0] text-[#5965B3] text-xs font-semibold hover:bg-[#ECEEF7] transition-all disabled:opacity-50">
                  <Wand2 className="w-3.5 h-3.5" /> Gen notes
                </button>
              </div>

              {(aiText || aiLoading) && (
                <Card className="p-5 bg-white border-[#E7E5E0]">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-[#707070] text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-[#5965B3]" /> Processing...
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose-studymate text-xs text-[#252525] leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                    </motion.div>
                  )}
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-[#999999] border border-[#E7E5E0] rounded-xl bg-white">
              <ScanLine className="w-8 h-8 mb-2 opacity-40 text-[#707070]" />
              <p className="text-xs">Upload an image to extract text</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
