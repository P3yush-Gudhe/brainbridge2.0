import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, BookOpen, ChevronRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

const SUBJECTS = [
  { icon: '📐', name: 'Mathematics', topics: ['Calculus', 'Algebra', 'Statistics', 'Linear Algebra'] },
  { icon: '⚛️', name: 'Physics', topics: ['Mechanics', 'Electromagnetism', 'Thermodynamics', 'Quantum'] },
  { icon: '🧪', name: 'Chemistry', topics: ['Organic', 'Inorganic', 'Physical', 'Analytical'] },
  { icon: '💻', name: 'Computer Science', topics: ['Algorithms', 'Data Structures', 'OS', 'Networks'] },
  { icon: '📈', name: 'Economics', topics: ['Micro', 'Macro', 'Statistics', 'Finance'] },
  { icon: '🧬', name: 'Biology', topics: ['Cell Biology', 'Genetics', 'Evolution', 'Ecology'] },
]

interface QuizAttempt {
  id: number
  subject: string
  topic: string | null
  score: number
  totalQuestions: number
  createdAt: string
}

export function AITutorPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [recentQuizzes, setRecentQuizzes] = useState<QuizAttempt[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setHistoryError(null)
        const res = await api.get('/quizzes/attempts')
        if (active) setRecentQuizzes(((res.data?.attempts || []) as QuizAttempt[]).slice(0, 4))
      } catch {
        if (active) {
          setHistoryError('Could not load recent practice history.')
          toast.error('Failed to load recent practice history')
        }
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Personalized Tutor</h1>
        <p className="text-text-secondary text-sm mt-1">One-on-one study sessions tailored to your subjects</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="section-title mb-3">Choose a Subject</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {SUBJECTS.map(s => (
              <motion.button
                type="button"
                key={s.name}
                onClick={() => setSelected(s.name)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`p-4 rounded-xl border text-left transition-all bg-surface shadow-xs ${
                  selected === s.name ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong'
                }`}
              >
                <div className="text-2xl mb-2" aria-hidden="true">{s.icon}</div>
                <div className="font-semibold text-sm text-text-primary mb-1">{s.name}</div>
                <div className="space-y-0.5">
                  {s.topics.slice(0, 2).map(t => (
                    <div key={t} className="text-[11px] text-text-secondary">{t}</div>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <h3 className="font-semibold text-text-primary text-sm mb-3">{selected} Topics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUBJECTS.find(s => s.name === selected)?.topics.map(topic => (
                  <Link
                    key={topic}
                    to={`/chat?subject=${encodeURIComponent(selected)}&topic=${encodeURIComponent(topic)}`}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle hover:bg-surface-secondary transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-accent-text" aria-hidden="true" />
                    <span className="text-xs font-medium text-text-primary">{topic}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted ml-auto" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <Link to={`/chat?subject=${encodeURIComponent(selected)}`}>
                <Button className="w-full mt-4 gap-2" leftIcon={<Brain className="w-4 h-4" />}>
                  Start tutoring session →
                </Button>
              </Link>
            </motion.div>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader className="mb-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" aria-hidden="true" /> Recent Practice
              </CardTitle>
            </CardHeader>
            {historyError ? (
              <div className="text-xs text-error py-2">{historyError}</div>
            ) : recentQuizzes.length === 0 ? (
              <div className="text-xs text-text-secondary py-2">
                No recent quiz practice yet. Pick a subject to start tutoring or take a quiz.
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuizzes.map((s) => {
                  const pct = s.totalQuestions > 0 ? Math.round((s.score / s.totalQuestions) * 100) : 0
                  return (
                    <div key={s.id} className="p-3 rounded-lg bg-surface-subtle border border-border">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-text-primary">{s.topic || s.subject}</span>
                        <Badge variant={pct >= 80 ? 'success' : 'warning'}>{pct}%</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                        <span>{s.subject}</span><span>•</span><span>{s.score}/{s.totalQuestions}</span><span>•</span><span>{formatRelativeTime(s.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card variant="subtle" className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent-text" aria-hidden="true" />
              <span className="text-xs font-semibold text-text-primary">How tutoring works</span>
            </div>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <li>• Select a subject and topic</li>
              <li>• Step-by-step concept explanations</li>
              <li>• Ask questions in natural language</li>
              <li>• Personalized practice problems</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
