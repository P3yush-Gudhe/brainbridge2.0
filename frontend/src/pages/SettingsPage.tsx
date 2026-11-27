import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Bell, Monitor, Trash2, Sun, Moon, Laptop, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface PersistedSettings {
  theme: 'light' | 'dark' | 'system'
  examReminders: boolean
  streakAlerts: boolean
  weeklySummary: boolean
  leaderboardVisible: boolean
  dailyGoalMinutes: number
}

export function SettingsPage() {
  const { theme, setTheme } = useAppStore()
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settings, setSettings] = useState<PersistedSettings>({
    theme,
    examReminders: true,
    streakAlerts: true,
    weeklySummary: true,
    leaderboardVisible: false,
    dailyGoalMinutes: 60,
  })
  const [activeSection, setActiveSection] = useState('account')

  useEffect(() => {
    setName(user?.name || '')
  }, [user?.name])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoadingSettings(true)
        setSettingsError(null)
        const res = await api.get('/settings')
        if (!active) return
        const s = res.data?.settings as Partial<PersistedSettings> | undefined
        if (s) {
          const next: PersistedSettings = {
            theme: s.theme === 'dark' || s.theme === 'light' || s.theme === 'system' ? s.theme : theme,
            examReminders: typeof s.examReminders === 'boolean' ? s.examReminders : true,
            streakAlerts: typeof s.streakAlerts === 'boolean' ? s.streakAlerts : true,
            weeklySummary: typeof s.weeklySummary === 'boolean' ? s.weeklySummary : true,
            leaderboardVisible: typeof s.leaderboardVisible === 'boolean' ? s.leaderboardVisible : false,
            dailyGoalMinutes: typeof s.dailyGoalMinutes === 'number' ? s.dailyGoalMinutes : 60,
          }
          setSettings(next)
        }
      } catch (err: unknown) {
        if (!active) return
        const msg = err instanceof Error ? err.message : 'Failed to load settings'
        setSettingsError(msg)
        toast.error('Failed to load settings')
      } finally {
        if (active) setLoadingSettings(false)
      }
    })()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchSettings = async (patch: Partial<PersistedSettings>, successMsg?: string) => {
    const prev = settings
    setSettings((cur) => ({ ...cur, ...patch }))
    if (patch.theme) {
      setTheme(patch.theme)
    }
    try {
      const res = await api.patch('/settings', patch)
      if (res.data?.settings) {
        setSettings((cur) => ({ ...cur, ...res.data.settings }))
      }
      if (successMsg) toast.success(successMsg)
    } catch {
      setSettings(prev)
      if (patch.theme) setTheme(prev.theme)
      toast.error('Failed to save setting')
    }
  }

  const sections = [
    { icon: User, label: 'Account', id: 'account' },
    { icon: Bell, label: 'Notifications', id: 'notifications' },
    { icon: Monitor, label: 'Appearance', id: 'appearance' },
    { icon: Shield, label: 'Privacy', id: 'privacy' },
  ]

  const saveAccount = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await api.patch('/profile', { name: name.trim() })
      updateUser({ name: res.data.user.name })
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const exportStudyData = async () => {
    setExporting(true)
    try {
      const res = await api.get('/account/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studymate-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Study data exported')
    } catch {
      toast.error('Failed to export study data')
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/account')
      await logout()
      toast.success('Account data deleted')
      navigate('/login')
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  const notificationItems: Array<{
    key: 'examReminders' | 'streakAlerts' | 'weeklySummary'
    label: string
    desc: string
  }> = [
    { key: 'examReminders', label: 'Exam Reminders', desc: 'Get notified before upcoming exams' },
    { key: 'streakAlerts', label: 'Streak Alerts', desc: 'Daily reminder to maintain your study schedule' },
    { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Receive weekly academic progress summary' },
  ]

  return (
    <div className="flex flex-col md:flex-row h-full bg-bg">
      {/* Desktop Sidebar / Mobile Tabs */}
      <div className="md:w-52 border-b md:border-b-0 md:border-r border-border bg-surface p-3 flex-shrink-0">
        <p className="hidden md:block text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">Settings</p>
        <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
          {sections.map(s => (
            <button
              type="button"
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left whitespace-nowrap',
                activeSection === s.id
                  ? 'bg-accent-light text-accent-text'
                  : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
              )}
            >
              <s.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveSection('danger')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-error hover:bg-error-light transition-all text-left font-medium whitespace-nowrap md:mt-3',
              activeSection === 'danger' && 'bg-error-light'
            )}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Danger Zone
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {loadingSettings && (
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" /> Loading saved preferences...
          </div>
        )}
        {settingsError && (
          <div role="alert" className="max-w-lg mb-4 p-3 rounded-lg bg-error-light border border-error/30 text-xs text-error">
            {settingsError}
          </div>
        )}

        <motion.div key={activeSection} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {activeSection === 'account' && (
            <div className="max-w-lg space-y-6">
              <h1 className="text-xl font-bold text-text-primary">Account Settings</h1>
              <Card className="p-5 space-y-4">
                <Input id="settings-name" label="Full Name" value={name} onChange={e => setName(e.target.value)} />
                <Input id="settings-email" label="Google Account Email" type="email" value={user?.email || ''} disabled />
                <div>
                  <label htmlFor="daily-goal" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Daily Focus Goal (minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="daily-goal"
                      type="number"
                      min={15}
                      max={480}
                      step={15}
                      value={settings.dailyGoalMinutes}
                      onChange={e => setSettings(s => ({ ...s, dailyGoalMinutes: Math.max(15, Math.min(480, Number(e.target.value) || 60)) }))}
                      className="input w-28 text-xs"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void patchSettings({ dailyGoalMinutes: settings.dailyGoalMinutes }, 'Daily goal updated')}
                    >
                      Save goal
                    </Button>
                  </div>
                </div>
                <Button onClick={() => void saveAccount()} isLoading={saving} size="sm">Save account</Button>
              </Card>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="max-w-lg space-y-6">
              <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
              <Card className="p-5 divide-y divide-border">
                {notificationItems.map(n => {
                  const enabled = settings[n.key]
                  return (
                    <div key={n.key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div>
                        <div className="text-xs font-semibold text-text-primary">{n.label}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{n.desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={n.label}
                        onClick={() => void patchSettings({ [n.key]: !enabled }, `${n.label} ${!enabled ? 'enabled' : 'disabled'}`)}
                        className={cn('w-9 h-5 rounded-full relative transition-all flex-shrink-0', enabled ? 'bg-[#5965B3]' : 'bg-surface-hover border border-border')}
                      >
                        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-all', enabled ? 'left-4.5' : 'left-0.5')} />
                      </button>
                    </div>
                  )
                })}
              </Card>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="max-w-lg space-y-6">
              <h1 className="text-xl font-bold text-text-primary">Appearance</h1>
              <Card className="p-5">
                <h2 className="section-title mb-3">Workspace Theme</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light' as const, label: 'Light', icon: Sun },
                    { id: 'dark' as const, label: 'Dark', icon: Moon },
                    { id: 'system' as const, label: 'System', icon: Laptop },
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => void patchSettings({ theme: t.id }, `Theme set to ${t.label}`)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-medium transition-all',
                        settings.theme === t.id ? 'bg-accent-light border-accent text-accent-text' : 'border-border text-text-secondary bg-surface-subtle hover:border-border-strong'
                      )}
                    >
                      <t.icon className="w-5 h-5" aria-hidden="true" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="max-w-lg space-y-6">
              <h1 className="text-xl font-bold text-text-primary">Privacy & Data</h1>
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border gap-3">
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Show me on Study Leaderboard</div>
                    <div className="text-xs text-text-secondary mt-0.5">Opt in to share your weekly hours, quizzes, streak, and XP with other students</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.leaderboardVisible}
                    aria-label="Show me on Study Leaderboard"
                    onClick={() =>
                      void patchSettings(
                        { leaderboardVisible: !settings.leaderboardVisible },
                        !settings.leaderboardVisible ? 'Opted into Study Leaderboard' : 'Hidden from Study Leaderboard'
                      )
                    }
                    className={cn('w-9 h-5 rounded-full relative transition-all flex-shrink-0', settings.leaderboardVisible ? 'bg-[#5965B3]' : 'bg-surface-hover border border-border')}
                  >
                    <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-all', settings.leaderboardVisible ? 'left-4.5' : 'left-0.5')} />
                  </button>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">
                  Your notes, flashcards, study schedules, and quiz attempts are stored securely in your private account workspace.
                </p>
                <Button variant="secondary" size="sm" isLoading={exporting} onClick={() => void exportStudyData()}>
                  Export study data (JSON)
                </Button>
              </Card>
            </div>
          )}

          {activeSection === 'danger' && (
            <div className="max-w-lg space-y-6">
              <h1 className="text-xl font-bold text-error">Danger Zone</h1>
              <Card className="p-5 border-error/25 bg-error-light space-y-3">
                <h2 className="font-semibold text-xs text-text-primary">Delete Account Data</h2>
                <p className="text-xs text-text-secondary">This action permanently deletes all notes, flashcards, chats, and planner records tied to your account.</p>
                <Button variant="danger" size="sm" isLoading={deleting} onClick={() => void deleteAccount()}>Delete account data</Button>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
