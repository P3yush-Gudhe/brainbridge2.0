import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Sparkles, CheckCircle2,
  Circle, Target, Brain, Trash2, AlertCircle, Download, GripVertical
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'
import { buildStudyCalendarIcs } from '@/lib/ics'
import api from '@/lib/api'

interface Exam {
  id: number
  subject: string
  date: Date
  hoursNeeded: number
}

interface StudyTask {
  id: number
  subject: string
  topic: string
  date: Date
  duration: number
  done: boolean
}

function getDaysInWeek(date: Date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function StudyPlannerPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [weekDate, setWeekDate] = useState(() => new Date())
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dragOverDayIdx, setDragOverDayIdx] = useState<number | null>(null)
  const [showExamModal, setShowExamModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [newExam, setNewExam] = useState({ subject: '', date: '', hours: '' })
  const [newTask, setNewTask] = useState({ subject: '', topic: '', date: '', duration: '60' })
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState('Add upcoming exams or tasks, then generate a personalized weekly plan. Drag tasks onto any day to reschedule.')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/planner')
        if (!active) return
        const rawExams = (res.data?.exams || []) as Array<{ id: number; subject: string; examDate: string; hoursNeeded: number }>
        const rawTasks = (res.data?.tasks || []) as Array<{ id: number; subject: string; topic: string; taskDate: string; duration: number; done: boolean }>
        setExams(rawExams.map(e => ({ id: e.id, subject: e.subject, date: new Date(e.examDate), hoursNeeded: e.hoursNeeded })))
        setTasks(rawTasks.map(t => ({ id: t.id, subject: t.subject, topic: t.topic, date: new Date(t.taskDate), duration: t.duration, done: t.done })))
      } catch (error: unknown) {
        if (!active) return
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load planner')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const weekDays = getDaysInWeek(weekDate)

  const toggleTask = async (id: number) => {
    const target = tasks.find(t => t.id === id)
    if (!target) return
    const nextDone = !target.done
    setTasks(t => t.map(task => task.id === id ? { ...task, done: nextDone } : task))
    try {
      await api.patch(`/planner/tasks/${id}`, { done: nextDone })
    } catch {
      setTasks(t => t.map(task => task.id === id ? { ...task, done: target.done } : task))
      toast.error('Failed to update task')
    }
  }

  const rescheduleTask = async (taskId: number, targetDate: Date) => {
    const existing = tasks.find(t => t.id === taskId)
    if (!existing) return
    const normalized = new Date(targetDate)
    normalized.setHours(12, 0, 0, 0)
    const prevDate = existing.date
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: normalized } : t))
    try {
      await api.patch(`/planner/tasks/${taskId}`, { taskDate: normalized.toISOString() })
      toast.success(`Moved to ${formatDate(normalized, { month: 'short', day: 'numeric' })}`)
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: prevDate } : t))
      toast.error('Failed to reschedule task')
    }
  }

  const shiftTaskDay = (task: StudyTask, deltaDays: number) => {
    const next = new Date(task.date)
    next.setDate(next.getDate() + deltaDays)
    void rescheduleTask(task.id, next)
  }

  const deleteTask = async (id: number) => {
    try {
      await api.delete(`/planner/tasks/${id}`)
      setTasks(t => t.filter(task => task.id !== id))
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const deleteExam = async (id: number) => {
    try {
      await api.delete(`/planner/exams/${id}`)
      setExams(e => e.filter(item => item.id !== id))
    } catch {
      toast.error('Failed to delete exam')
    }
  }

  const getTasksForDay = (day: Date) => {
    return tasks.filter(t => {
      const td = new Date(t.date)
      return td.getDate() === day.getDate() && td.getMonth() === day.getMonth() && td.getFullYear() === day.getFullYear()
    })
  }

  const addExam = async () => {
    if (!newExam.subject.trim() || !newExam.date) return
    try {
      const res = await api.post('/planner/exams', {
        subject: newExam.subject.trim(),
        examDate: newExam.date,
        hoursNeeded: parseInt(newExam.hours) || 15,
      })
      const created = res.data.exam as { id: number; subject: string; examDate: string; hoursNeeded: number }
      setExams(e => [...e, { id: created.id, subject: created.subject, date: new Date(created.examDate), hoursNeeded: created.hoursNeeded }])
      setShowExamModal(false)
      setNewExam({ subject: '', date: '', hours: '' })
      toast.success('Exam added')
    } catch {
      toast.error('Failed to add exam')
    }
  }

  const addTask = async () => {
    if (!newTask.subject.trim() || !newTask.topic.trim()) return
    try {
      const res = await api.post('/planner/tasks', {
        tasks: [{
          subject: newTask.subject.trim(),
          topic: newTask.topic.trim(),
          taskDate: newTask.date || new Date().toISOString(),
          duration: parseInt(newTask.duration) || 60,
        }],
      })
      const createdList = (res.data.tasks || []) as Array<{ id: number; subject: string; topic: string; taskDate: string; duration: number; done: boolean }>
      setTasks(t => [...createdList.map(item => ({
        id: item.id,
        subject: item.subject,
        topic: item.topic,
        date: new Date(item.taskDate),
        duration: item.duration,
        done: item.done,
      })), ...t])
      setShowTaskModal(false)
      setNewTask({ subject: '', topic: '', date: '', duration: '60' })
      toast.success('Task added')
    } catch {
      toast.error('Failed to add task')
    }
  }

  const generatePlan = async () => {
    setGeneratingPlan(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/planner', {
        exams: exams.map(e => ({ subject: e.subject, date: e.date.toISOString(), hoursNeeded: e.hoursNeeded })),
        existingTasks: tasks.map(t => ({ subject: t.subject, topic: t.topic, done: t.done })),
      })
      const data = response.data as {
        recommendation?: string
        tasks?: Array<{ subject: string; topic: string; dateOffsetDays: number; duration: number }>
      }
      if (data.recommendation) setRecommendation(data.recommendation)
      if (data.tasks?.length) {
        const now = Date.now()
        const savedRes = await api.post('/planner/tasks', {
          tasks: data.tasks.map(t => ({
            subject: t.subject,
            topic: t.topic,
            taskDate: new Date(now + Math.max(0, Math.min(6, t.dateOffsetDays || 0)) * 86400000).toISOString(),
            duration: t.duration || 60,
          })),
        })
        const created = (savedRes.data.tasks || []) as Array<{ id: number; subject: string; topic: string; taskDate: string; duration: number; done: boolean }>
        setTasks(prev => [...created.map(t => ({
          id: t.id,
          subject: t.subject,
          topic: t.topic,
          date: new Date(t.taskDate),
          duration: t.duration,
          done: t.done,
        })), ...prev])
      }
      toast.success('AI study plan generated & saved')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to generate study plan'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setGeneratingPlan(false)
    }
  }

  const exportCalendarIcs = () => {
    if (exams.length === 0 && tasks.filter(t => !t.done).length === 0) {
      toast.error('Add at least one exam or pending task before exporting')
      return
    }
    const ics = buildStudyCalendarIcs(exams, tasks)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'studymate-schedule.ics'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Calendar exported (.ics)')
  }

  const daysUntil = (date: Date) => Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000))

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Study Planner</h1>
          <p className="text-text-secondary text-sm mt-1">AI schedule generation, drag-to-reschedule calendar, and .ics calendar export</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCalendarIcs} leftIcon={<Download className="w-4 h-4" />}>
            Export .ics
          </Button>
          <Button variant="secondary" onClick={() => setShowExamModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Add exam
          </Button>
          <Button onClick={generatePlan} isLoading={generatingPlan} leftIcon={<Sparkles className="w-4 h-4" />}>
            Generate plan
          </Button>
        </div>
      </div>

      {(loadError || aiError) && (
        <div className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{aiError || loadError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 bg-surface border-border">
            <CardHeader className="mb-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4 text-accent-text" /> Weekly Schedule</CardTitle>
                <p className="text-[11px] text-text-muted mt-0.5">Drag any task chip or card onto a day cell to reschedule</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekDate(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n })}
                  className="btn-icon text-text-secondary hover:text-text-primary"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-text-secondary font-mono">
                  {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekDate(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n })}
                  className="btn-icon text-text-secondary hover:text-text-primary"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((day, i) => {
                const dayTasks = getTasksForDay(day)
                const isToday = day.toDateString() === new Date().toDateString()
                const isDragOver = dragOverDayIdx === i
                return (
                  <div
                    key={i}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragOverDayIdx !== i) setDragOverDayIdx(i)
                    }}
                    onDragLeave={() => {
                      if (dragOverDayIdx === i) setDragOverDayIdx(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverDayIdx(null)
                      const rawId = e.dataTransfer.getData('text/plain')
                      const parsedId = Number(rawId) || draggedTaskId
                      if (parsedId) {
                        void rescheduleTask(parsedId, day)
                      }
                      setDraggedTaskId(null)
                    }}
                    className={cn(
                      'min-h-28 rounded-lg p-1.5 sm:p-2 border transition-all bg-surface-subtle',
                      isToday ? 'border-accent bg-accent-light/40' : 'border-border',
                      isDragOver && 'ring-2 ring-accent bg-accent-light/60'
                    )}
                  >
                    <div className="text-center mb-1.5">
                      <div className="text-[10px] text-text-muted font-mono uppercase">{['Su','Mo','Tu','We','Th','Fr','Sa'][i]}</div>
                      <div className={cn('text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-0.5',
                        isToday ? 'bg-accent text-white' : 'text-text-primary'
                      )}>{day.getDate()}</div>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedTaskId(task.id)
                            e.dataTransfer.setData('text/plain', String(task.id))
                          }}
                          onDragEnd={() => { setDraggedTaskId(null); setDragOverDayIdx(null) }}
                          title={`${task.subject}: ${task.topic} (drag to move)`}
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded bg-accent-light text-accent-text truncate cursor-grab active:cursor-grabbing font-medium',
                            task.done && 'opacity-45 line-through'
                          )}
                        >
                          {task.topic}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-text-secondary font-mono text-center">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Study Tasks</h3>
              <button type="button" onClick={() => setShowTaskModal(true)} className="btn btn-secondary btn-sm gap-1.5"><Plus className="w-3.5 h-3.5" /> Add task</button>
            </div>
            {loading ? (
              <SkeletonList count={3} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No study tasks scheduled yet"
                description="Add a study task manually or generate an AI plan from your upcoming exams."
                action={<Button size="sm" onClick={() => setShowTaskModal(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>Add task</Button>}
              />
            ) : tasks.map(task => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                draggable
                onDragStart={(e) => {
                  setDraggedTaskId(task.id)
                  const dt = (e as unknown as React.DragEvent).dataTransfer
                  dt?.setData('text/plain', String(task.id))
                }}
                onDragEnd={() => { setDraggedTaskId(null); setDragOverDayIdx(null) }}
                className={cn('card p-4 flex items-center gap-3 bg-surface border-border group cursor-grab active:cursor-grabbing', task.done && 'opacity-60')}
              >
                <GripVertical className="w-4 h-4 text-text-muted hidden sm:block flex-shrink-0" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => void toggleTask(task.id)}
                  className={cn('flex-shrink-0', task.done ? 'text-success' : 'text-text-muted hover:text-accent-text')}
                  aria-label={task.done ? `Mark ${task.topic} pending` : `Mark ${task.topic} completed`}
                >
                  {task.done ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-semibold truncate', task.done ? 'text-text-secondary line-through' : 'text-text-primary')}>{task.topic}</div>
                  <div className="text-xs text-text-secondary">{task.subject} • {task.duration} min • {formatDate(task.date, { month: 'short', day: 'numeric' })}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => shiftTaskDay(task, -1)}
                    className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-text-secondary hover:bg-surface-subtle"
                    title="Move back 1 day"
                    aria-label={`Move ${task.topic} back one day`}
                  >
                    -1d
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftTaskDay(task, 1)}
                    className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-text-secondary hover:bg-surface-subtle"
                    title="Move forward 1 day"
                    aria-label={`Move ${task.topic} forward one day`}
                  >
                    +1d
                  </button>
                </div>
                <Badge variant={task.done ? 'success' : 'neutral'}>{task.done ? 'Completed' : 'Pending'}</Badge>
                <button
                  type="button"
                  onClick={() => void deleteTask(task.id)}
                  className="text-text-muted hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete task ${task.topic}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <Card className="p-5 bg-surface border-border">
            <CardHeader className="mb-3">
              <CardTitle className="flex items-center gap-2"><Target className="w-4 h-4 text-warning" /> Upcoming Exams</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {exams.length === 0 ? (
                <div className="text-xs text-text-secondary py-2">No upcoming exams added.</div>
              ) : [...exams].sort((a, b) => a.date.getTime() - b.date.getTime()).map(exam => {
                const days = daysUntil(exam.date)
                return (
                  <div key={exam.id} className="p-3.5 rounded-lg bg-surface-subtle border border-border group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-text-primary">{exam.subject}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'neutral'}>
                          {days}d left
                        </Badge>
                        <button
                          type="button"
                          onClick={() => void deleteExam(exam.id)}
                          className="text-text-muted hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          aria-label={`Delete exam ${exam.subject}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary mb-1">{formatDate(exam.date)}</div>
                    <div className="text-[11px] text-text-muted font-mono">{exam.hoursNeeded}h needed • {Math.round(exam.hoursNeeded / Math.max(days, 1) * 10) / 10}h/day</div>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => setShowExamModal(true)} className="btn btn-ghost w-full mt-3 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add exam
            </button>
          </Card>

          <Card className="p-5 bg-surface-subtle border-border">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent-text" />
              <span className="text-xs font-semibold text-text-primary">Planner Recommendation</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {recommendation}
            </p>
          </Card>
        </div>
      </div>

      <Modal open={showExamModal} onClose={() => setShowExamModal(false)} title="Add Upcoming Exam">
        <div className="space-y-4">
          <Input id="exam-subject" label="Subject" placeholder="e.g. Mathematics" value={newExam.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExam(s => ({ ...s, subject: e.target.value }))} />
          <Input id="exam-date" label="Exam date" type="date" value={newExam.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExam(s => ({ ...s, date: e.target.value }))} />
          <Input id="exam-hours" label="Study hours needed" type="number" placeholder="e.g. 20" value={newExam.hours} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExam(s => ({ ...s, hours: e.target.value }))} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowExamModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => void addExam()}>Add exam</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Add Study Task">
        <div className="space-y-4">
          <Input id="task-subject" label="Subject" placeholder="e.g. Physics" value={newTask.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask(s => ({ ...s, subject: e.target.value }))} />
          <Input id="task-topic" label="Topic" placeholder="e.g. Electrostatics" value={newTask.topic} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask(s => ({ ...s, topic: e.target.value }))} />
          <Input id="task-date" label="Date" type="date" value={newTask.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask(s => ({ ...s, date: e.target.value }))} />
          <Input id="task-duration" label="Duration (minutes)" type="number" placeholder="60" value={newTask.duration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask(s => ({ ...s, duration: e.target.value }))} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => void addTask()}>Add task</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
