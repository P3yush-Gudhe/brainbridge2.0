import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, AlertTriangle, CheckCircle2, XCircle, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface Subject {
  id: number
  name: string
  required: number
  attended: number
  total: number
}

export function AttendancePage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newSubject, setNewSubject] = useState({ name: '', required: '75', total: '', attended: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/attendance')
        if (!active) return
        setSubjects((res.data?.subjects || []) as Subject[])
      } catch (error: unknown) {
        if (!active) return
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load attendance')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const getAttendance = (s: Subject) => s.total > 0 ? (s.attended / s.total * 100) : 0

  const getCanMiss = (s: Subject) => {
    const req = s.required / 100
    return Math.max(0, Math.floor(s.attended / req - s.total))
  }

  const getMustAttend = (s: Subject) => {
    const req = s.required / 100
    const needed = (req * s.total - s.attended) / (1 - req)
    return Math.max(0, Math.ceil(needed))
  }

  const markAttendance = async (id: number, type: 'present' | 'absent') => {
    try {
      const res = await api.post(`/attendance/${id}/mark`, { type })
      const updated = res.data.subject as Subject
      setSubjects(subs => subs.map(s => s.id === id ? updated : s))
      toast.success(type === 'present' ? 'Marked Present' : 'Marked Absent')
    } catch {
      toast.error('Failed to update attendance')
    }
  }

  const addSubject = async () => {
    if (!newSubject.name.trim()) return
    try {
      const res = await api.post('/attendance', {
        name: newSubject.name.trim(),
        required: parseInt(newSubject.required) || 75,
        attended: parseInt(newSubject.attended) || 0,
        total: parseInt(newSubject.total) || 0,
      })
      const created = res.data.subject as Subject
      setSubjects(s => [...s, created])
      setShowModal(false)
      setNewSubject({ name: '', required: '75', total: '', attended: '' })
      toast.success('Subject added')
    } catch {
      toast.error('Failed to add subject')
    }
  }

  const deleteSubject = async (id: number) => {
    try {
      await api.delete(`/attendance/${id}`)
      setSubjects(s => s.filter(sub => sub.id !== id))
      toast.success('Subject deleted')
    } catch {
      toast.error('Failed to delete subject')
    }
  }

  const overallAttendance = subjects.length > 0
    ? subjects.reduce((sum, s) => sum + getAttendance(s), 0) / subjects.length
    : 0

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Attendance Tracker</h1>
          <p className="text-[#707070] text-sm mt-1">Monitor course attendance and requirements</p>
        </div>
        <Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Add subject</Button>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D]">{loadError}</div>
      )}

      {/* Overall Card */}
      <Card className={cn(
        'p-6 border bg-white',
        overallAttendance >= 75 || subjects.length === 0 ? 'border-[#5C8A6A]/30' : 'border-[#B45D5D]/30'
      )}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold text-[#707070] uppercase tracking-wider mb-1">Overall Attendance</div>
            <div className="text-4xl font-bold font-mono text-[#252525]">{overallAttendance.toFixed(1)}%</div>
          </div>
          {overallAttendance >= 75 || subjects.length === 0
            ? <CheckCircle2 className="w-8 h-8 text-[#5C8A6A]" />
            : <AlertTriangle className="w-8 h-8 text-[#B45D5D]" />}
        </div>
        <div className="h-2 bg-[#F0F0ED] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${overallAttendance >= 75 || subjects.length === 0 ? 'bg-[#5C8A6A]' : 'bg-[#B45D5D]'}`}
            animate={{ width: `${Math.min(overallAttendance, 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </Card>

      {/* Subjects */}
      {loading ? (
        <div className="text-center py-8 text-xs text-[#707070]">Loading attendance...</div>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No subjects tracked yet"
          description="Add your courses to track attended classes and safe bunk margins."
          action={<Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Add subject</Button>}
        />
      ) : (
        <div className="space-y-4">
          {subjects.map((subject) => {
            const pct = getAttendance(subject)
            const safe = pct >= subject.required
            const canMiss = getCanMiss(subject)
            const mustAttend = getMustAttend(subject)

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 bg-white border-[#E7E5E0]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[#252525] text-sm">{subject.name}</h3>
                    <div className="flex items-center gap-2.5 mt-1 text-xs text-[#707070]">
                      <span>{subject.attended}/{subject.total} classes</span>
                      <Badge variant={safe ? 'success' : 'danger'}>{pct.toFixed(1)}%</Badge>
                      <span className="font-mono text-[11px] text-[#999999]">Required: {subject.required}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => void markAttendance(subject.id, 'present')} className="btn btn-sm bg-[#EDF5F0] border border-[#5C8A6A]/30 text-[#5C8A6A] hover:bg-[#5C8A6A] hover:text-white" title="Mark Present">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void markAttendance(subject.id, 'absent')} className="btn btn-sm bg-[#FBEFEF] border border-[#B45D5D]/30 text-[#B45D5D] hover:bg-[#B45D5D] hover:text-white" title="Mark Absent">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void deleteSubject(subject.id)} className="btn-icon-sm btn-ghost text-[#999999] hover:text-[#B45D5D]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-1.5 bg-[#F0F0ED] rounded-full overflow-hidden mb-3">
                  <motion.div
                    className={`h-full rounded-full transition-all ${
                      pct >= subject.required ? 'bg-[#5C8A6A]' : pct >= 65 ? 'bg-[#B4863A]' : 'bg-[#B45D5D]'
                    }`}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <div className={cn(
                  'text-xs rounded-lg px-3 py-2 flex items-center gap-2 font-medium',
                  safe ? 'bg-[#EDF5F0] text-[#5C8A6A]' : 'bg-[#FBEFEF] text-[#B45D5D]'
                )}>
                  {safe ? (
                    <><TrendingUp className="w-3.5 h-3.5 flex-shrink-0" /> You can miss <strong>{canMiss}</strong> more class{canMiss !== 1 ? 'es' : ''} safely</>
                  ) : (
                    <><TrendingDown className="w-3.5 h-3.5 flex-shrink-0" /> You need to attend <strong>{mustAttend}</strong> more class{mustAttend !== 1 ? 'es' : ''} to reach {subject.required}%</>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Subject">
        <div className="space-y-4">
          <Input id="sub-name" label="Subject name" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(s => ({ ...s, name: e.target.value }))} />
          <Input id="sub-required" label="Required attendance (%)" type="number" placeholder="75" value={newSubject.required} onChange={e => setNewSubject(s => ({ ...s, required: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="sub-attended" label="Classes attended" type="number" placeholder="0" value={newSubject.attended} onChange={e => setNewSubject(s => ({ ...s, attended: e.target.value }))} />
            <Input id="sub-total" label="Total classes" type="number" placeholder="0" value={newSubject.total} onChange={e => setNewSubject(s => ({ ...s, total: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => void addSubject()}>Add subject</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
