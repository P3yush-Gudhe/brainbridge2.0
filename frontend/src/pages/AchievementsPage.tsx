import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Lock, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'

interface Milestone {
  id: string
  icon: string
  name: string
  desc: string
  category: string
  current: number
  target: number
  earned: boolean
}

interface XpEvent {
  id: number
  source: string
  points: number
  description: string
  createdAt: string
}

export function AchievementsPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAchievements = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/achievements')
      setMilestones((res.data?.milestones || []) as Milestone[])
      setXpEvents((res.data?.xpEvents || []) as XpEvent[])
      setXp(Number(res.data?.xp) || 0)
      setLevel(Number(res.data?.level) || 1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load achievements'
      setError(msg)
      toast.error('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAchievements()
  }, [loadAchievements])

  const earnedCount = milestones.filter(a => a.earned).length

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Academic Milestones & XP</h1>
        <p className="text-text-secondary text-sm mt-1">Track your unlocked badges, study consistency, and recent XP activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4 bg-surface border-border">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-text flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-text-primary">{earnedCount} / {milestones.length}</div>
            <div className="text-xs text-text-secondary">Milestones unlocked</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-surface border-border">
          <div className="w-10 h-10 rounded-xl bg-success-light text-success flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-text-primary">{xp} XP</div>
            <div className="text-xs text-text-secondary">Level {level} Scholar</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-surface border-border">
          <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border text-text-secondary flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-text-primary">{Math.max(0, milestones.length - earnedCount)}</div>
            <div className="text-xs text-text-secondary">Remaining milestones</div>
          </div>
        </Card>
      </div>

      {error ? (
        <Card className="p-6 bg-error-light border-error/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadAchievements()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </Card>
      ) : loading ? (
        <SkeletonGrid count={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestones.map((a, i) => {
              const pct = Math.min(100, Math.round((a.current / Math.max(1, a.target)) * 100))
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`card p-5 bg-surface border-border flex flex-col justify-between ${!a.earned ? 'opacity-80' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl" aria-hidden="true">{a.earned ? a.icon : '🔒'}</span>
                      <Badge variant={a.earned ? 'success' : 'neutral'}>{a.category}</Badge>
                    </div>
                    <h3 className="font-semibold text-text-primary text-sm mb-1">{a.name}</h3>
                    <p className="text-xs text-text-secondary">{a.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                    <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.earned ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                      <span>{a.earned ? '✓ Unlocked (+50 XP)' : 'In progress'}</span>
                      <span>{Math.min(a.current, a.target)} / {a.target}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <Card className="p-5 bg-surface border-border">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Recent XP History</h2>
            {xpEvents.length === 0 ? (
              <div className="text-xs text-text-secondary py-4 text-center">
                No XP events recorded yet. Complete quizzes, focus sessions, PDFs, or mind maps to earn XP.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {xpEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="font-medium text-text-primary">{ev.description}</div>
                      <div className="text-[11px] text-text-muted">{formatRelativeTime(ev.createdAt)}</div>
                    </div>
                    <Badge variant="brand">+{ev.points} XP</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
