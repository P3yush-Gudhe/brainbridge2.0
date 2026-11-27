import { useEffect, useState, useCallback } from 'react'
import {
  ArrowRight, MessageSquare, FileText,
  BookOpen, HelpCircle, CheckCircle2, Calendar, Target,
  Flame, AlertCircle, RefreshCw, Sparkles, Circle, X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'

interface WeeklySummaryPayload {
  summary: string
  metrics: {
    streak: number
    weeklyFocusMinutes: number
    weeklyQuizzesCount: number
    weeklyQuizAccuracy: number | null
    dueFlashcards: number
  }
}

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

const ONBOARDING_DISMISSED_KEY = 'studymate_onboarding_dismissed'

export function DashboardPage() {
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryPayload | null>(null)
  const [generatingWeekly, setGeneratingWeekly] = useState(false)

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [sumRes, settingsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/settings').catch(() => null),
      ])
      setSummary(sumRes.data as DashboardSummary)
      const goal = settingsRes?.data?.settings?.dailyGoalMinutes
      if (typeof goal === 'number' && goal > 0) setDailyGoalMinutes(goal)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(msg)
      toast.error('Failed to load dashboard summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const dismissOnboarding = () => {
    setOnboardingDismissed(true)
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true')
    } catch {}
  }

  const generateWeeklySummary = async () => {
    setGeneratingWeekly(true)
    try {
      const res = await api.post('/ai/weekly-summary')
      setWeeklySummary(res.data as WeeklySummaryPayload)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      toast.error(e.response?.data?.error || e.message || 'Failed to generate weekly AI summary')
    } finally {
      setGeneratingWeekly(false)
    }
  }

  const studyTools = [
    { icon: MessageSquare, title: 'Chat', desc: 'Ask questions & solve problems', path: '/chat' },
    { icon: FileText, title: 'PDF Reader', desc: 'Read & extract key concepts', path: '/pdf' },
    { icon: HelpCircle, title: 'Quiz', desc: 'Test knowledge with quizzes', path: '/quiz' },
    { icon: BookOpen, title: 'Notes', desc: 'Organize study materials', path: '/notes' },
  ]

  const todayMinsTotal = summary?.focus.todayMinutes || 0
  const todayHours = Math.floor(todayMinsTotal / 60)
  const todayMins = todayMinsTotal % 60
  const dailyGoalPct = Math.min(100, Math.round((todayMinsTotal / Math.max(15, dailyGoalMinutes)) * 100))
  const weeklyHours = summary?.focus.weeklyHours || 0
  const weeklyGoalHours = Math.max(5, Math.round((dailyGoalMinutes * 7) / 60))
  const weeklyGoalPct = Math.min(100, Math.round((weeklyHours / weeklyGoalHours) * 100))
  const nextTask = summary?.pendingTasks[0]
  const nextExamCount = summary?.upcomingExams.length || 0

  const onboardingSteps = [
    { label: 'Set up your student profile', done: Boolean(user?.university || user?.bio), path: '/profile', cta: 'Edit profile' },
    { label: 'Create your first Markdown study note', done: (summary?.counts.notes || 0) > 0, path: '/notes', cta: 'Open notes' },
    { label: 'Take a quiz or create flashcards', done: (summary?.counts.quizzes || 0) > 0 || (summary?.counts.decks || 0) > 0, path: '/quiz', cta: 'Start quiz' },
    { label: 'Complete a Pomodoro focus session', done: (summary?.focus.sessionsCount || 0) > 0, path: '/pomodoro', cta: 'Start timer' },
  ]
  const completedSteps = onboardingSteps.filter((s) => s.done).length
  const showOnboarding = !loading && !onboardingDismissed && completedSteps < onboardingSteps.length

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {loading
              ? 'Loading your study workspace...'
              : nextExamCount > 0
                ? `You have ${nextExamCount} upcoming exam${nextExamCount > 1 ? 's' : ''} in your planner.`
                : 'Your study workspace is ready.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/planner">
            <Button variant="secondary" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5 text-text-secondary" />}>
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

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadSummary()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </div>
      )}

      {/* Onboarding Checklist */}
      {showOnboarding && (
        <Card className="p-5 bg-surface border-accent/30">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-text" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">Getting Started Checklist</h2>
                <Badge variant="brand">{completedSteps} / {onboardingSteps.length}</Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">Complete these quick steps to build your study momentum.</p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="Dismiss getting started checklist"
              className="btn-icon-sm btn-ghost text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.round((completedSteps / onboardingSteps.length) * 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onboardingSteps.map((step) => (
              <Link
                key={step.label}
                to={step.path}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-lg border text-xs transition-colors',
                  step.done
                    ? 'bg-success-light/50 border-success/25 text-text-secondary'
                    : 'bg-surface-subtle border-border hover:border-border-strong text-text-primary'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {step.done
                    ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
                    : <Circle className="w-4 h-4 text-text-muted flex-shrink-0" aria-hidden="true" />}
                  <span className={cn('truncate font-medium', step.done && 'line-through')}>{step.label}</span>
                </span>
                {!step.done && <span className="text-[11px] font-semibold text-accent-text flex-shrink-0">{step.cta} →</span>}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Smart Focus Card */}
      <Card variant="subtle" className="p-5 md:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-text">
              Today's Focus
            </span>
            {loading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
            ) : nextTask ? (
              <>
                <h2 className="text-base md:text-lg font-semibold text-text-primary">
                  {nextTask.topic} ({nextTask.subject})
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Scheduled for {formatDate(nextTask.taskDate, { month: 'short', day: 'numeric' })} • Estimated {nextTask.duration} minutes.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-base md:text-lg font-semibold text-text-primary">
                  Ready for a focused study session?
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
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
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-text-secondary">Today's focus</div>
              <span className="text-[11px] font-mono text-text-muted">{dailyGoalPct}% of {dailyGoalMinutes}m goal</span>
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">{todayHours}h {todayMins}m</div>
            <div className="w-full bg-surface-secondary h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-success h-full rounded-full transition-all" style={{ width: `${dailyGoalPct}%` }} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-text-secondary">Weekly goal</div>
              <span className="text-[11px] font-mono text-text-muted">{weeklyGoalPct}%</span>
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              {weeklyHours} <span className="text-sm font-normal text-text-secondary">/ {weeklyGoalHours} hrs</span>
            </div>
            <div className="w-full bg-surface-secondary h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${weeklyGoalPct}%` }} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-medium text-text-secondary mb-1">Study streak & XP</div>
            <div className="text-xl font-bold text-text-primary font-mono flex items-center gap-1.5">
              <span>{user?.streak || 1} day{(user?.streak || 1) > 1 ? 's' : ''}</span>
              <Flame className="w-4 h-4 text-warning" aria-hidden="true" />
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Level {user?.level || 1} • {user?.xp || 0} XP • {summary?.counts.tasksCompleted || 0} tasks done
            </div>
          </Card>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h2 className="section-title mb-3">Study tools</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {studyTools.map((tool) => (
                <Link key={tool.title} to={tool.path}>
                  <Card variant="hover" className="p-4 space-y-2 h-full">
                    <tool.icon className="w-5 h-5 text-accent-text" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{tool.title}</div>
                      <div className="text-xs text-text-secondary mt-0.5 leading-snug">{tool.desc}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Notes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Recent notes</h2>
              <Link to="/notes" className="text-xs font-medium text-accent-text hover:underline">
                View all notes →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : summary?.recentNotes && summary.recentNotes.length > 0 ? (
              <div className="space-y-2.5">
                {summary.recentNotes.map((note) => (
                  <Link key={note.id} to="/notes">
                    <Card variant="hover" className="p-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-text-primary truncate">{note.title}</span>
                      <span className="text-xs font-mono text-text-muted">{formatRelativeTime(note.updatedAt)}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No notes yet"
                description="Write Markdown notes with formulas, tags, and code blocks."
                action={<Link to="/notes" className="btn btn-primary btn-sm">Create your first note</Link>}
              />
            )}
          </div>

          {/* Recent Quizzes */}
          <div>
            <h2 className="section-title mb-3">Recent quiz activity</h2>
            <Card className="p-2 divide-y divide-border">
              {loading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : summary?.recentQuizzes && summary.recentQuizzes.length > 0 ? (
                summary.recentQuizzes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-accent-text w-12 flex-shrink-0">Quiz</span>
                      <span className="text-text-primary font-medium truncate">{q.subject}{q.topic ? `: ${q.topic}` : ''}</span>
                      <span className="text-text-muted hidden sm:inline flex-shrink-0">• Score: {q.score}/{q.totalQuestions}</span>
                    </div>
                    <span className="text-text-muted font-mono text-[11px] flex-shrink-0 ml-2">{formatRelativeTime(q.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-xs text-text-secondary flex items-center justify-between">
                  <span>No quiz attempts recorded yet.</span>
                  <Link to="/quiz" className="text-accent-text font-medium hover:underline">Take a quiz →</Link>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Weekly AI Summary</h2>
              <Link to="/analytics" className="text-xs font-medium text-accent-text hover:underline">
                Heatmap & stats →
              </Link>
            </div>
            <Card className="p-4 space-y-3">
              {weeklySummary ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="brand">{weeklySummary.metrics.weeklyFocusMinutes}m focus</Badge>
                    <Badge variant={(weeklySummary.metrics.weeklyQuizAccuracy ?? 100) >= 70 ? 'success' : 'warning'}>
                      {weeklySummary.metrics.weeklyQuizAccuracy !== null ? `${weeklySummary.metrics.weeklyQuizAccuracy}% quiz avg` : 'No quizzes yet'}
                    </Badge>
                    <Badge variant="neutral">{weeklySummary.metrics.dueFlashcards} cards due</Badge>
                  </div>
                  <div className="prose-studymate text-xs leading-relaxed text-text-secondary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{weeklySummary.summary}</ReactMarkdown>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    isLoading={generatingWeekly}
                    onClick={() => void generateWeeklySummary()}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Refresh summary
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Get an AI coaching brief summarizing your past 7 days of focus sessions, weak quiz topics, and due flashcards.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full"
                    isLoading={generatingWeekly}
                    onClick={() => void generateWeeklySummary()}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Generate weekly summary
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div>
            <h2 className="section-title mb-3">Upcoming exams</h2>
            <div className="space-y-3">
              {loading ? (
                <SkeletonCard lines={2} />
              ) : summary?.upcomingExams && summary.upcomingExams.length > 0 ? (
                summary.upcomingExams.map((ex) => {
                  const days = Math.max(0, Math.ceil((new Date(ex.examDate).getTime() - Date.now()) / 86400000))
                  return (
                    <Card key={ex.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-text-primary">{ex.subject}</span>
                        <Badge variant={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'neutral'}>{days}d left</Badge>
                      </div>
                      <div className="text-xs text-text-secondary">{ex.hoursNeeded}h study target</div>
                      <div className="text-[11px] text-text-muted mt-2 font-mono">{formatDate(ex.examDate)}</div>
                    </Card>
                  )
                })
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No upcoming exams"
                  description="Add exam dates to generate a tailored weekly schedule."
                  action={<Link to="/planner" className="btn btn-secondary btn-sm">Open planner</Link>}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
