import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Plus, BookOpen, MessageSquare, CheckSquare, X, Calendar } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatDate } from '@/lib/utils'
import api from '@/lib/api'

interface TopNavProps {
  onOpenCommandPalette?: () => void
}

interface NotificationSummary {
  upcomingExams: Array<{ id: number; subject: string; examDate: string }>
  pendingTasks: Array<{ id: number; subject: string; topic: string; taskDate: string }>
}

const quickAddItems = [
  { icon: BookOpen, label: 'New note', path: '/notes' },
  { icon: MessageSquare, label: 'New conversation', path: '/chat' },
  { icon: CheckSquare, label: 'Add task', path: '/planner' },
]

export function TopNav({ onOpenCommandPalette }: TopNavProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.get('/dashboard/summary')
        if (active) {
          setSummary({
            upcomingExams: res.data?.upcomingExams || [],
            pendingTasks: res.data?.pendingTasks || [],
          })
        }
      } catch {
        // Non-blocking
      }
    })()
    return () => { active = false }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setQuickAddOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (quickAddOpen || notifOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [quickAddOpen, notifOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setQuickAddOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const notifCount = (summary?.upcomingExams.length || 0) + (summary?.pendingTasks.length || 0)

  return (
    <header className="h-13 border-b border-[#E7E5E0] bg-white flex items-center px-5 gap-3 flex-shrink-0 sticky top-0 z-30 shadow-xs">

      {/* Global Search — primary affordance */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#F7F7F5] border border-[#E7E5E0]
          text-[#707070] hover:text-[#252525] hover:border-[#D4D2CD] transition-all duration-150
          text-xs flex-1 max-w-sm group"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0 text-[#999999] group-hover:text-[#5965B3] transition-colors" />
        <span className="flex-1 text-left text-[13px] text-[#707070]">Search notes, PDFs, topics...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] bg-white border border-[#E7E5E0] rounded px-1.5 py-0.5 font-mono text-[#999999]">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        {/* Quick Add */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setQuickAddOpen(!quickAddOpen); setNotifOpen(false) }}
            aria-expanded={quickAddOpen}
            aria-haspopup="true"
            className={cn(
              'btn btn-icon-sm btn-ghost text-[#707070]',
              quickAddOpen && 'bg-[#F0F0ED] text-[#252525]'
            )}
            title="Quick action"
          >
            {quickAddOpen
              ? <X className="w-4 h-4" />
              : <Plus className="w-4 h-4" />
            }
          </button>

          {quickAddOpen && (
            <div className="card-floating absolute right-0 top-full mt-1.5 w-48 py-1 z-50 animate-fade-in-scale">
              {quickAddItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setQuickAddOpen(false) }}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#707070] hover:text-[#252525] hover:bg-[#F0F0ED] flex items-center gap-2.5 transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0 text-[#5965B3]" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setQuickAddOpen(false) }}
            aria-expanded={notifOpen}
            className={cn(
              'btn btn-icon-sm btn-ghost relative text-[#707070]',
              notifOpen && 'bg-[#F0F0ED] text-[#252525]'
            )}
            title="Reminders & Upcoming Tasks"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 stroke-[1.8]" />
            {notifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#5965B3] rounded-full" />
            )}
          </button>

          {notifOpen && (
            <div className="card-floating absolute right-0 top-full mt-1.5 w-72 py-2 z-50 animate-fade-in-scale">
              <div className="px-3.5 py-1.5 border-b border-[#E7E5E0] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#252525]">Study Reminders</span>
                <button
                  onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                  className="text-[11px] text-[#5965B3] hover:underline font-medium"
                >
                  Open planner
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#EDECEA]">
                {notifCount === 0 ? (
                  <div className="px-3.5 py-5 text-center text-xs text-[#707070]">
                    No upcoming exams or pending tasks.
                  </div>
                ) : (
                  <>
                    {summary?.upcomingExams.map((ex) => (
                      <button
                        key={`ex-${ex.id}`}
                        onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#FAF9F6] flex items-start gap-2.5 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#B4863A] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#252525] truncate">Exam: {ex.subject}</div>
                          <div className="text-[11px] text-[#707070]">{formatDate(ex.examDate)}</div>
                        </div>
                      </button>
                    ))}
                    {summary?.pendingTasks.slice(0, 4).map((t) => (
                      <button
                        key={`task-${t.id}`}
                        onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#FAF9F6] flex items-start gap-2.5 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-[#5965B3] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#252525] truncate">{t.topic}</div>
                          <div className="text-[11px] text-[#707070]">{t.subject} • {formatDate(t.taskDate, { month: 'short', day: 'numeric' })}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#E7E5E0] mx-1" />

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#F0F0ED] transition-colors"
          title="Profile"
        >
          <div className="w-6 h-6 rounded-full bg-[#5965B3] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="hidden md:inline text-xs font-medium text-[#252525]">
            {user?.name?.split(' ')[0] || 'Profile'}
          </span>
        </button>
      </div>
    </header>
  )
}
