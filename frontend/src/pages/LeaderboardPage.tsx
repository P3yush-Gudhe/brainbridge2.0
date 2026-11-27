import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Flame, Crown, Eye, EyeOff, RefreshCw, AlertCircle, Target, Clock, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'

interface LeaderboardEntry {
  id: number
  rank: number
  name: string
  avatar: string
  xp: number
  level: number
  streak: number
  hours: number
  weeklyQuizzes: number
  weeklyQuizAccuracy: number
  compositeScore: number
  isCurrentUser: boolean
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [optedIn, setOptedIn] = useState(false)
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/leaderboard')
      setEntries((res.data?.entries || []) as LeaderboardEntry[])
      setOptedIn(Boolean(res.data?.optedIn))
      setCurrentUserStats((res.data?.currentUserStats || null) as LeaderboardEntry | null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load leaderboard'
      setError(msg)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLeaderboard()
  }, [loadLeaderboard])

  const toggleOptIn = async () => {
    setToggling(true)
    const next = !optedIn
    try {
      await api.patch('/settings', { leaderboardVisible: next })
      setOptedIn(next)
      toast.success(next ? 'You are now visible on the leaderboard' : 'You are now hidden from the leaderboard')
      await loadLeaderboard()
    } catch {
      toast.error('Failed to update leaderboard visibility')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Study Leaderboard</h1>
          <p className="text-text-secondary text-sm mt-1">
            Computed from weekly Pomodoro focus hours, quiz performance, streaks, and XP
          </p>
        </div>
        <Button
          variant={optedIn ? 'secondary' : 'primary'}
          size="sm"
          isLoading={toggling}
          onClick={() => void toggleOptIn()}
          leftIcon={optedIn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        >
          {optedIn ? 'Opt Out (Hide Me)' : 'Opt In to Leaderboard'}
        </Button>
      </div>

      {currentUserStats && (
        <Card className="p-4 bg-surface-subtle border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent text-white font-semibold text-xs flex items-center justify-center">
              {currentUserStats.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">Your Weekly Standing</span>
                <Badge variant={optedIn ? 'success' : 'neutral'}>{optedIn ? 'Public' : 'Private'}</Badge>
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {optedIn
                  ? 'Visible to other opted-in learners'
                  : 'Private mode — opt in above to appear in the public rankings'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1 text-accent-text">
              <Clock className="w-3.5 h-3.5" /> {currentUserStats.hours}h
            </span>
            <span className="flex items-center gap-1 text-success">
              <Target className="w-3.5 h-3.5" /> {currentUserStats.weeklyQuizzes} quizzes ({currentUserStats.weeklyQuizAccuracy}%)
            </span>
            <span className="flex items-center gap-1 text-warning">
              <Flame className="w-3.5 h-3.5" /> {currentUserStats.streak}d
            </span>
            <span className="font-bold text-text-primary">{currentUserStats.xp} XP</span>
          </div>
        </Card>
      )}

      {error ? (
        <Card className="p-6 bg-error-light border-error/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadLeaderboard()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </Card>
      ) : loading ? (
        <SkeletonList count={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No public leaderboard entries yet"
          description="No students have opted into the public leaderboard yet. Join now to track weekly focus hours and quiz streaks."
          action={
            !optedIn ? (
              <Button size="sm" isLoading={toggling} onClick={() => void toggleOptIn()} leftIcon={<Eye className="w-3.5 h-3.5" />}>
                Opt In & Join Leaderboard
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {entries.length >= 2 && (
            <div className="grid grid-cols-3 gap-3">
              {entries.slice(0, 3).map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`card p-4 text-center bg-surface border-border ${i === 0 ? 'order-2 shadow-xs border-accent' : i === 1 ? 'order-1' : 'order-3'}`}
                >
                  {i === 0 && <Crown className="w-4 h-4 text-warning mx-auto mb-1" />}
                  <div className="text-xl font-bold font-mono text-accent-text mb-1">#{entry.rank}</div>
                  <div className="w-9 h-9 rounded-full bg-accent text-white font-semibold text-xs flex items-center justify-center mx-auto mb-1.5">
                    {entry.avatar}
                  </div>
                  <div className="text-xs font-semibold text-text-primary truncate">
                    {entry.isCurrentUser ? `${entry.name} (You)` : entry.name}
                  </div>
                  <div className="text-[11px] text-text-secondary font-mono mt-0.5">
                    {entry.xp} XP • {entry.hours}h • {entry.weeklyQuizzes}q
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <Card className="p-0 overflow-hidden bg-surface border-border">
            <div className="divide-y divide-border">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3.5 px-5 py-3.5 ${entry.isCurrentUser ? 'bg-accent-light/70' : 'hover:bg-surface-subtle'}`}
                >
                  <div className="w-6 text-center font-bold text-xs font-mono text-text-secondary">#{entry.rank}</div>
                  <div className="w-7 h-7 rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                    {entry.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate ${entry.isCurrentUser ? 'text-accent-text' : 'text-text-primary'}`}>
                      {entry.isCurrentUser ? `${entry.name} (You)` : entry.name}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      Level {entry.level} • {entry.hours}h focus • {entry.weeklyQuizzes} quizzes ({entry.weeklyQuizAccuracy}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-warning font-mono">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{entry.streak}d</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-text-primary">{entry.xp}</span>
                      <span className="text-[11px] text-text-secondary ml-1">XP</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
