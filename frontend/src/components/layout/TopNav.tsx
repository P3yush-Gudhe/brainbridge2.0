import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Plus, BookOpen, MessageSquare, CheckSquare, X, Calendar, Menu, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, resolveTheme } from '@/stores/appStore'
import { cn, formatDate } from '@/lib/utils'
import { OfflineStatusBadge, PWAInstallButton } from '@/components/common/PWAControls'
import api from '@/lib/api'

interface TopNavProps {
  onOpenCommandPalette?: () => void
  onOpenMobileMenu?: () => void
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

export function TopNav({ onOpenCommandPalette, onOpenMobileMenu }: TopNavProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [notifError, setNotifError] = useState(false)
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setNotifError(false)
        const res = await api.get('/dashboard/summary')
        if (active) {
          setSummary({
            upcomingExams: res.data?.upcomingExams || [],
            pendingTasks: res.data?.pendingTasks || [],
          })
        }
      } catch {
        if (active) setNotifError(true)
      }
    })()
    return () => { active = false }
  }, [])

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
    <header className="h-13 border-b border-border bg-surface flex items-center px-3 sm:px-5 gap-2 sm:gap-3 flex-shrink-0 sticky top-0 z-30 shadow-xs">
      {/* Mobile Sidebar Trigger */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open navigation menu"
        className="md:hidden btn btn-icon-sm btn-ghost text-text-secondary hover:text-text-primary flex-shrink-0"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Global Search — primary affordance */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-bg border border-border
          text-text-secondary hover:text-text-primary hover:border-border-strong transition-all duration-150
          text-xs flex-1 max-w-sm group min-w-0"
        aria-label="Open command palette (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0 text-text-muted group-hover:text-accent-text transition-colors" aria-hidden="true" />
        <span className="flex-1 text-left text-[13px] text-text-secondary truncate">Search notes, PDFs, tools...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] bg-surface border border-border rounded px-1.5 py-0.5 font-mono text-text-muted">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1 sm:gap-1.5">
        <OfflineStatusBadge />
        <PWAInstallButton />

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn btn-icon-sm btn-ghost text-text-secondary hover:text-text-primary"
          title={effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {effectiveTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Quick Add */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => { setQuickAddOpen(!quickAddOpen); setNotifOpen(false) }}
            aria-expanded={quickAddOpen}
            aria-haspopup="true"
            aria-label="Quick add menu"
            className={cn(
              'btn btn-icon-sm btn-ghost text-text-secondary',
              quickAddOpen && 'bg-surface-secondary text-text-primary'
            )}
            title="Quick action"
          >
            {quickAddOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>

          {quickAddOpen && (
            <div className="card-floating absolute right-0 top-full mt-1.5 w-48 py-1 z-50 animate-fade-in-scale">
              {quickAddItems.map((item) => (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => { navigate(item.path); setQuickAddOpen(false) }}
                  className="w-full px-3.5 py-2 text-left text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary flex items-center gap-2.5 transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0 text-accent-text" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => { setNotifOpen(!notifOpen); setQuickAddOpen(false) }}
            aria-expanded={notifOpen}
            className={cn(
              'btn btn-icon-sm btn-ghost relative text-text-secondary',
              notifOpen && 'bg-surface-secondary text-text-primary'
            )}
            title="Reminders & Upcoming Tasks"
            aria-label="Study reminders and notifications"
          >
            <Bell className="w-4 h-4 stroke-[1.8]" />
            {notifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" aria-hidden="true" />
            )}
          </button>

          {notifOpen && (
            <div className="card-floating absolute right-0 top-full mt-1.5 w-72 py-2 z-50 animate-fade-in-scale">
              <div className="px-3.5 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Study Reminders</span>
                <button
                  type="button"
                  onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                  className="text-[11px] text-accent-text hover:underline font-medium"
                >
                  Open planner
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-divider">
                {notifError ? (
                  <div className="px-3.5 py-5 text-center text-xs text-error">
                    Could not load study reminders right now.
                  </div>
                ) : notifCount === 0 ? (
                  <div className="px-3.5 py-5 text-center text-xs text-text-secondary">
                    No upcoming exams or pending tasks.
                  </div>
                ) : (
                  <>
                    {summary?.upcomingExams.map((ex) => (
                      <button
                        type="button"
                        key={`ex-${ex.id}`}
                        onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-surface-subtle flex items-start gap-2.5 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-text-primary truncate">Exam: {ex.subject}</div>
                          <div className="text-[11px] text-text-secondary">{formatDate(ex.examDate)}</div>
                        </div>
                      </button>
                    ))}
                    {summary?.pendingTasks.slice(0, 4).map((t) => (
                      <button
                        type="button"
                        key={`task-${t.id}`}
                        onClick={() => { navigate('/planner'); setNotifOpen(false) }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-surface-subtle flex items-start gap-2.5 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-accent-text mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-text-primary truncate">{t.topic}</div>
                          <div className="text-[11px] text-text-secondary">{t.subject} • {formatDate(t.taskDate, { month: 'short', day: 'numeric' })}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* Profile */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-secondary transition-colors"
          title="Profile"
          aria-label="Open profile"
        >
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="hidden md:inline text-xs font-medium text-text-primary">
            {user?.name?.split(' ')[0] || 'Profile'}
          </span>
        </button>
      </div>
    </header>
  )
}
