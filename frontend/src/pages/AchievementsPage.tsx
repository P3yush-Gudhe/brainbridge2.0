import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Lock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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

export function AchievementsPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/analytics')
        if (active) setMilestones((res.data?.milestones || []) as Milestone[])
      } catch {
        // Ignore
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const earnedCount = milestones.filter(a => a.earned).length

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Academic Milestones</h1>
        <p className="text-[#707070] text-sm mt-1">Track your study consistency and learning progress milestones</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 flex items-center gap-4 bg-white border-[#E7E5E0]">
          <div className="w-10 h-10 rounded-xl bg-[#ECEEF7] text-[#5965B3] flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[#252525]">{earnedCount} / {milestones.length}</div>
            <div className="text-xs text-[#707070]">Milestones unlocked</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-white border-[#E7E5E0]">
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F6] border border-[#E7E5E0] text-[#707070] flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[#252525]">{Math.max(0, milestones.length - earnedCount)}</div>
            <div className="text-xs text-[#707070]">Remaining milestones</div>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-[#707070]">Loading milestones...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {milestones.map((a, i) => {
            const pct = Math.min(100, Math.round((a.current / Math.max(1, a.target)) * 100))
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`card p-5 bg-white border-[#E7E5E0] flex flex-col justify-between ${!a.earned ? 'opacity-80' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{a.earned ? a.icon : '🔒'}</span>
                    <Badge variant={a.earned ? 'success' : 'neutral'}>{a.category}</Badge>
                  </div>
                  <h3 className="font-semibold text-[#252525] text-sm mb-1">{a.name}</h3>
                  <p className="text-xs text-[#707070]">{a.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E7E5E0] space-y-1.5">
                  <div className="h-1.5 bg-[#F0F0ED] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${a.earned ? 'bg-[#5C8A6A]' : 'bg-[#5965B3]'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#999999] font-mono">
                    <span>{a.earned ? '✓ Completed' : 'In progress'}</span>
                    <span>{Math.min(a.current, a.target)} / {a.target}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
