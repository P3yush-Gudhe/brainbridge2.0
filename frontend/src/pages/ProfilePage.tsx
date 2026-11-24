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
        // Ignore
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Profile</h1>
        <p className="text-[#707070] text-sm mt-1">Manage your student profile and academic details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 text-center bg-white border-[#E7E5E0]">
          <div className="relative w-16 h-16 mx-auto mb-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border border-[#E7E5E0]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#5965B3] text-white flex items-center justify-center text-xl font-bold">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
          </div>

          {editing ? (
            <input
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))}
              className="text-base font-bold text-center bg-[#FAF9F6] border border-[#E7E5E0] rounded-lg px-2.5 py-1 text-[#252525] w-full outline-none mb-1"
            />
          ) : (
            <h2 className="text-lg font-bold text-[#252525] mb-0.5">{user?.name || 'Student'}</h2>
          )}
          <p className="text-xs text-[#707070]">{form.university || user?.email}</p>
          <p className="text-[11px] text-[#999999] mb-4 font-mono">{form.year || `Level ${user?.level || 1}`}</p>

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
            <Card className="p-4 text-center bg-white border-[#E7E5E0]">
              <Flame className="w-4 h-4 text-[#B4863A] mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-[#252525]">{user?.streak || 1} day{(user?.streak || 1) > 1 ? 's' : ''}</div>
              <div className="text-[11px] text-[#707070]">Streak</div>
            </Card>

            <Card className="p-4 text-center bg-white border-[#E7E5E0]">
              <Clock className="w-4 h-4 text-[#5965B3] mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-[#252525]">{totalHours} hrs</div>
              <div className="text-[11px] text-[#707070]">Total focus</div>
            </Card>

            <Card className="p-4 text-center bg-white border-[#E7E5E0]">
              <Trophy className="w-4 h-4 text-[#5C8A6A] mx-auto mb-1" />
              <div className="text-lg font-bold font-mono text-[#252525]">{user?.xp || 0} XP</div>
              <div className="text-[11px] text-[#707070]">Level {user?.level || 1}</div>
            </Card>
          </div>

          {editing && (
            <Card className="p-5 bg-white border-[#E7E5E0]">
              <CardTitle className="mb-3">Edit Academic Information</CardTitle>
              <div className="space-y-3">
                <Input id="bio" label="Bio" placeholder="Tell us what you are studying..." value={form.bio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, bio: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input id="university" label="University" placeholder="e.g. Stanford University" value={form.university} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, university: e.target.value }))} />
                  <Input id="year" label="Year" placeholder="e.g. 3rd Year" value={form.year} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 bg-white border-[#E7E5E0]">
            <CardHeader className="mb-2">
              <CardTitle className="flex items-center gap-2"><BookMarked className="w-4 h-4 text-[#5965B3]" /> About</CardTitle>
            </CardHeader>
            <p className="text-xs text-[#707070] leading-relaxed">
              {form.bio || 'No bio added yet. Click "Edit profile" to add your academic focus.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
