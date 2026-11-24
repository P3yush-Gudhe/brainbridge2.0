import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Bell, Monitor, Trash2, Sun, Moon, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

export function SettingsPage() {
  const { theme, toggleTheme } = useAppStore()
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'exam', label: 'Exam Reminders', desc: 'Get notified before upcoming exams', enabled: true },
    { id: 'streak', label: 'Streak Alerts', desc: 'Daily reminder to maintain your study schedule', enabled: true },
    { id: 'weekly', label: 'Weekly Summary', desc: 'Receive weekly academic progress summary', enabled: true },
  ])
  const [activeSection, setActiveSection] = useState('account')

  useEffect(() => {
    setName(user?.name || '')
  }, [user?.name])

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

  return (
    <div className="flex h-full bg-[#F7F7F5]">
      <div className="w-52 border-r border-[#E7E5E0] bg-white p-3 flex-shrink-0">
        <p className="text-[11px] font-semibold text-[#999999] uppercase tracking-wider px-3 mb-2">Settings</p>
        <div className="space-y-0.5">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left',
                activeSection === s.id
                  ? 'bg-[#ECEEF7] text-[#5965B3]'
                  : 'text-[#707070] hover:bg-[#FAF9F6] hover:text-[#252525]'
              )}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-[#E7E5E0]">
          <button
            onClick={() => setActiveSection('danger')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#B45D5D] hover:bg-[#FBEFEF] transition-all text-left font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" /> Danger Zone
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {activeSection === 'account' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-[#252525]">Account Settings</h2>
              <Card className="p-5 space-y-4 bg-white border-[#E7E5E0]">
                <Input id="settings-name" label="Full Name" value={name} onChange={e => setName(e.target.value)} />
                <Input id="settings-email" label="Google Account Email" type="email" value={user?.email || ''} disabled />
                <Button onClick={() => void saveAccount()} isLoading={saving} size="sm">Save changes</Button>
              </Card>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-[#252525]">Notifications</h2>
              <Card className="p-5 divide-y divide-[#E7E5E0] bg-white border-[#E7E5E0]">
                {notifications.map(n => (
                  <div key={n.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div>
                      <div className="text-xs font-semibold text-[#252525]">{n.label}</div>
                      <div className="text-xs text-[#707070] mt-0.5">{n.desc}</div>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, enabled: !item.enabled } : item))}
                      className={cn('w-9 h-5 rounded-full relative transition-all', n.enabled ? 'bg-[#5965B3]' : 'bg-[#E7E5E0]')}
                    >
                      <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', n.enabled ? 'left-4.5' : 'left-0.5')} />
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-[#252525]">Appearance</h2>
              <Card className="p-5 bg-white border-[#E7E5E0]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-3">Workspace Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[{ id: 'light', label: 'Light Workspace', icon: Sun }, { id: 'dark', label: 'Dark Mode', icon: Moon }].map(t => (
                    <button
                      key={t.id}
                      onClick={() => { if ((t.id === 'dark') !== (theme === 'dark')) toggleTheme() }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-medium transition-all',
                        theme === t.id ? 'bg-[#ECEEF7] border-[#5965B3] text-[#5965B3]' : 'border-[#E7E5E0] text-[#707070] bg-[#FAF9F6]'
                      )}
                    >
                      <t.icon className="w-5 h-5" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-[#252525]">Privacy & Data</h2>
              <Card className="p-5 space-y-4 bg-white border-[#E7E5E0]">
                <p className="text-xs text-[#707070] leading-relaxed">
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
              <h2 className="text-xl font-bold text-[#B45D5D]">Danger Zone</h2>
              <Card className="p-5 border-[#B45D5D]/20 bg-[#FBEFEF] space-y-3">
                <h3 className="font-semibold text-xs text-[#252525]">Delete Account Data</h3>
                <p className="text-xs text-[#707070]">This action permanently deletes all notes, flashcards, chats, and planner records tied to your account.</p>
                <Button variant="danger" size="sm" isLoading={deleting} onClick={() => void deleteAccount()}>Delete account data</Button>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
