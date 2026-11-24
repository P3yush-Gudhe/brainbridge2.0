import { useEffect, useState } from 'react'
import {
  ArrowRight, MessageSquare, FileText,
  BookOpen, HelpCircle, CheckCircle2, Calendar, Target,
  Flame
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface DashboardSummary {
  counts: {
    notes: number
    decks: number
    exams: number
    tasksTotal: number
    tasksCompleted: number
    quizzes: number
  }
  focus: {
    todayMinutes: number
    weeklyHours: number
    totalHours: number
    sessionsCount: number
  }
  recentNotes: Array<{ id: number; title: string; updatedAt: string }>
  upcomingExams: Array<{ id: number; subject: string; examDate: string; hoursNeeded: number }>
  pendingTasks: Array<{ id: number; subject: string; topic: string; taskDate: string; duration: number }>
  recentQuizzes: Array<{ id: number; subject: string; topic: string | null; score: number; totalQuestions: number; createdAt: string }>
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/dashboard/summary')
        if (!active) return
        setSummary(res.data as DashboardSummary)
      } catch {
        // Keep clean empty summary on failure
      }
    })()
    return () => { active = false }
  }, [])

  const studyTools = [
    { icon: MessageSquare, title: 'Chat', desc: 'Ask questions & solve problems', path: '/chat' },
    { icon: FileText, title: 'PDF Reader', desc: 'Read & extract key concepts', path: '/pdf' },
    { icon: HelpCircle, title: 'Quiz', desc: 'Test knowledge with quizzes', path: '/quiz' },
    { icon: BookOpen, title: 'Notes', desc: 'Organize study materials', path: '/notes' },
  ]

  const todayHours = Math.floor((summary?.focus.todayMinutes || 0) / 60)
  const todayMins = (summary?.focus.todayMinutes || 0) % 60
  const weeklyHours = summary?.focus.weeklyHours || 0
  const weeklyGoalPct = Math.min(100, Math.round((weeklyHours / 20) * 100))
  const nextTask = summary?.pendingTasks[0]
  const nextExamCount = summary?.upcomingExams.length || 0

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E5E0] pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#252525] tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-sm text-[#707070] mt-1">
            {nextExamCount > 0
              ? `You have ${nextExamCount} upcoming exam${nextExamCount > 1 ? 's' : ''} in your planner.`
              : 'Your study workspace is ready.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/planner">
            <Button variant="secondary" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5 text-[#707070]" />}>
              Planner
            </Button>
          </Link>
          <Link to="/chat">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Continue studying
            </Button>
          </Link>
        </div>
      </div>

      {/* Smart Focus Card */}
      <Card className="bg-[#FAF9F6] border-[#E7E5E0] p-5 md:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5965B3]">
                Today's Focus
              </span>
            </div>
            {nextTask ? (
              <>
                <h2 className="text-base md:text-lg font-semibold text-[#252525]">
                  {nextTask.topic} ({nextTask.subject})
                </h2>
                <p className="text-sm text-[#707070] leading-relaxed">
                  Scheduled for {formatDate(nextTask.taskDate, { month: 'short', day: 'numeric' })} • Estimated {nextTask.duration} minutes.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-base md:text-lg font-semibold text-[#252525]">
                  Ready for a focused study session?
                </h2>
                <p className="text-sm text-[#707070] leading-relaxed">
                  Take a quick practice quiz, create study notes, or build a weekly schedule in the planner.
                </p>
              </>
            )}
          </div>
          <div className="flex-shrink-0">
            <Link to={nextTask ? '/planner' : '/quiz'}>
              <Button variant="primary" leftIcon={<Target className="w-4 h-4" />}>
                {nextTask ? 'Open planner →' : 'Start a quiz →'}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Progress & Goals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white">
          <div className="text-xs font-medium text-[#707070] mb-1">Today's focus</div>
          <div className="text-xl font-bold text-[#252525] font-mono">{todayHours}h {todayMins}m</div>
          <div className="text-xs text-[#707070] mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#5C8A6A]" />
            <span>{summary?.counts.tasksCompleted || 0} tasks completed</span>
          </div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="text-xs font-medium text-[#707070] mb-1">Weekly goal</div>
          <div className="text-xl font-bold text-[#252525] font-mono">{weeklyHours} <span className="text-sm font-normal text-[#707070]">/ 20 hrs</span></div>
          <div className="w-full bg-[#F0F0ED] h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-[#5965B3] h-full rounded-full" style={{ width: `${weeklyGoalPct}%` }} />
          </div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="text-xs font-medium text-[#707070] mb-1">Study streak & XP</div>
          <div className="text-xl font-bold text-[#252525] font-mono flex items-center gap-1.5">
            <span>{user?.streak || 1} day{(user?.streak || 1) > 1 ? 's' : ''}</span>
            <Flame className="w-4 h-4 text-[#B4863A]" />
          </div>
          <div className="text-xs text-[#707070] mt-1">Level {user?.level || 1} • {user?.xp || 0} XP</div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-3">
              Study tools
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {studyTools.map((tool) => (
                <Link key={tool.title} to={tool.path}>
                  <Card variant="hover" className="p-4 space-y-2 h-full">
                    <tool.icon className="w-5 h-5 text-[#5965B3]" />
                    <div>
                      <div className="text-sm font-semibold text-[#252525]">{tool.title}</div>
                      <div className="text-xs text-[#707070] mt-0.5 leading-snug">{tool.desc}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Notes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070]">
                Recent notes
              </h2>
              <Link to="/notes" className="text-xs font-medium text-[#5965B3] hover:underline">
                View all notes →
              </Link>
            </div>
            {summary?.recentNotes && summary.recentNotes.length > 0 ? (
              <div className="space-y-2.5">
                {summary.recentNotes.map((note) => (
                  <Link key={note.id} to="/notes">
                    <Card variant="hover" className="p-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#252525] truncate">{note.title}</span>
                      <span className="text-xs font-mono text-[#999999]">{formatRelativeTime(note.updatedAt)}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="p-4 bg-white text-xs text-[#707070]">
                No notes yet. <Link to="/notes" className="text-[#5965B3] hover:underline font-medium">Create your first note</Link>.
              </Card>
            )}
          </div>

          {/* Recent Quizzes */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-3">
              Recent quiz activity
            </h2>
            <Card className="p-2 bg-white divide-y divide-[#E7E5E0]">
              {summary?.recentQuizzes && summary.recentQuizzes.length > 0 ? (
                summary.recentQuizzes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#5965B3] w-16 flex-shrink-0">Quiz</span>
                      <span className="text-[#252525] font-medium">{q.subject}{q.topic ? `: ${q.topic}` : ''}</span>
                      <span className="text-[#999999] hidden sm:inline">• Score: {q.score}/{q.totalQuestions}</span>
                    </div>
                    <span className="text-[#999999] font-mono text-[11px]">{formatRelativeTime(q.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-xs text-[#707070]">No quiz attempts recorded yet.</div>
              )}
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-3">
              Upcoming exams
            </h2>
            <div className="space-y-3">
              {summary?.upcomingExams && summary.upcomingExams.length > 0 ? (
                summary.upcomingExams.map((ex) => {
                  const days = Math.max(0, Math.ceil((new Date(ex.examDate).getTime() - Date.now()) / 86400000))
                  return (
                    <Card key={ex.id} className="p-4 bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[#252525]">{ex.subject}</span>
                        <Badge variant={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'neutral'}>{days}d left</Badge>
                      </div>
                      <div className="text-xs text-[#707070]">{ex.hoursNeeded}h study target</div>
                      <div className="text-[11px] text-[#999999] mt-2 font-mono">{formatDate(ex.examDate)}</div>
                    </Card>
                  )
                })
              ) : (
                <Card className="p-4 bg-white text-xs text-[#707070]">
                  No upcoming exams added. <Link to="/planner" className="text-[#5965B3] hover:underline font-medium">Open planner</Link>.
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
