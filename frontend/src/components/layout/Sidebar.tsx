import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, MessageSquare, FileText, BookOpen, Zap, HelpCircle,
  Calendar, BarChart3, Clock, Trophy, Settings, LogOut,
  Brain, Code2, Video, ScanLine, Map, Percent, Calculator,
  ChevronLeft, ChevronRight, User, Bookmark, Users, Mic, X
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

const navGroups = [
  {
    label: 'Home',
    items: [
      { icon: Home, label: 'Home', path: '/dashboard', shortcut: '⌘1' },
    ],
  },
  {
    label: 'Study',
    items: [
      { icon: MessageSquare, label: 'Chat', path: '/chat', shortcut: '⌘2' },
      { icon: Brain, label: 'Tutor', path: '/ai-tutor' },
      { icon: BookOpen, label: 'Notes', path: '/notes' },
      { icon: Mic, label: 'Voice', path: '/voice' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { icon: HelpCircle, label: 'Quiz', path: '/quiz' },
      { icon: Zap, label: 'Flashcards', path: '/flashcards' },
      { icon: Code2, label: 'Code', path: '/code' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { icon: FileText, label: 'PDF Reader', path: '/pdf' },
      { icon: ScanLine, label: 'OCR', path: '/ocr' },
      { icon: Map, label: 'Mind Map', path: '/mindmap' },
      { icon: Video, label: 'YouTube', path: '/youtube' },
    ],
  },
  {
    label: 'Plan',
    items: [
      { icon: Calendar, label: 'Planner', path: '/planner' },
      { icon: Clock, label: 'Pomodoro', path: '/pomodoro' },
    ],
  },
  {
    label: 'Track',
    items: [
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: Percent, label: 'Attendance', path: '/attendance' },
      { icon: Calculator, label: 'CGPA', path: '/cgpa' },
      { icon: Trophy, label: 'Achievements', path: '/achievements' },
      { icon: Users, label: 'Leaderboard', path: '/leaderboard' },
    ],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    onCloseMobile?.()
    toast.success('Logged out')
    navigate('/login')
  }

  const desktopW = sidebarCollapsed ? 56 : 220

  const renderContent = (collapsed: boolean, isMobile: boolean) => (
    <>
      {/* Brand header */}
      <div className="flex items-center justify-between h-13 border-b border-border flex-shrink-0 px-3.5 gap-2.5">
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard')
            onCloseMobile?.()
          }}
          className="flex items-center gap-2.5 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
          aria-label="Go to StudyMate dashboard"
        >
          <div className="w-7 h-7 rounded-md bg-[#5965B3] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
            <Bookmark className="w-4 h-4 fill-white/20 stroke-[2.2]" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-text-primary text-[0.9375rem] tracking-tight truncate leading-none">
              StudyMate
            </span>
          )}
        </button>

        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="btn-icon-sm btn-ghost text-text-secondary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main workspace navigation" className="flex-1 overflow-y-auto py-3.5 no-scrollbar px-2.5 space-y-3.5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1.5">
                {group.label}
              </p>
            )}
            {collapsed && <div className="divider mx-1 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && onCloseMobile?.()}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-item',
                      isActive && 'sidebar-item-active',
                      collapsed && 'justify-center'
                    )
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 stroke-[1.8]" aria-hidden="true" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {'shortcut' in item && item.shortcut && (
                        <span className="text-[10px] font-mono text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded border border-border">
                          {item.shortcut}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 flex-shrink-0 space-y-0.5 bg-surface-subtle">
        <NavLink
          to="/settings"
          onClick={() => isMobile && onCloseMobile?.()}
          title={collapsed ? 'Settings' : undefined}
          aria-label="Settings"
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'sidebar-item-active', collapsed && 'justify-center')
          }
        >
          <Settings className="w-4 h-4 flex-shrink-0 stroke-[1.8]" aria-hidden="true" />
          {!collapsed && <span className="flex-1 truncate">Settings</span>}
        </NavLink>

        <NavLink
          to="/profile"
          onClick={() => isMobile && onCloseMobile?.()}
          title={collapsed ? user?.name || 'Profile' : undefined}
          aria-label="Profile"
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'sidebar-item-active', collapsed && 'justify-center')
          }
        >
          <div className="w-4 h-4 rounded-full bg-[#5965B3] text-white text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || <User className="w-2.5 h-2.5" aria-hidden="true" />}
          </div>
          {!collapsed && (
            <span className="flex-1 truncate">{user?.name?.split(' ')[0] || 'Profile'}</span>
          )}
        </NavLink>

        <button
          type="button"
          onClick={() => void handleLogout()}
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
          className={cn(
            'sidebar-item w-full text-text-secondary hover:text-error hover:bg-error-light',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 stroke-[1.8]" aria-hidden="true" />
          {!collapsed && <span className="flex-1 text-left truncate">Logout</span>}
        </button>

        {!isMobile && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="sidebar-item w-full justify-center text-text-muted hover:text-text-primary hover:bg-surface-secondary"
          >
            {sidebarCollapsed
              ? <ChevronRight className="w-4 h-4 stroke-[1.8]" />
              : <ChevronLeft className="w-4 h-4 stroke-[1.8]" />
            }
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: desktopW }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex fixed left-0 top-0 h-full bg-surface border-r border-border flex-col z-40 overflow-hidden select-none"
      >
        {renderContent(sidebarCollapsed, false)}
      </motion.aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-xs"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Workspace navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-64 max-w-[82vw] h-full bg-surface border-r border-border flex flex-col z-10 overflow-hidden select-none shadow-lg"
            >
              {renderContent(false, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
