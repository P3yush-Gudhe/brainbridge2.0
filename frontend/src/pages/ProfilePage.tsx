import { useState, useEffect } from 'react'
import { Edit3, Flame, Clock, Trophy, Save, X, BookMarked } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'

export function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [totalHours, setTotalHours] = useState(0)
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    university: user?.university || '',
    year: user?.year || '',
  })

  useEffect(() => {
    setForm({
      name: user?.name || '',
      bio: user?.bio || '',
      university: user?.university || '',
      year: user?.year || '',
    })
  }, [user?.name, user?.bio, user?.university, user?.year])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/pomodoro')
        if (!active) return
        const mins = Number(res.data?.totalFocusMinutes) || 0
        setTotalHours(Math.round((mins / 60) * 10) / 10)
      } catch {
        if (active) toast.error('Failed to load study focus stats')
      }
    })()
    return () => { active = false }
  }, [])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await api.patch('/profile', form)
      const saved = res.data.user as { name: string; bio: string; university: string; year: string }
      updateUser({
        name: saved.name,
        bio: saved.bio,
        university: saved.university,
        year: saved.year,
      })
      setEditing(false)
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Profile</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your student profile and academic details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 text-center bg-surface border-border">
          <div className="relative w-16 h-16 mx-auto mb-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={`${user.name} avatar`} className="w-16 h-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
          </div>

          {editing ? (
            <input
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))}
              aria-label="Full name"
              className="text-base font-bold text-center bg-surface-subtle border border-border rounded-lg px-2.5 py-1 text-text-primary w-full outline-none mb-1"
            />
          ) : (
            <h2 className="text-lg font-bold text-text-primary mb-0.5">{user?.name || 'Student'}</h2>
          )}
          <p className="text-xs text-text-secondary">{form.university || user?.email}</p>
          <p className="text-[11px] text-text-muted mb-4 font-mono">{form.year || `Level ${user?.level || 1}`}</p>

          {editing ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditing(false)} leftIcon={<X className="w-3 h-3" />}>Cancel</Button>
              <Button size="sm" className="flex-1" isLoading={saving} onClick={() => void saveProfile()} leftIcon={<Save className="w-3 h-3" />}>Save</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} leftIcon={<Edit3 className="w-3.5 h-3.5" />} className="w-full">
              Edit profile
            </Button>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center bg-surface border-border">
              <Flame className="w-4 h-4 text-warning mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-text-primary">{user?.streak || 1} day{(user?.streak || 1) > 1 ? 's' : ''}</div>
              <div className="text-[11px] text-text-secondary">Streak</div>
            </Card>

            <Card className="p-4 text-center bg-surface border-border">
              <Clock className="w-4 h-4 text-accent-text mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-text-primary">{totalHours} hrs</div>
              <div className="text-[11px] text-text-secondary">Total focus</div>
            </Card>

            <Card className="p-4 text-center bg-surface border-border">
              <Trophy className="w-4 h-4 text-success mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-text-primary">{user?.xp || 0} XP</div>
              <div className="text-[11px] text-text-secondary">Level {user?.level || 1}</div>
            </Card>
          </div>

          {editing && (
            <Card className="p-5 bg-surface border-border">
              <CardTitle className="mb-3">Edit Academic Information</CardTitle>
              <div className="space-y-3">
                <Input id="bio" label="Bio" placeholder="Tell us what you are studying..." value={form.bio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, bio: e.target.value }))} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input id="university" label="University" placeholder="e.g. Stanford University" value={form.university} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, university: e.target.value }))} />
                  <Input id="year" label="Year" placeholder="e.g. 3rd Year" value={form.year} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 bg-surface border-border">
            <CardHeader className="mb-2">
              <CardTitle className="flex items-center gap-2"><BookMarked className="w-4 h-4 text-accent-text" /> About</CardTitle>
            </CardHeader>
            <p className="text-xs text-text-secondary leading-relaxed">
              {form.bio || 'No bio added yet. Click "Edit profile" to add your academic focus.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
