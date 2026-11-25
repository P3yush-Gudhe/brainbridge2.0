import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Download, ZoomIn, ZoomOut, AlertCircle, Plus, Trash2, BookOpen } from 'lucide-react'
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
  const [savingNote, setSavingNote] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [root, setRoot] = useState('Machine Learning')
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES)
  const [zoom, setZoom] = useState(1)
  const [newBranchTitle, setNewBranchTitle] = useState('')
  const [childDrafts, setChildDrafts] = useState<Record<number, string>>({})

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

  const applyRootTopic = () => {
    if (!topic.trim()) return
    setRoot(topic.trim())
    toast.success('Central topic updated')
  }

  const addBranch = () => {
    if (!newBranchTitle.trim()) return
    setBranches(prev => [...prev, { title: newBranchTitle.trim(), children: [] }])
    setNewBranchTitle('')
  }

  const removeBranch = (idx: number) => {
    setBranches(prev => prev.filter((_, i) => i !== idx))
  }

  const renameBranch = (idx: number, title: string) => {
    setBranches(prev => prev.map((b, i) => (i === idx ? { ...b, title } : b)))
  }

  const addChild = (branchIdx: number) => {
    const text = (childDrafts[branchIdx] || '').trim()
    if (!text) return
    setBranches(prev => prev.map((b, i) => (i === branchIdx ? { ...b, children: [...b.children, text] } : b)))
    setChildDrafts(prev => ({ ...prev, [branchIdx]: '' }))
  }

  const removeChild = (branchIdx: number, childIdx: number) => {
    setBranches(prev =>
      prev.map((b, i) =>
        i === branchIdx ? { ...b, children: b.children.filter((_, ci) => ci !== childIdx) } : b
      )
    )
  }

  const toMarkdown = () =>
    [
      `# ${root}`,
      '',
      ...branches.flatMap(b => [
        `## ${b.title}`,
        ...b.children.map(c => `- ${c}`),
        '',
      ]),
    ].join('\n')

  const downloadOutline = () => {
    const blob = new Blob([toMarkdown()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${root.toLowerCase().replace(/\s+/g, '-')}-mindmap.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Mind map exported')
  }

  const saveToNotes = async () => {
    setSavingNote(true)
    try {
      await api.post('/notes', {
        title: `${root} — Mind Map`,
        content: toMarkdown(),
        tags: ['mindmap'],
      })
      toast.success('Saved to your Notes library')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Mind Maps</h1>
          <p className="text-[#707070] text-sm mt-1">Build, edit, or AI-generate structured visual concept maps</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" isLoading={savingNote} onClick={() => void saveToNotes()} leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
            Save to Notes
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadOutline} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export .md
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Input
          id="mindmap-topic"
          placeholder="Enter central topic (e.g. Machine Learning)"
          value={topic}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && applyRootTopic()}
          className="flex-1 min-w-52"
        />
        <Button variant="secondary" onClick={applyRootTopic}>Set Topic</Button>
        <Button onClick={generate} isLoading={generating} leftIcon={<Sparkles className="w-4 h-4" />}>AI Generate</Button>
      </div>

      <div className="flex gap-2.5 items-center">
        <Input
          id="new-branch"
          placeholder="Add a new branch (e.g. Evaluation Metrics)..."
          value={newBranchTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBranchTitle(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addBranch()}
          className="flex-1"
        />
        <Button variant="secondary" onClick={addBranch} leftIcon={<Plus className="w-4 h-4" />}>Add Branch</Button>
      </div>

      {aiError && (
        <div className="p-3.5 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {root ? (
        <Card className="p-8 min-h-[460px] flex items-center justify-center relative overflow-auto bg-white border-[#E7E5E0] shadow-xs">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #707070 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <div className="relative z-10 flex flex-col items-center w-full" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
            <motion.div key={root} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-6 py-2.5 bg-[#5965B3] text-white font-bold rounded-xl shadow-xs mb-10 text-base relative z-20">
              {root}
            </motion.div>
            <div className="flex flex-wrap justify-center gap-6">
              {branches.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col items-center w-48 bg-[#FAF9F6]/90 border border-[#E7E5E0] rounded-xl p-3">
                  <div className="flex items-center gap-1 w-full mb-3">
                    <input
                      value={b.title}
                      onChange={e => renameBranch(i, e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#ECEEF7] border border-[#5965B3]/20 rounded-lg text-xs font-semibold text-[#5965B3] outline-none text-center"
                    />
                    <button onClick={() => removeBranch(i)} className="p-1 text-[#999999] hover:text-[#B45D5D]" title="Remove branch">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 w-full mb-2">
                    {b.children.map((c, ci) => (
                      <div key={ci} className="group flex items-center justify-between gap-1 px-2.5 py-1.5 bg-white border border-[#E7E5E0] rounded-md text-[11px] text-[#252525] shadow-2xs">
                        <span className="truncate flex-1">{c}</span>
                        <button onClick={() => removeChild(i, ci)} className="text-[#999999] hover:text-[#B45D5D] opacity-0 group-hover:opacity-100 transition-opacity">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 w-full mt-auto">
                    <input
                      value={childDrafts[i] || ''}
                      onChange={e => setChildDrafts(prev => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addChild(i)}
                      placeholder="+ Subtopic"
                      className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-white border border-[#E7E5E0] rounded outline-none focus:border-[#5965B3]"
                    />
                    <button onClick={() => addChild(i)} className="px-2 py-1 bg-[#ECEEF7] text-[#5965B3] rounded text-[11px] font-semibold hover:bg-[#5965B3] hover:text-white transition-colors">
                      +
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-1 z-20">
            <button onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} className="btn btn-secondary btn-icon-sm rounded-md"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button onClick={() => setZoom(z => Math.min(1.4, z + 0.1))} className="btn btn-secondary btn-icon-sm rounded-md"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
