import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'

const MODES = [
  { label: '25 / 5', focus: 25, break: 5 },
  { label: '50 / 10', focus: 50, break: 10 },
  { label: '90 / 20', focus: 90, break: 20 },
]

const SOUNDS = [
  { id: 'rain', label: '🌧️ Rain' },
  { id: 'forest', label: '🌲 Forest' },
  { id: 'cafe', label: '☕ Café' },
  { id: 'waves', label: '🌊 Waves' },
  { id: 'white', label: '📻 White Noise' },
]

export function PomodoroPage() {
  const { refreshSessionUser } = useAuthStore()
  const [modeIdx, setModeIdx] = useState(0)
  const [phase, setPhase] = useState<'focus' | 'break'>('focus')
  const [timeLeft, setTimeLeft] = useState(MODES[0].focus * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [totalFocus, setTotalFocus] = useState(0)
  const [activeSound, setActiveSound] = useState<string | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  useEffect(() => {
    const stopAudio = () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
        gainNodeRef.current = null
      }
    }

    if (!activeSound || soundMuted) {
      stopAudio()
      return
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      if (activeSound === 'white') {
        data[i] = white * 0.25
      } else {
        lastOut = (lastOut + 0.04 * white) / 1.04
        data[i] = lastOut * 2.4
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = activeSound === 'rain' ? 'bandpass' : 'lowpass'
    filter.frequency.value =
      activeSound === 'rain' ? 1100
      : activeSound === 'waves' ? 420
      : activeSound === 'forest' ? 680
      : activeSound === 'cafe' ? 540
      : 1800

    const gain = ctx.createGain()
    gain.gain.value = activeSound === 'white' ? 0.08 : 0.18

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()

    audioCtxRef.current = ctx
    gainNodeRef.current = gain

    return () => {
      try { source.stop() } catch {}
      stopAudio()
    }
  }, [activeSound, soundMuted])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/pomodoro')
        if (!active) return
        setSessions(Number(res.data?.todaySessions) || 0)
        setTotalFocus(Number(res.data?.todayFocusMinutes) || 0)
      } catch {
        if (active) toast.error('Failed to load focus session stats')
      }
    })()
    return () => { active = false }
  }, [])

  const currentMode = MODES[modeIdx]
  const totalTime = (phase === 'focus' ? currentMode.focus : currentMode.break) * 60
  const progress = (timeLeft / totalTime) * 100
  const radius = 100
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const reset = useCallback(() => {
    setRunning(false)
    setPhase('focus')
    setTimeLeft(MODES[modeIdx].focus * 60)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [modeIdx])

  useEffect(() => { reset() }, [modeIdx, reset])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            if (phase === 'focus') {
              setSessions(s => s + 1)
              setTotalFocus(f => f + currentMode.focus)
              setPhase('break')
              setTimeLeft(currentMode.break * 60)
              void api.post('/pomodoro', { durationMinutes: currentMode.focus })
                .then(() => refreshSessionUser())
                .then(() => toast.success(`Recorded ${currentMode.focus}-minute focus session`))
                .catch(() => {
                  toast.error('Failed to save focus session')
                })
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Break time', { body: `Take a ${currentMode.break}-minute break.` })
              }
            } else {
              setPhase('focus')
              setTimeLeft(currentMode.focus * 60)
            }
            setRunning(false)
            return 0
          }
          return t - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, phase, currentMode, refreshSessionUser])

  const phaseColor = phase === 'focus' ? 'var(--color-accent)' : 'var(--color-success)'
  const phaseLabel = phase === 'focus' ? 'Focus Session' : 'Break Time'

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Focus Timer</h1>
        <p className="text-text-secondary text-sm mt-1">Structured Pomodoro sessions for deep academic study</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 sm:p-8 bg-surface border-border flex flex-col items-center shadow-xs">
          <div className="flex gap-2 mb-8">
            {MODES.map((m, i) => (
              <button
                key={m.label}
                onClick={() => { setModeIdx(i); setRunning(false) }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  modeIdx === i
                    ? 'bg-accent-light border-accent text-accent-text'
                    : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="relative w-60 h-60 mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 240 240" aria-hidden="true">
              <circle cx="120" cy="120" r={radius} fill="none" stroke="var(--color-surface-secondary)" strokeWidth="10" />
              <motion.circle
                cx="120" cy="120" r={radius} fill="none"
                stroke={phaseColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-[11px] font-semibold mb-1 uppercase tracking-wider ${
                phase === 'focus' ? 'text-accent-text' : 'text-success'
              }`}>{phaseLabel}</div>
              <div className="text-4xl font-bold font-mono text-text-primary">{formatDuration(timeLeft)}</div>
              <div className="text-xs text-text-secondary mt-1 font-mono">{sessions} sessions completed</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={reset} className="btn btn-secondary btn-icon w-10 h-10 rounded-xl" title="Reset" aria-label="Reset timer">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRunning(r => !r)}
              aria-label={running ? 'Pause timer' : 'Start timer'}
              className="w-14 h-14 rounded-xl flex items-center justify-center bg-accent hover:bg-accent-hover text-white shadow-xs transition-all"
            >
              {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5 bg-surface border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Today's Summary</h3>
            <div className="space-y-3 text-xs">
              {[
                { label: 'Focus time', value: `${totalFocus} min`, color: 'text-accent-text' },
                { label: 'Completed sessions', value: sessions.toString(), color: 'text-success' },
                { label: 'Breaks taken', value: sessions.toString(), color: 'text-warning' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-text-secondary">{s.label}</span>
                  <span className={`font-bold font-mono ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 bg-surface border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Ambient Sounds</h3>
              <button
                onClick={() => setSoundMuted(m => !m)}
                className="text-text-secondary hover:text-text-primary"
                aria-label={soundMuted ? 'Unmute ambient sounds' : 'Mute ambient sounds'}
              >
                {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SOUNDS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSound(as => as === s.id ? null : s.id)}
                  className={`p-2 rounded-lg text-xs text-center transition-all border ${
                    activeSound === s.id
                      ? 'bg-accent-light border-accent text-accent-text font-semibold'
                      : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4 bg-surface-subtle border-border">
            <h3 className="text-xs font-semibold text-text-primary mb-1.5">Study Habits</h3>
            <ul className="space-y-1 text-xs text-text-secondary">
              <li>• Eliminate phone distractions</li>
              <li>• Stay hydrated during breaks</li>
              <li>• Keep session goals clear</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
