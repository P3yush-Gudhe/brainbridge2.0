import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Download, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'

interface Branch {
  title: string
  children: string[]
}

const DEFAULT_BRANCHES: Branch[] = [
  { title: 'Supervised Learning', children: ['Regression', 'Classification', 'Decision Trees', 'SVM'] },
  { title: 'Unsupervised Learning', children: ['Clustering', 'PCA', 'K-Means', 'Dimensionality Reduction'] },
  { title: 'Reinforcement Learning', children: ['Q-Learning', 'Policy Gradient', 'Rewards', 'Environment'] },
  { title: 'Deep Learning', children: ['Neural Networks', 'CNN', 'RNN', 'Transformers'] },
]

export function MindMapPage() {
  const [topic, setTopic] = useState('Machine Learning')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [root, setRoot] = useState('Machine Learning')
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES)
  const [zoom, setZoom] = useState(1)

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/mindmap', { topic: topic.trim() })
      const data = response.data as { root?: string; branches?: Branch[] }
      if (!data.branches?.length) {
        const msg = 'Could not generate mind map branches'
        setAiError(msg)
        toast.error(msg)
        return
      }
      setRoot(data.root || topic.trim())
      setBranches(data.branches)
      toast.success('Mind map generated!')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to generate mind map'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const downloadOutline = () => {
    const markdown = [
      `# ${root}`,
      '',
      ...branches.flatMap(b => [
        `## ${b.title}`,
        ...b.children.map(c => `- ${c}`),
        '',
      ]),
    ].join('\n')
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${root.toLowerCase().replace(/\s+/g, '-')}-mindmap.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Mind map exported')
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Mind Maps</h1>
        <p className="text-[#707070] text-sm mt-1">Generate structured visual concept maps for study topics</p>
      </div>

      <div className="flex gap-2.5">
        <Input id="mindmap-topic" placeholder="Enter topic (e.g. Machine Learning)" value={topic} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && generate()} className="flex-1" />
        <Button onClick={generate} isLoading={generating} leftIcon={<Sparkles className="w-4 h-4" />}>Generate</Button>
      </div>

      {aiError && (
        <div className="p-3.5 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {root ? (
        <Card className="p-8 min-h-[460px] flex items-center justify-center relative overflow-hidden bg-white border-[#E7E5E0] shadow-xs">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #707070 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <div className="relative z-10 flex flex-col items-center" style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}>
            <motion.div key={root} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-6 py-2.5 bg-[#5965B3] text-white font-bold rounded-xl shadow-xs mb-14 text-base relative z-20">
              {root}
            </motion.div>
            <div className="flex flex-wrap justify-center gap-10">
              {branches.map((b, i) => (
                <motion.div key={`${b.title}-${i}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="flex flex-col items-center">
                  <div className="px-4 py-2 bg-[#ECEEF7] border border-[#5965B3]/20 rounded-lg text-xs font-semibold text-[#5965B3] mb-4 shadow-xs">{b.title}</div>
                  <div className="space-y-2">
                    {b.children.map(c => (
                      <div key={c} className="px-3 py-1.5 bg-white border border-[#E7E5E0] rounded-md text-[11px] text-[#252525] shadow-2xs text-center">{c}</div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-1 z-20">
            <button onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} className="btn btn-secondary btn-icon-sm rounded-md"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="btn btn-secondary btn-icon-sm rounded-md"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button onClick={downloadOutline} className="btn btn-secondary btn-icon-sm rounded-md" title="Export Markdown outline"><Download className="w-3.5 h-3.5" /></button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
