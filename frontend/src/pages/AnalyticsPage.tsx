import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Clock, Flame, TrendingUp, Target, Calendar } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import api from '@/lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: '#E7E5E0',
      borderWidth: 1,
      titleColor: '#252525',
      bodyColor: '#707070',
      cornerRadius: 6,
      padding: 10,
    },
  },
  scales: {
    x: { grid: { color: '#EDECEA' }, ticks: { color: '#707070', font: { size: 11 } } },
    y: { grid: { color: '#EDECEA' }, ticks: { color: '#707070', font: { size: 11 } }, beginAtZero: true },
  },
}

interface AnalyticsPayload {
  summary: {
    totalHours: number
    avgDailyHours: number
    bestDayHours: number
    streak: number
  }
  dailySeries: Array<{ date: string; label: string; hours: number }>
  subjectSeries: Array<{ subject: string; hours: number }>
  timeDistribution: Array<{ label: string; minutes: number }>
  heatmap: number[][]
}

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const intensities = ['bg-[#FAF9F6]', 'bg-[#ECEEF7]', 'bg-[#C3C8E8]', 'bg-[#7B84C6]', 'bg-[#5965B3]']

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/analytics')
        if (active) setData(res.data as AnalyticsPayload)
      } catch {
        // Keep empty fallback
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const dailySeries = data?.dailySeries ?? Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 29 + i)
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hours: 0 }
  })

  const subjectSeries = data?.subjectSeries?.length ? data.subjectSeries : [{ subject: 'No activity yet', hours: 0 }]
  const dist = data?.timeDistribution ?? [
    { label: 'Focus Timer', minutes: 0 },
    { label: 'Quizzes', minutes: 0 },
    { label: 'Notes', minutes: 0 },
    { label: 'Flashcards', minutes: 0 },
  ]
  const hasDist = dist.some((d) => d.minutes > 0)
  const heatmap = data?.heatmap ?? Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0))

  const lineData = {
    labels: dailySeries.map((d) => d.label),
    datasets: [{
      label: 'Hours',
      data: dailySeries.map((d) => d.hours),
      borderColor: '#5965B3',
      backgroundColor: 'rgba(89, 101, 179, 0.08)',
      borderWidth: 2,
      pointRadius: 1,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#5965B3',
      tension: 0.35,
      fill: true,
    }],
  }

  const subjectData = {
    labels: subjectSeries.map((s) => s.subject),
    datasets: [{
      data: subjectSeries.map((s) => s.hours),
      backgroundColor: ['#5965B3', '#7B84C6', '#5C8A6A', '#B4863A', '#B45D5D', '#6C757D'],
      borderRadius: 6,
      borderWidth: 0,
    }],
  }

  const donutData = {
    labels: hasDist ? dist.map((d) => d.label) : ['No recorded activity'],
    datasets: [{
      data: hasDist ? dist.map((d) => d.minutes) : [1],
      backgroundColor: hasDist ? ['#5965B3', '#7B84C6', '#5C8A6A', '#B4863A'] : ['#E7E5E0'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }

  const stats = [
    { icon: Clock, label: 'Total hours (30d)', value: `${data?.summary.totalHours ?? 0}h`, color: 'text-[#5965B3]' },
    { icon: TrendingUp, label: 'Daily average', value: `${data?.summary.avgDailyHours ?? 0}h`, color: 'text-[#5C8A6A]' },
    { icon: Flame, label: 'Best day', value: `${data?.summary.bestDayHours ?? 0}h`, color: 'text-[#B4863A]' },
    { icon: Target, label: 'Current streak', value: `${data?.summary.streak ?? 1} day${(data?.summary.streak ?? 1) > 1 ? 's' : ''}`, color: 'text-[#5965B3]' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Academic Analytics</h1>
        <p className="text-[#707070] text-sm mt-1">
          {loading ? 'Loading your study telemetry...' : 'Review your recorded study time, subject distribution, and activity patterns'}
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="card p-4 bg-white border-[#E7E5E0]"
          >
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold font-mono text-[#252525] mb-0.5">{s.value}</div>
            <div className="text-xs text-[#707070]">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <Card className="p-5 lg:col-span-2 bg-white border-[#E7E5E0]">
          <CardHeader className="mb-3">
            <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#5965B3]" /> Daily Study Hours</CardTitle>
            <span className="text-xs text-[#999999]">Last 30 days</span>
          </CardHeader>
          <div className="h-52">
            <Line data={lineData} options={chartDefaults as object} />
          </div>
        </Card>

        {/* Donut */}
        <Card className="p-5 bg-white border-[#E7E5E0]">
          <CardHeader className="mb-3">
            <CardTitle>Time Distribution (min)</CardTitle>
          </CardHeader>
          <div className="h-44">
            <Doughnut data={donutData} options={{ ...chartDefaults, scales: undefined, plugins: { ...chartDefaults.plugins, legend: { display: true, position: 'bottom', labels: { color: '#707070', font: { size: 11 }, padding: 10 } } } } as object} />
          </div>
        </Card>

        {/* Bar Chart */}
        <Card className="p-5 lg:col-span-2 bg-white border-[#E7E5E0]">
          <CardHeader className="mb-3">
            <CardTitle>Hours by Subject</CardTitle>
          </CardHeader>
          <div className="h-52">
            <Bar data={subjectData} options={{ ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } } as object} />
          </div>
        </Card>

        {/* Heatmap */}
        <Card className="p-5 bg-white border-[#E7E5E0]">
          <CardHeader className="mb-3">
            <CardTitle>Activity Heatmap</CardTitle>
            <span className="text-xs text-[#999999]">7 weeks</span>
          </CardHeader>
          <div className="space-y-1.5">
            {weekDays.map((day, wi) => (
              <div key={day} className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#999999] font-mono w-6">{day}</span>
                {heatmap[wi].map((val, di) => (
                  <div key={di} className={`w-5 h-5 rounded ${intensities[val]} border border-[#E7E5E0]`} title={val > 0 ? `${val} study activities` : 'No activity'} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
