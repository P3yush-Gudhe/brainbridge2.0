import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, BookOpen, ChevronRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
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

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/quizzes/attempts')
        if (active) setRecentQuizzes(((res.data?.attempts || []) as QuizAttempt[]).slice(0, 4))
      } catch {
        // Non-blocking
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Personalized Tutor</h1>
        <p className="text-[#707070] text-sm mt-1">One-on-one study sessions tailored to your subjects</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-3">Choose a Subject</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {SUBJECTS.map(s => (
              <motion.button
                key={s.name}
                onClick={() => setSelected(s.name)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`p-4 rounded-xl border text-left transition-all bg-white shadow-xs ${
                  selected === s.name ? 'border-[#5965B3] ring-1 ring-[#5965B3]' : 'border-[#E7E5E0] hover:border-[#D4D2CD]'
                }`}
              >
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="font-semibold text-sm text-[#252525] mb-1">{s.name}</div>
                <div className="space-y-0.5">
                  {s.topics.slice(0, 2).map(t => (
                    <div key={t} className="text-[11px] text-[#707070]">{t}</div>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5 bg-white border-[#E7E5E0]">
              <h3 className="font-semibold text-[#252525] text-sm mb-3">{selected} Topics</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {SUBJECTS.find(s => s.name === selected)?.topics.map(topic => (
                  <Link
                    key={topic}
                    to={`/chat?subject=${encodeURIComponent(selected)}&topic=${encodeURIComponent(topic)}`}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E7E5E0] bg-[#FAF9F6] hover:bg-[#F0F0ED] transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-[#5965B3]" />
                    <span className="text-xs font-medium text-[#252525]">{topic}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#999999] ml-auto" />
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
          <Card className="p-5 bg-white border-[#E7E5E0]">
            <CardHeader className="mb-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#B4863A]" /> Recent Practice
              </CardTitle>
            </CardHeader>
            {recentQuizzes.length === 0 ? (
              <div className="text-xs text-[#707070] py-2">
                No recent quiz practice yet. Pick a subject to start tutoring or take a quiz.
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuizzes.map((s) => {
                  const pct = s.totalQuestions > 0 ? Math.round((s.score / s.totalQuestions) * 100) : 0
                  return (
                    <div key={s.id} className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E7E5E0]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-[#252525]">{s.topic || s.subject}</span>
                        <Badge variant={pct >= 80 ? 'success' : 'warning'}>{pct}%</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#707070]">
                        <span>{s.subject}</span><span>•</span><span>{s.score}/{s.totalQuestions}</span><span>•</span><span>{formatRelativeTime(s.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="card p-5 bg-[#FAF9F6] border-[#E7E5E0]">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-[#5965B3]" />
              <span className="text-xs font-semibold text-[#252525]">How tutoring works</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#707070]">
              <li>• Select a subject and topic</li>
              <li>• Step-by-step concept explanations</li>
              <li>• Ask questions in natural language</li>
              <li>• Personalized practice problems</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
