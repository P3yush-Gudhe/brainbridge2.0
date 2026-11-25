import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Crown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
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
  isCurrentUser: boolean
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/leaderboard')
        if (active) setEntries((res.data?.entries || []) as LeaderboardEntry[])
      } catch {
        // Keep empty state on failure
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Study Leaderboard</h1>
        <p className="text-[#707070] text-sm mt-1">Ranked by XP earned, weekly focus hours, and study streaks</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-[#707070]">Loading leaderboard...</div>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center bg-white border-[#E7E5E0] text-xs text-[#707070]">
          No student rankings available yet. Complete quizzes and Pomodoro sessions to earn XP.
        </Card>
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
                  className={`card p-4 text-center bg-white border-[#E7E5E0] ${i === 0 ? 'order-2 shadow-xs border-[#5965B3]' : i === 1 ? 'order-1' : 'order-3'}`}
                >
                  {i === 0 && <Crown className="w-4 h-4 text-[#B4863A] mx-auto mb-1" />}
                  <div className="text-xl font-bold font-mono text-[#5965B3] mb-1">#{entry.rank}</div>
                  <div className="w-9 h-9 rounded-full bg-[#5965B3] text-white font-semibold text-xs flex items-center justify-center mx-auto mb-1.5">
                    {entry.avatar}
                  </div>
                  <div className="text-xs font-semibold text-[#252525] truncate">
                    {entry.isCurrentUser ? `${entry.name} (You)` : entry.name}
                  </div>
                  <div className="text-[11px] text-[#707070] font-mono mt-0.5">{entry.xp} XP • {entry.hours}h</div>
                </motion.div>
              ))}
            </div>
          )}

          <Card className="p-0 overflow-hidden bg-white border-[#E7E5E0]">
            <div className="divide-y divide-[#E7E5E0]">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3.5 px-5 py-3.5 ${entry.isCurrentUser ? 'bg-[#ECEEF7]' : 'hover:bg-[#FAF9F6]'}`}
                >
                  <div className="w-6 text-center font-bold text-xs font-mono text-[#707070]">#{entry.rank}</div>
                  <div className="w-7 h-7 rounded-full bg-[#5965B3] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                    {entry.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate ${entry.isCurrentUser ? 'text-[#5965B3]' : 'text-[#252525]'}`}>
                      {entry.isCurrentUser ? `${entry.name} (You)` : entry.name}
                    </div>
                    <div className="text-[10px] text-[#999999]">Level {entry.level}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-[#B4863A] font-mono">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{entry.streak}d</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-[#252525]">{entry.xp}</span>
                      <span className="text-[11px] text-[#707070] ml-1">XP</span>
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
