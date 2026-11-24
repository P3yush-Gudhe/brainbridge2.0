import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, MessageSquare, FileText, BookOpen, Zap, HelpCircle,
  Calendar, BarChart3, Clock, Trophy, Settings, LogOut,
  Brain, Code2, Video, ScanLine, Map, Percent, Calculator,
  ChevronLeft, ChevronRight, User, Bookmark
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
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  const W = sidebarCollapsed ? 56 : 220

  return (
    <motion.aside
      initial={false}
      animate={{ width: W }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 h-full bg-white border-r border-[#E7E5E0] flex flex-col z-40 overflow-hidden select-none"
    >
      {/* Brand header */}
      <div className="flex items-center h-13 border-b border-[#E7E5E0] flex-shrink-0 px-3.5 gap-2.5">
        <div
          className="w-7 h-7 rounded-md bg-[#5965B3] flex items-center justify-center text-white flex-shrink-0 cursor-pointer shadow-xs"
          onClick={() => navigate('/dashboard')}
        >
          <Bookmark className="w-4 h-4 fill-white/20 stroke-[2.2]" />
        </div>

        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.05 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex items-center justify-between flex-1 min-w-0"
            >
              <span className="font-semibold text-[#252525] text-[0.9375rem] tracking-tight truncate leading-none">
                StudyMate
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3.5 no-scrollbar px-2.5 space-y-3.5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <p className="text-[11px] font-semibold text-[#999999] uppercase tracking-wider px-2 mb-1.5">
                {group.label}
              </p>
            )}
            {sidebarCollapsed && <div className="divider mx-1 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-item',
                      isActive && 'sidebar-item-active',
                      sidebarCollapsed && 'justify-center'
                    )
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 stroke-[1.8]" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {'shortcut' in item && (
                        <span className="text-[10px] font-mono text-[#999999] bg-[#F0F0ED] px-1.5 py-0.5 rounded border border-[#E7E5E0]">
                          {(item as { shortcut: string }).shortcut}
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
      <div className="border-t border-[#E7E5E0] p-2 flex-shrink-0 space-y-0.5 bg-[#FAF9F6]">
        {/* Settings */}
        <NavLink
          to="/settings"
          title={sidebarCollapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'sidebar-item-active', sidebarCollapsed && 'justify-center')
          }
        >
          <Settings className="w-4 h-4 flex-shrink-0 stroke-[1.8]" />
          {!sidebarCollapsed && <span className="flex-1 truncate">Settings</span>}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          title={sidebarCollapsed ? user?.name || 'Profile' : undefined}
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'sidebar-item-active', sidebarCollapsed && 'justify-center')
          }
        >
          <div className="w-4 h-4 rounded-full bg-[#5965B3] text-white text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || <User className="w-2.5 h-2.5" />}
          </div>
          {!sidebarCollapsed && (
            <span className="flex-1 truncate">{user?.name?.split(' ')[0] || 'Profile'}</span>
          )}
        </NavLink>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Logout' : undefined}
          className={cn(
            'sidebar-item w-full text-[#707070] hover:text-[#B45D5D] hover:bg-[#FBEFEF]',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 stroke-[1.8]" />
          {!sidebarCollapsed && <span className="flex-1 text-left truncate">Logout</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-item w-full justify-center text-[#999999] hover:text-[#252525] hover:bg-[#F0F0ED]"
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4 stroke-[1.8]" />
            : <ChevronLeft className="w-4 h-4 stroke-[1.8]" />
          }
        </button>
      </div>
    </motion.aside>
  )
}
