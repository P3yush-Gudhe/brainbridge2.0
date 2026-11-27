import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Download, ZoomIn, ZoomOut, AlertCircle, Plus, Trash2, BookOpen, Save, FolderOpen, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { MermaidDiagram } from '@/components/common/MermaidDiagram'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface Branch {
  title: string
  children: string[]
}

interface SavedMindMap {
  id: number
  title: string
  root: string
  branches: Branch[]
  updatedAt: string
}

const DEFAULT_BRANCHES: Branch[] = [
  { title: 'Supervised Learning', children: ['Regression', 'Classification', 'Decision Trees', 'SVM'] },
  { title: 'Unsupervised Learning', children: ['Clustering', 'PCA', 'K-Means', 'Dimensionality Reduction'] },
  { title: 'Reinforcement Learning', children: ['Q-Learning', 'Policy Gradient', 'Rewards', 'Environment'] },
  { title: 'Deep Learning', children: ['Neural Networks', 'CNN', 'RNN', 'Transformers'] },
]

function sanitizeMermaidLabel(input: string): string {
  return input.replace(/["`()[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim() || 'Node'
}

export function MindMapPage() {
  const [topic, setTopic] = useState('Machine Learning')
  const [generating, setGenerating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [savingMap, setSavingMap] = useState(false)
  const [loadingMaps, setLoadingMaps] = useState(true)
  const [savedMaps, setSavedMaps] = useState<SavedMindMap[]>([])
  const [activeMapId, setActiveMapId] = useState<number | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [root, setRoot] = useState('Machine Learning')
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES)
  const [zoom, setZoom] = useState(1)
  const [newBranchTitle, setNewBranchTitle] = useState('')
  const [childDrafts, setChildDrafts] = useState<Record<number, string>>({})
  const [viewMode, setViewMode] = useState<'canvas' | 'mermaid'>('canvas')

  const loadSavedMaps = useCallback(async () => {
    try {
      setLoadingMaps(true)
      const res = await api.get('/mindmaps')
      const list = (res.data?.mindMaps || []) as SavedMindMap[]
      setSavedMaps(list)
    } catch {
      toast.error('Failed to load saved mind maps')
    } finally {
      setLoadingMaps(false)
    }
  }, [])

  useEffect(() => {
    void loadSavedMaps()
  }, [loadSavedMaps])

  const mermaidSyntax = useMemo(() => {
    const lines = ['mindmap', `  root((${sanitizeMermaidLabel(root)}))`]
    branches.forEach((b) => {
      lines.push(`    ${sanitizeMermaidLabel(b.title)}`)
      b.children.forEach((c) => {
        lines.push(`      ${sanitizeMermaidLabel(c)}`)
      })
    })
    return lines.join('\n')
  }, [root, branches])

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
      setActiveMapId(null)
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

  const saveMindMap = async () => {
    if (!root.trim()) return
    setSavingMap(true)
    try {
      if (activeMapId) {
        const res = await api.patch(`/mindmaps/${activeMapId}`, {
          title: root.trim(),
          root: root.trim(),
          branches,
        })
        const updated = res.data.mindMap as SavedMindMap
        setSavedMaps((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        toast.success('Mind map updated')
      } else {
        const res = await api.post('/mindmaps', {
          title: root.trim(),
          root: root.trim(),
          branches,
        })
        const created = res.data.mindMap as SavedMindMap
        setSavedMaps((prev) => [created, ...prev])
        setActiveMapId(created.id)
        toast.success('Mind map saved (+10 XP)')
      }
    } catch {
      toast.error('Failed to save mind map')
    } finally {
      setSavingMap(false)
    }
  }

  const deleteSavedMap = async (id: number) => {
    try {
      await api.delete(`/mindmaps/${id}`)
      setSavedMaps((prev) => prev.filter((m) => m.id !== id))
      if (activeMapId === id) setActiveMapId(null)
      toast.success('Mind map deleted')
    } catch {
      toast.error('Failed to delete mind map')
    }
  }

  const selectSavedMap = (m: SavedMindMap) => {
    setActiveMapId(m.id)
    setRoot(m.root)
    setTopic(m.root)
    setBranches(Array.isArray(m.branches) ? m.branches : [])
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
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Mind Maps</h1>
          <p className="text-text-secondary text-sm mt-1">Build, save, or AI-generate structured visual concept maps</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setViewMode(v => v === 'canvas' ? 'mermaid' : 'canvas')}
            leftIcon={<GitBranch className="w-3.5 h-3.5" />}
          >
            {viewMode === 'canvas' ? 'Mermaid View' : 'Editor View'}
          </Button>
          <Button size="sm" isLoading={savingMap} onClick={() => void saveMindMap()} leftIcon={<Save className="w-3.5 h-3.5" />}>
            {activeMapId ? 'Update Saved' : 'Save Map'}
          </Button>
          <Button variant="secondary" size="sm" isLoading={savingNote} onClick={() => void saveToNotes()} leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
            Save to Notes
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadOutline} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export .md
          </Button>
        </div>
      </div>

      {!loadingMaps && savedMaps.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1 flex-shrink-0">
            <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" /> Saved:
          </span>
          {savedMaps.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg border text-xs flex-shrink-0 cursor-pointer transition-all',
                activeMapId === m.id
                  ? 'bg-accent-light border-accent text-accent-text font-medium'
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary'
              )}
              onClick={() => selectSavedMap(m)}
            >
              <span className="truncate max-w-36">{m.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteSavedMap(m.id)
                }}
                aria-label={`Delete saved map ${m.title}`}
                className="p-0.5 rounded hover:bg-error-light text-text-muted hover:text-error"
                title="Delete saved map"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
        <Button onClick={() => void generate()} isLoading={generating} leftIcon={<Sparkles className="w-4 h-4" />}>AI Generate</Button>
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
        <div role="alert" className="p-3.5 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{aiError}</span>
        </div>
      )}

      {viewMode === 'mermaid' ? (
        <Card className="p-6">
          <MermaidDiagram chart={mermaidSyntax} className="min-h-[380px] flex items-center justify-center overflow-x-auto" />
        </Card>
      ) : root ? (
        <Card className="p-6 sm:p-8 min-h-[460px] flex items-center justify-center relative overflow-auto">
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-text-muted) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative z-10 flex flex-col items-center w-full" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
            <motion.div key={root} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-6 py-2.5 bg-[#5965B3] text-white font-bold rounded-xl shadow-xs mb-10 text-base relative z-20">
              {root}
            </motion.div>
            <div className="flex flex-wrap justify-center gap-6">
              {branches.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col items-center w-48 bg-surface-subtle/90 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-1 w-full mb-3">
                    <input
                      value={b.title}
                      aria-label={`Branch ${i + 1} title`}
                      onChange={e => renameBranch(i, e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-light border border-accent/25 rounded-lg text-xs font-semibold text-accent-text outline-none text-center"
                    />
                    <button type="button" onClick={() => removeBranch(i)} aria-label={`Remove branch ${b.title}`} className="p-1 text-text-muted hover:text-error" title="Remove branch">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 w-full mb-2">
                    {b.children.map((c, ci) => (
                      <div key={ci} className="group flex items-center justify-between gap-1 px-2.5 py-1.5 bg-surface border border-border rounded-md text-[11px] text-text-primary shadow-2xs">
                        <span className="truncate flex-1">{c}</span>
                        <button type="button" onClick={() => removeChild(i, ci)} aria-label={`Remove subtopic ${c}`} className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
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
                      aria-label={`Add subtopic to ${b.title}`}
                      className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-surface border border-border rounded text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => addChild(i)} aria-label={`Add subtopic to ${b.title}`} className="px-2 py-1 bg-accent-light text-accent-text rounded text-[11px] font-semibold hover:bg-[#5965B3] hover:text-white transition-colors">
                      +
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-1 z-20">
            <button type="button" onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} aria-label="Zoom out mind map" className="btn btn-secondary btn-icon-sm rounded-md"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setZoom(z => Math.min(1.4, z + 0.1))} aria-label="Zoom in mind map" className="btn btn-secondary btn-icon-sm rounded-md"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
