import { motion } from 'framer-motion'
import { Flame, Crown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const LEADERBOARD = [
  { rank: 1, name: 'Ananya Singh', hours: 45.2, streak: 45, avatar: 'AS' },
  { rank: 2, name: 'Rahul Verma', hours: 42.0, streak: 38, avatar: 'RV' },
  { rank: 3, name: 'Priya Patel', hours: 39.5, streak: 42, avatar: 'PP' },
  { rank: 4, name: 'Arjun Sharma', hours: 35.8, streak: 30, avatar: 'AR' },
  { rank: 5, name: 'Sneha Gupta', hours: 31.4, streak: 25, avatar: 'SG' },
  { rank: 6, name: 'You', hours: 28.5, streak: 12, avatar: 'U' },
  { rank: 7, name: 'Dev Kumar', hours: 24.1, streak: 8, avatar: 'DK' },
]

export function LeaderboardPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Study Community</h1>
        <p className="text-[#707070] text-sm mt-1">Weekly study consistency among peers</p>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-3 gap-3">
        {LEADERBOARD.slice(0, 3).map((entry, i) => (
          <motion.div
            key={entry.rank}
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
            <div className="text-xs font-semibold text-[#252525] truncate">{entry.name}</div>
            <div className="text-[11px] text-[#707070] font-mono mt-0.5">{entry.hours} hrs</div>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard Table */}
      <Card className="p-0 overflow-hidden bg-white border-[#E7E5E0]">
        <div className="divide-y divide-[#E7E5E0]">
          {LEADERBOARD.map((entry, i) => (
            <motion.div
              key={entry.rank}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-3.5 px-5 py-3.5 ${entry.name === 'You' ? 'bg-[#ECEEF7]' : 'hover:bg-[#FAF9F6]'}`}
            >
              <div className="w-6 text-center font-bold text-xs font-mono text-[#707070]">#{entry.rank}</div>
              <div className="w-7 h-7 rounded-full bg-[#5965B3] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                {entry.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold ${entry.name === 'You' ? 'text-[#5965B3]' : 'text-[#252525]'}`}>{entry.name}</div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-[#B4863A] font-mono">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{entry.streak}d</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#252525] font-mono">{entry.hours}</span>
                  <span className="text-[11px] text-[#707070] ml-1">hrs</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  )
}
