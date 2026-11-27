import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Clock, Flame, TrendingUp, Target, Calendar, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAppStore, resolveTheme } from '@/stores/appStore'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

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
const intensities = [
  'bg-surface-subtle',
  'bg-accent-light',
  'bg-accent/40',
  'bg-accent/70',
  'bg-accent',
]

export function AnalyticsPage() {
  const { theme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartDefaults = useMemo(() => {
    const isDark = effectiveTheme === 'dark'
    const gridColor = isDark ? '#2B303D' : '#EDECEA'
    const tickColor = isDark ? '#9BA2B2' : '#585A60'
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#181B22' : '#FFFFFF',
          borderColor: isDark ? '#3B4254' : '#E7E5E0',
          borderWidth: 1,
          titleColor: isDark ? '#F1F2F6' : '#1F2024',
          bodyColor: isDark ? '#C2C6D2' : '#585A60',
          cornerRadius: 6,
          padding: 10,
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } }, beginAtZero: true },
      },
    }
  }, [effectiveTheme])

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/analytics')
      setData(res.data as AnalyticsPayload)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

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
      borderColor: effectiveTheme === 'dark' ? '#7D88DF' : '#5965B3',
      backgroundColor: effectiveTheme === 'dark' ? 'rgba(125, 136, 223, 0.14)' : 'rgba(89, 101, 179, 0.08)',
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
      backgroundColor: ['#5965B3', '#7B84C6', '#3E7250', '#94681E', '#A64444', '#6C757D'],
      borderRadius: 6,
      borderWidth: 0,
    }],
  }

  const donutData = {
    labels: hasDist ? dist.map((d) => d.label) : ['No recorded activity'],
    datasets: [{
      data: hasDist ? dist.map((d) => d.minutes) : [1],
      backgroundColor: hasDist ? ['#5965B3', '#7B84C6', '#3E7250', '#94681E'] : [effectiveTheme === 'dark' ? '#2B303D' : '#E7E5E0'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }

  const stats = [
    { icon: Clock, label: 'Total hours (30d)', value: `${data?.summary.totalHours ?? 0}h`, color: 'text-accent-text' },
    { icon: TrendingUp, label: 'Daily average', value: `${data?.summary.avgDailyHours ?? 0}h`, color: 'text-success' },
    { icon: Flame, label: 'Best day', value: `${data?.summary.bestDayHours ?? 0}h`, color: 'text-warning' },
    { icon: Target, label: 'Current streak', value: `${data?.summary.streak ?? 1} day${(data?.summary.streak ?? 1) > 1 ? 's' : ''}`, color: 'text-accent-text' },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Academic Analytics</h1>
        <p className="text-text-secondary text-sm mt-1">
          {loading ? 'Loading your study telemetry...' : 'Review your recorded study time, subject distribution, and activity patterns'}
        </p>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadAnalytics()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card p-4"
            >
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} aria-hidden="true" />
              <div className="text-2xl font-bold font-mono text-text-primary mb-0.5">{s.value}</div>
              <div className="text-xs text-text-secondary">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <Card className="p-5 lg:col-span-2">
          <CardHeader className="mb-3">
            <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4 text-accent-text" aria-hidden="true" /> Daily Study Hours</CardTitle>
            <span className="text-xs text-text-muted">Last 30 days</span>
          </CardHeader>
          <div className="h-52">
            <Line data={lineData} options={chartDefaults as object} />
          </div>
        </Card>

        {/* Donut */}
        <Card className="p-5">
          <CardHeader className="mb-3">
            <CardTitle>Time Distribution (min)</CardTitle>
          </CardHeader>
          <div className="h-44">
            <Doughnut
              data={donutData}
              options={{
                ...chartDefaults,
                scales: undefined,
                plugins: {
                  ...chartDefaults.plugins,
                  legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: effectiveTheme === 'dark' ? '#C2C6D2' : '#585A60', font: { size: 11 }, padding: 10 },
                  },
                },
              } as object}
            />
          </div>
        </Card>

        {/* Bar Chart */}
        <Card className="p-5 lg:col-span-2">
          <CardHeader className="mb-3">
            <CardTitle>Hours by Subject</CardTitle>
          </CardHeader>
          <div className="h-52">
            <Bar data={subjectData} options={{ ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } } as object} />
          </div>
        </Card>

        {/* Heatmap */}
        <Card className="p-5">
          <CardHeader className="mb-3">
            <CardTitle>Activity Heatmap</CardTitle>
            <span className="text-xs text-text-muted">7 weeks</span>
          </CardHeader>
          <div className="space-y-1.5">
            {weekDays.map((day, wi) => (
              <div key={day} className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-muted font-mono w-6">{day}</span>
                {heatmap[wi].map((val, di) => (
                  <div
                    key={di}
                    className={`w-5 h-5 rounded ${intensities[val] || intensities[0]} border border-border`}
                    title={val > 0 ? `${val} study activities` : 'No activity'}
                  />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
