import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Clock, CheckCircle2, XCircle, RefreshCw, Sparkles, AlertCircle, History,
  Globe, PenLine, Plus, Trash2, Target, RotateCcw, BookOpen, X
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { cn, formatDuration, formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

interface Question {
  id: string
  question: string
  options: string[]
  correct: number
  explanation: string
}

interface MissedQuestionPayload {
  question: string
  options: string[]
  correct: number
  selected: number
  explanation?: string
}

interface WeakTopicSummary {
  subject: string
  topic: string
  attempts: number
  avgScorePct: number
  missedCount: number
  missedQuestions: MissedQuestionPayload[]
}

interface QuizConfig {
  subject: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  type: 'mcq' | 'truefalse'
  count: number
  timed: boolean
  timePerQ: number
}

interface QuizAttempt {
  id: number
  subject: string
  topic: string | null
  difficulty: string
  score: number
  totalQuestions: number
  createdAt: string
}

interface CustomDraft {
  question: string
  options: [string, string, string, string]
  correct: number
  explanation: string
}

interface QuizRouteState {
  sourceMode?: 'ai'
  subject?: string
  topic?: string
  sourceText?: string
}

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Geography', 'English']

type QuizPhase = 'config' | 'quiz' | 'results'
type QuizSourceMode = 'bank' | 'ai' | 'custom'

export function QuizPage() {
  const location = useLocation()
  const routeState = (location.state as QuizRouteState | null) ?? null
  const { refreshSessionUser } = useAuthStore()
  const [phase, setPhase] = useState<QuizPhase>('config')
  const [sourceMode, setSourceMode] = useState<QuizSourceMode>(routeState?.sourceMode === 'ai' ? 'ai' : 'bank')
  const [noteSourceText, setNoteSourceText] = useState<string>(routeState?.sourceText ?? '')
  const [config, setConfig] = useState<QuizConfig>({
    subject: routeState?.subject && SUBJECTS.includes(routeState.subject) ? routeState.subject : 'Computer Science',
    topic: routeState?.topic ?? '',
    difficulty: 'medium',
    type: 'mcq',
    count: 5,
    timed: true,
    timePerQ: 30,
  })
  const [customQuestions, setCustomQuestions] = useState<Question[]>([])
  const [draft, setDraft] = useState<CustomDraft>({
    question: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: '',
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [weakTopics, setWeakTopics] = useState<WeakTopicSummary[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedAttemptRef = useRef(false)

  const loadAttempts = useCallback(async () => {
    try {
      const res = await api.get('/quizzes/attempts')
      setAttempts((res.data?.attempts || []) as QuizAttempt[])
      setWeakTopics((res.data?.weakTopics || []) as WeakTopicSummary[])
    } catch {
      toast.error('Failed to load quiz history')
    }
  }, [])

  useEffect(() => {
    void loadAttempts()
  }, [loadAttempts])

  const handleAnswer = useCallback((idx: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setAnswers(a => ({ ...a, [current]: idx }))
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(c => c + 1)
        setTimeLeft(config.timePerQ)
      } else {
        setPhase('results')
      }
    }, 700)
  }, [current, questions.length, config.timePerQ])

  const addCustomQuestion = () => {
    if (!draft.question.trim()) {
      toast.error('Please enter a question')
      return
    }
    const cleanOpts = draft.options.map(o => o.trim()).filter(Boolean)
    if (cleanOpts.length < 2) {
      toast.error('Please provide at least 2 answer options')
      return
    }
    const safeCorrect = draft.correct < cleanOpts.length ? draft.correct : 0
    const next: Question = {
      id: `custom-${Date.now()}-${customQuestions.length}`,
      question: draft.question.trim(),
      options: cleanOpts,
      correct: safeCorrect,
      explanation: draft.explanation.trim() || `Correct answer: ${cleanOpts[safeCorrect]}`,
    }
    setCustomQuestions(prev => [...prev, next])
    setDraft({
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: '',
    })
    toast.success('Question added to custom quiz')
  }

  const launchQuestionSet = (items: Question[], subjectOverride?: string, topicOverride?: string) => {
    if (!items.length) return
    if (subjectOverride || topicOverride) {
      setConfig(c => ({
        ...c,
        subject: subjectOverride ?? c.subject,
        topic: topicOverride ?? c.topic,
      }))
    }
    savedAttemptRef.current = false
    setQuestions(items)
    setCurrent(0)
    setAnswers({})
    setTimeLeft(config.timePerQ)
    setPhase('quiz')
  }

  const startQuiz = async () => {
    setAiError(null)

    if (sourceMode === 'custom') {
      if (!customQuestions.length) {
        const msg = 'Add at least 1 custom question below before starting.'
        setAiError(msg)
        toast.error(msg)
        return
      }
      launchQuestionSet(customQuestions)
      return
    }

    setGenerating(true)
    try {
      let generated: Question[] = []
      if (sourceMode === 'bank') {
        const response = await api.get('/quizzes/bank', {
          params: {
            subject: config.subject,
            difficulty: config.difficulty,
            type: config.type,
            count: config.count,
          },
        })
        generated = response.data?.questions || []
      } else {
        const response = await api.post('/ai/quiz', {
          subject: config.subject,
          topic: config.topic.trim() || undefined,
          sourceText: noteSourceText.trim() || undefined,
          difficulty: config.difficulty,
          type: config.type,
          count: config.count,
        })
        generated = response.data?.questions || []
      }

      if (!generated.length) {
        const msg = 'No quiz questions were returned. Please try again.'
        setAiError(msg)
        toast.error(msg)
        return
      }
      launchQuestionSet(generated)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to load quiz'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const retrySameQuiz = () => {
    launchQuestionSet(questions)
  }

  const retryMissedQuestions = () => {
    const missed = questions.filter((q, i) => answers[i] !== q.correct)
    if (!missed.length) {
      toast.success('Nothing missed to retry!')
      return
    }
    launchQuestionSet(missed)
  }

  const retryWeakTopicMissed = (wt: WeakTopicSummary) => {
    const mapped: Question[] = wt.missedQuestions.map((m, idx) => ({
      id: `missed-${idx}-${Date.now()}`,
      question: m.question,
      options: m.options,
      correct: m.correct,
      explanation: m.explanation || `Correct answer: ${m.options[m.correct] ?? ''}`,
    }))
    launchQuestionSet(mapped, wt.subject, wt.topic)
  }

  useEffect(() => {
    if (phase === 'quiz' && config.timed) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            handleAnswer(-1)
            return config.timePerQ
          }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [phase, current, config.timed, config.timePerQ, handleAnswer])

  const score = questions.filter((q, i) => answers[i] === q.correct).length
  const missedQuestionsList = questions.filter((q, i) => answers[i] !== q.correct)
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'F'

  useEffect(() => {
    if (phase === 'results' && questions.length > 0 && !savedAttemptRef.current) {
      savedAttemptRef.current = true
      const missedPayload: MissedQuestionPayload[] = questions
        .map((q, i) => ({
          question: q.question,
          options: q.options,
          correct: q.correct,
          selected: typeof answers[i] === 'number' ? answers[i] : -1,
          explanation: q.explanation,
        }))
        .filter((item) => item.selected !== item.correct)

      void api.post('/quizzes/attempts', {
        subject: config.subject,
        topic: config.topic.trim() || (sourceMode === 'custom' ? 'Custom Quiz' : undefined),
        difficulty: config.difficulty,
        score,
        totalQuestions: questions.length,
        missedQuestions: missedPayload,
      }).then(() => Promise.all([refreshSessionUser(), loadAttempts()])).catch(() => {
        toast.error('Failed to save quiz score')
      })
    }
  }, [phase, questions, answers, config.subject, config.topic, config.difficulty, sourceMode, score, refreshSessionUser, loadAttempts])

  if (phase === 'config') {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Quiz Practice</h1>
          <p className="text-text-secondary text-sm mt-1">Practice with the live academic question bank, AI topic generator, weak-topic review, or custom quizzes</p>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 bg-surface border border-border rounded-xl">
          {[
            { id: 'bank' as const, label: 'Question Bank', icon: Globe },
            { id: 'ai' as const, label: 'AI Topic Quiz', icon: Sparkles },
            { id: 'custom' as const, label: 'Custom Builder', icon: PenLine },
          ].map(m => (
            <button
              type="button"
              key={m.id}
              onClick={() => { setSourceMode(m.id); setAiError(null) }}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all',
                sourceMode === m.id
                  ? 'bg-accent-light text-accent-text font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              )}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="card p-5 sm:p-6 bg-surface border-border space-y-5">
          {sourceMode === 'ai' && noteSourceText.trim() && (
            <div className="p-3 rounded-lg bg-accent-light border border-accent/25 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-accent-text font-medium truncate">
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                Grounded in note content ({noteSourceText.length} chars)
              </span>
              <button
                type="button"
                onClick={() => setNoteSourceText('')}
                className="text-text-muted hover:text-error"
                aria-label="Clear note context"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="input-label">Subject</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SUBJECTS.map(s => (
                <button type="button" key={s} onClick={() => setConfig(c => ({ ...c, subject: s }))}
                  className={cn('py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                    config.subject === s ? 'bg-accent-light border-accent text-accent-text' : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {sourceMode === 'ai' && (
            <Input
              id="quiz-topic"
              label="Topic (optional)"
              placeholder="e.g. Integration by Parts, Thermodynamics, Cell Division..."
              value={config.topic}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(c => ({ ...c, topic: e.target.value }))}
            />
          )}

          {sourceMode !== 'custom' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Question Type</label>
                  <div className="flex gap-2">
                    {([{ id: 'mcq', label: 'Multiple Choice' }, { id: 'truefalse', label: 'True / False' }] as const).map(t => (
                      <button type="button" key={t.id} onClick={() => setConfig(c => ({ ...c, type: t.id }))}
                        className={cn('flex-1 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border',
                          config.type === t.id ? 'bg-accent-light border-accent text-accent-text' : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                        )}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="input-label">Difficulty</label>
                  <div className="flex gap-2">
                    {(['easy', 'medium', 'hard'] as const).map(d => (
                      <button type="button" key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all border capitalize',
                          config.difficulty === d
                            ? d === 'easy' ? 'bg-success-light border-success text-success'
                              : d === 'medium' ? 'bg-warning-light border-warning text-warning'
                              : 'bg-error-light border-error text-error'
                            : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                        )}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Number of questions</label>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button type="button" key={n} onClick={() => setConfig(c => ({ ...c, count: n }))}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          config.count === n ? 'bg-accent-light border-accent text-accent-text' : 'border-border text-text-secondary bg-surface-subtle'
                        )}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="input-label">Time per question</label>
                  <div className="flex gap-1.5">
                    {[15, 30, 60].map(t => (
                      <button type="button" key={t} onClick={() => setConfig(c => ({ ...c, timePerQ: t }))}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          config.timePerQ === t ? 'bg-accent-light border-accent text-accent-text' : 'border-border text-text-secondary bg-surface-subtle'
                        )}>
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 p-4 rounded-xl bg-surface-subtle border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Add Custom Question</span>
                <Badge variant="brand">{customQuestions.length} added</Badge>
              </div>
              <Input
                id="custom-q"
                label="Question"
                placeholder="Enter your question..."
                value={draft.question}
                onChange={e => setDraft(d => ({ ...d, question: e.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {draft.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, correct: idx }))}
                      className={cn(
                        'w-6 h-6 rounded-md text-xs font-bold flex-shrink-0 border transition-all',
                        draft.correct === idx
                          ? 'bg-success border-success text-white'
                          : 'bg-surface border-border text-text-secondary'
                      )}
                      title="Mark as correct option"
                      aria-label={`Mark option ${['A', 'B', 'C', 'D'][idx]} as correct`}
                    >
                      {['A', 'B', 'C', 'D'][idx]}
                    </button>
                    <input
                      value={opt}
                      onChange={e => {
                        const nextOpts = [...draft.options] as [string, string, string, string]
                        nextOpts[idx] = e.target.value
                        setDraft(d => ({ ...d, options: nextOpts }))
                      }}
                      placeholder={`Option ${['A', 'B', 'C', 'D'][idx]}${idx >= 2 ? ' (optional)' : ''}`}
                      aria-label={`Option ${['A', 'B', 'C', 'D'][idx]}`}
                      className="input py-1.5 text-xs flex-1"
                    />
                  </div>
                ))}
              </div>
              <Input
                id="custom-exp"
                label="Explanation (optional)"
                placeholder="Why is this option correct?"
                value={draft.explanation}
                onChange={e => setDraft(d => ({ ...d, explanation: e.target.value }))}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCustomQuestion} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add question to quiz
              </Button>

              {customQuestions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  {customQuestions.map((cq, i) => (
                    <div key={cq.id} className="flex items-center justify-between gap-2 bg-surface px-3 py-2 rounded-lg border border-border text-xs">
                      <span className="truncate font-medium text-text-primary">{i + 1}. {cq.question}</span>
                      <button
                        type="button"
                        onClick={() => setCustomQuestions(prev => prev.filter(item => item.id !== cq.id))}
                        className="text-text-muted hover:text-error flex-shrink-0"
                        aria-label={`Delete custom question ${i + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={config.timed}
              aria-label="Enable question timer"
              onClick={() => setConfig(c => ({ ...c, timed: !c.timed }))}
              className={cn('w-9 h-5 rounded-full transition-all relative', config.timed ? 'bg-accent' : 'bg-border-strong')}
            >
              <span className={cn('block absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', config.timed ? 'left-4.5' : 'left-0.5')} />
            </button>
            <span className="text-xs text-text-secondary font-medium">Enable question timer</span>
          </label>

          {aiError && (
            <div className="p-3.5 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}

          <Button
            size="lg"
            onClick={startQuiz}
            isLoading={generating}
            className="w-full gap-2"
            leftIcon={sourceMode === 'ai' ? <Sparkles className="w-4 h-4" /> : sourceMode === 'bank' ? <Globe className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
          >
            {generating
              ? 'Loading Quiz...'
              : sourceMode === 'ai'
                ? 'Generate & Start AI Quiz'
                : sourceMode === 'bank'
                  ? 'Start Live Quiz'
                  : `Start Custom Quiz (${customQuestions.length})`}
          </Button>
        </div>

        {weakTopics.length > 0 && (
          <div className="card p-5 bg-surface border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <Target className="w-3.5 h-3.5 text-warning" />
              <span>Weak Topics to Review</span>
            </div>
            <div className="space-y-2.5">
              {weakTopics.slice(0, 4).map((wt) => (
                <div key={`${wt.subject}-${wt.topic}`} className="p-3 rounded-lg bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary truncate">{wt.subject} — {wt.topic}</span>
                      <Badge variant={wt.avgScorePct < 50 ? 'danger' : 'warning'}>{wt.avgScorePct}% avg</Badge>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5">{wt.attempts} attempt{wt.attempts > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSourceMode('ai')
                        setConfig(c => ({
                          ...c,
                          subject: SUBJECTS.includes(wt.subject) ? wt.subject : c.subject,
                          topic: wt.topic === 'General' ? '' : wt.topic,
                        }))
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Practice topic
                    </Button>
                    {wt.missedQuestions.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<RotateCcw className="w-3 h-3" />}
                        onClick={() => retryWeakTopicMissed(wt)}
                      >
                        Retry missed ({wt.missedQuestions.length})
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {attempts.length > 0 && (
          <div className="card p-5 bg-surface border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <History className="w-3.5 h-3.5 text-accent-text" />
              <span>Recent Quiz History</span>
            </div>
            <div className="divide-y divide-border">
              {attempts.slice(0, 5).map((a) => {
                const attemptPct = a.totalQuestions > 0 ? Math.round((a.score / a.totalQuestions) * 100) : 0
                return (
                  <div key={a.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-text-primary">{a.subject}</span>
                      {a.topic && <span className="text-text-secondary"> · {a.topic}</span>}
                      <span className="ml-2 text-[11px] text-text-muted capitalize">({a.difficulty})</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant={attemptPct >= 70 ? 'success' : attemptPct >= 50 ? 'warning' : 'danger'}>
                        {a.score}/{a.totalQuestions} ({attemptPct}%)
                      </Badge>
                      <span className="text-[11px] text-text-muted font-mono hidden sm:inline">{formatRelativeTime(a.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'quiz' && questions[current]) {
    const q = questions[current]
    const answered = current in answers
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="brand">{config.subject}</Badge>
            {config.topic && <Badge variant="neutral">{config.topic}</Badge>}
          </div>
          {config.timed && (
            <div className={cn('flex items-center gap-1.5 font-mono text-xs font-semibold',
              timeLeft <= 10 ? 'text-error' : 'text-text-secondary'
            )}>
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(timeLeft)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              animate={{ width: `${((current) / questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs text-text-secondary font-mono flex-shrink-0">{current + 1} / {questions.length}</span>
        </div>

        <motion.div
          key={current}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="card p-6 mb-5 bg-surface border-border">
            <div className="text-[11px] text-text-muted font-mono mb-2 uppercase tracking-wider">Question {current + 1}</div>
            <p className="text-base font-semibold text-text-primary leading-relaxed">{q.question}</p>
          </div>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => (
              <motion.button
                type="button"
                key={i}
                onClick={() => !answered && handleAnswer(i)}
                whileHover={{ scale: answered ? 1 : 1.005 }}
                whileTap={{ scale: 0.995 }}
                className={cn(
                  'w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all bg-surface',
                  !answered ? 'border-border text-text-primary hover:border-accent hover:bg-surface-subtle' :
                  i === q.correct ? 'bg-success-light border-success text-success' :
                  answers[current] === i ? 'bg-error-light border-error text-error' :
                  'border-border text-text-muted opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0',
                    !answered ? 'bg-surface-secondary text-text-secondary' :
                    i === q.correct ? 'bg-success text-white' :
                    answers[current] === i ? 'bg-error text-white' :
                    'bg-surface-secondary text-text-muted'
                  )}>
                    {['A','B','C','D'][i] ?? String(i + 1)}
                  </div>
                  <span className="flex-1">{opt}</span>
                  {answered && i === q.correct && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                  {answered && answers[current] === i && i !== q.correct && <XCircle className="w-4 h-4 text-error flex-shrink-0" />}
                </div>
              </motion.button>
            ))}
          </div>

          {answered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-surface-subtle border border-border">
              <p className="text-xs text-text-secondary"><span className="text-accent-text font-semibold">Explanation: </span>{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary mb-1">Quiz Complete</h2>
          <p className="text-xs text-text-secondary">Your result has been saved to your study record</p>
          <div className="flex items-center justify-center gap-6 mt-6 p-4 rounded-xl bg-surface border border-border">
            <div className="text-center">
              <div className={cn('text-3xl font-bold font-mono mb-0.5', pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-error')}>{pct}%</div>
              <div className="text-[11px] text-text-muted">Score</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-text-primary mb-0.5">{grade}</div>
              <div className="text-[11px] text-text-muted">Grade</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-text font-mono mb-0.5">{score}/{questions.length}</div>
              <div className="text-[11px] text-text-muted">Correct</div>
            </div>
          </div>
        </motion.div>

        <div className="space-y-3 mb-6">
          {questions.map((q, i) => (
            <div key={i} className={cn('card p-4 border bg-surface', answers[i] === q.correct ? 'border-success/40' : 'border-error/40')}>
              <div className="flex items-start gap-3">
                {answers[i] === q.correct
                  ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />}
                <div className="flex-1 text-xs">
                  <p className="text-sm text-text-primary font-semibold mb-1">{q.question}</p>
                  {answers[i] !== q.correct && (
                    <p className="text-error font-medium mb-0.5">Your answer: {q.options[answers[i]] ?? 'Skipped'}</p>
                  )}
                  <p className="text-success font-medium">Correct: {q.options[q.correct]}</p>
                  <p className="text-text-secondary mt-2">{q.explanation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="flex-1" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => setPhase('config')}>New Quiz</Button>
          {missedQuestionsList.length > 0 && (
            <Button variant="outline" className="flex-1" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={retryMissedQuestions}>
              Retry Missed ({missedQuestionsList.length})
            </Button>
          )}
          <Button className="flex-1" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={retrySameQuiz}>Retry Same</Button>
        </div>
      </div>
    )
  }

  return null
}
