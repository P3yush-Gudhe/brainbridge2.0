import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Clock, CheckCircle2, XCircle, RefreshCw, Sparkles, AlertCircle, History,
  Globe, PenLine, Plus, Trash2
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

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Geography', 'English']

type QuizPhase = 'config' | 'quiz' | 'results'
type QuizSourceMode = 'bank' | 'ai' | 'custom'

export function QuizPage() {
  const { refreshSessionUser } = useAuthStore()
  const [phase, setPhase] = useState<QuizPhase>('config')
  const [sourceMode, setSourceMode] = useState<QuizSourceMode>('bank')
  const [config, setConfig] = useState<QuizConfig>({
    subject: 'Computer Science',
    topic: '',
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedAttemptRef = useRef(false)

  const loadAttempts = useCallback(async () => {
    try {
      const res = await api.get('/quizzes/attempts')
      setAttempts((res.data?.attempts || []) as QuizAttempt[])
    } catch {
      // Ignore non-blocking history fetch
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

  const startQuiz = async () => {
    setAiError(null)

    if (sourceMode === 'custom') {
      if (!customQuestions.length) {
        const msg = 'Add at least 1 custom question below before starting.'
        setAiError(msg)
        toast.error(msg)
        return
      }
      savedAttemptRef.current = false
      setQuestions(customQuestions)
      setCurrent(0)
      setAnswers({})
      setTimeLeft(config.timePerQ)
      setPhase('quiz')
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
      savedAttemptRef.current = false
      setQuestions(generated)
      setCurrent(0)
      setAnswers({})
      setTimeLeft(config.timePerQ)
      setPhase('quiz')
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
    savedAttemptRef.current = false
    setCurrent(0)
    setAnswers({})
    setTimeLeft(config.timePerQ)
    setPhase('quiz')
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
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'F'

  useEffect(() => {
    if (phase === 'results' && questions.length > 0 && !savedAttemptRef.current) {
      savedAttemptRef.current = true
      void api.post('/quizzes/attempts', {
        subject: config.subject,
        topic: config.topic.trim() || (sourceMode === 'custom' ? 'Custom Quiz' : undefined),
        difficulty: config.difficulty,
        score,
        totalQuestions: questions.length,
      }).then(() => Promise.all([refreshSessionUser(), loadAttempts()])).catch(() => {})
    }
  }, [phase, questions.length, config.subject, config.topic, config.difficulty, sourceMode, score, refreshSessionUser, loadAttempts])

  if (phase === 'config') {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Quiz Practice</h1>
          <p className="text-[#707070] text-sm mt-1">Practice with the live academic question bank, AI topic generator, or custom quizzes</p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-white border border-[#E7E5E0] rounded-xl">
          {[
            { id: 'bank' as const, label: 'Question Bank', icon: Globe },
            { id: 'ai' as const, label: 'AI Topic Quiz', icon: Sparkles },
            { id: 'custom' as const, label: 'Custom Builder', icon: PenLine },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setSourceMode(m.id); setAiError(null) }}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all',
                sourceMode === m.id
                  ? 'bg-[#ECEEF7] text-[#5965B3] font-semibold'
                  : 'text-[#707070] hover:text-[#252525] hover:bg-[#FAF9F6]'
              )}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="card p-6 bg-white border-[#E7E5E0] space-y-5">
          <div>
            <label className="input-label">Subject</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {SUBJECTS.map(s => (
                <button key={s} onClick={() => setConfig(c => ({ ...c, subject: s }))}
                  className={cn('py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                    config.subject === s ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6] hover:border-[#D4D2CD]'
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
                      <button key={t.id} onClick={() => setConfig(c => ({ ...c, type: t.id }))}
                        className={cn('flex-1 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border',
                          config.type === t.id ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6] hover:border-[#D4D2CD]'
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
                      <button key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all border capitalize',
                          config.difficulty === d
                            ? d === 'easy' ? 'bg-[#EDF5F0] border-[#5C8A6A] text-[#5C8A6A]'
                              : d === 'medium' ? 'bg-[#FBF5EC] border-[#B4863A] text-[#B4863A]'
                              : 'bg-[#FBEFEF] border-[#B45D5D] text-[#B45D5D]'
                            : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6] hover:border-[#D4D2CD]'
                        )}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Number of questions</label>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button key={n} onClick={() => setConfig(c => ({ ...c, count: n }))}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          config.count === n ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6]'
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
                      <button key={t} onClick={() => setConfig(c => ({ ...c, timePerQ: t }))}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          config.timePerQ === t ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6]'
                        )}>
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 p-4 rounded-xl bg-[#FAF9F6] border border-[#E7E5E0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#252525]">Add Custom Question</span>
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
                          ? 'bg-[#5C8A6A] border-[#5C8A6A] text-white'
                          : 'bg-white border-[#E7E5E0] text-[#707070]'
                      )}
                      title="Mark as correct option"
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
                <div className="space-y-1.5 pt-2 border-t border-[#E7E5E0]">
                  {customQuestions.map((cq, i) => (
                    <div key={cq.id} className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-[#E7E5E0] text-xs">
                      <span className="truncate font-medium text-[#252525]">{i + 1}. {cq.question}</span>
                      <button
                        onClick={() => setCustomQuestions(prev => prev.filter(item => item.id !== cq.id))}
                        className="text-[#999999] hover:text-[#B45D5D] flex-shrink-0"
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
            <div onClick={() => setConfig(c => ({ ...c, timed: !c.timed }))}
              className={cn('w-9 h-5 rounded-full transition-all relative', config.timed ? 'bg-[#5965B3]' : 'bg-[#E7E5E0]')}
            >
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', config.timed ? 'left-4.5' : 'left-0.5')} />
            </div>
            <span className="text-xs text-[#707070] font-medium">Enable question timer</span>
          </label>

          {aiError && (
            <div className="p-3.5 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D] flex items-start gap-2.5">
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

        {attempts.length > 0 && (
          <div className="card p-5 bg-white border-[#E7E5E0] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#707070]">
              <History className="w-3.5 h-3.5 text-[#5965B3]" />
              <span>Recent Quiz History</span>
            </div>
            <div className="divide-y divide-[#E7E5E0]">
              {attempts.slice(0, 5).map((a) => {
                const attemptPct = a.totalQuestions > 0 ? Math.round((a.score / a.totalQuestions) * 100) : 0
                return (
                  <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#252525]">{a.subject}</span>
                      {a.topic && <span className="text-[#707070]"> · {a.topic}</span>}
                      <span className="ml-2 text-[11px] text-[#999999] capitalize">({a.difficulty})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={attemptPct >= 70 ? 'success' : attemptPct >= 50 ? 'warning' : 'danger'}>
                        {a.score}/{a.totalQuestions} ({attemptPct}%)
                      </Badge>
                      <span className="text-[11px] text-[#999999] font-mono">{formatRelativeTime(a.createdAt)}</span>
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
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="brand">{config.subject}</Badge>
            {config.topic && <Badge variant="neutral">{config.topic}</Badge>}
          </div>
          {config.timed && (
            <div className={cn('flex items-center gap-1.5 font-mono text-xs font-semibold',
              timeLeft <= 10 ? 'text-[#B45D5D]' : 'text-[#707070]'
            )}>
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(timeLeft)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#F0F0ED] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#5965B3] rounded-full"
              animate={{ width: `${((current) / questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs text-[#707070] font-mono flex-shrink-0">{current + 1} / {questions.length}</span>
        </div>

        <motion.div
          key={current}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="card p-6 mb-5 bg-white border-[#E7E5E0]">
            <div className="text-[11px] text-[#999999] font-mono mb-2 uppercase tracking-wider">Question {current + 1}</div>
            <p className="text-base font-semibold text-[#252525] leading-relaxed">{q.question}</p>
          </div>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => (
              <motion.button
                key={i}
                onClick={() => !answered && handleAnswer(i)}
                whileHover={{ scale: answered ? 1 : 1.005 }}
                whileTap={{ scale: 0.995 }}
                className={cn(
                  'w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all bg-white',
                  !answered ? 'border-[#E7E5E0] text-[#252525] hover:border-[#5965B3] hover:bg-[#FAF9F6]' :
                  i === q.correct ? 'bg-[#EDF5F0] border-[#5C8A6A] text-[#5C8A6A]' :
                  answers[current] === i ? 'bg-[#FBEFEF] border-[#B45D5D] text-[#B45D5D]' :
                  'border-[#E7E5E0] text-[#999999] opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0',
                    !answered ? 'bg-[#F0F0ED] text-[#707070]' :
                    i === q.correct ? 'bg-[#5C8A6A] text-white' :
                    answers[current] === i ? 'bg-[#B45D5D] text-white' :
                    'bg-[#F0F0ED] text-[#999999]'
                  )}>
                    {['A','B','C','D'][i] ?? String(i + 1)}
                  </div>
                  <span className="flex-1">{opt}</span>
                  {answered && i === q.correct && <CheckCircle2 className="w-4 h-4 text-[#5C8A6A] flex-shrink-0" />}
                  {answered && answers[current] === i && i !== q.correct && <XCircle className="w-4 h-4 text-[#B45D5D] flex-shrink-0" />}
                </div>
              </motion.button>
            ))}
          </div>

          {answered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-[#FAF9F6] border border-[#E7E5E0]">
              <p className="text-xs text-[#707070]"><span className="text-[#5965B3] font-semibold">Explanation: </span>{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#252525] mb-1">Quiz Complete</h2>
          <p className="text-xs text-[#707070]">Your result has been saved to your study record</p>
          <div className="flex items-center justify-center gap-6 mt-6 p-4 rounded-xl bg-white border border-[#E7E5E0]">
            <div className="text-center">
              <div className={cn('text-3xl font-bold font-mono mb-0.5', pct >= 70 ? 'text-[#5C8A6A]' : pct >= 50 ? 'text-[#B4863A]' : 'text-[#B45D5D]')}>{pct}%</div>
              <div className="text-[11px] text-[#999999]">Score</div>
            </div>
            <div className="h-8 w-px bg-[#E7E5E0]" />
            <div className="text-center">
              <div className="text-3xl font-bold text-[#252525] mb-0.5">{grade}</div>
              <div className="text-[11px] text-[#999999]">Grade</div>
            </div>
            <div className="h-8 w-px bg-[#E7E5E0]" />
            <div className="text-center">
              <div className="text-3xl font-bold text-[#5965B3] font-mono mb-0.5">{score}/{questions.length}</div>
              <div className="text-[11px] text-[#999999]">Correct</div>
            </div>
          </div>
        </motion.div>

        <div className="space-y-3 mb-6">
          {questions.map((q, i) => (
            <div key={i} className={cn('card p-4 border bg-white', answers[i] === q.correct ? 'border-[#5C8A6A]/30' : 'border-[#B45D5D]/30')}>
              <div className="flex items-start gap-3">
                {answers[i] === q.correct
                  ? <CheckCircle2 className="w-4 h-4 text-[#5C8A6A] flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-[#B45D5D] flex-shrink-0 mt-0.5" />}
                <div className="flex-1 text-xs">
                  <p className="text-sm text-[#252525] font-semibold mb-1">{q.question}</p>
                  {answers[i] !== q.correct && (
                    <p className="text-[#B45D5D] font-medium mb-0.5">Your answer: {q.options[answers[i]] ?? 'Skipped'}</p>
                  )}
                  <p className="text-[#5C8A6A] font-medium">Correct: {q.options[q.correct]}</p>
                  <p className="text-[#707070] mt-2">{q.explanation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => setPhase('config')}>New Quiz</Button>
          <Button className="flex-1" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={retrySameQuiz}>Retry Same</Button>
        </div>
      </div>
    )
  }

  return null
}
