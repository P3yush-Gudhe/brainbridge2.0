import { NavLink } from 'react-router-dom'
import { Home, MessageSquare, BookOpen, HelpCircle, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileBottomNavProps {
  onOpenMenu: () => void
}

const mobileTabs = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: BookOpen, label: 'Notes', path: '/notes' },
  { icon: HelpCircle, label: 'Quiz', path: '/quiz' },
]

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]"
    >
      {mobileTabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          aria-label={tab.label}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-w-[56px]',
              isActive
                ? 'text-accent-text bg-accent-light'
                : 'text-text-secondary hover:text-text-primary'
            )
          }
        >
          <tab.icon className="w-4 h-4 stroke-[1.9]" aria-hidden="true" />
          <span>{tab.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open all study tools menu"
        className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary hover:text-text-primary min-w-[56px]"
      >
        <Menu className="w-4 h-4 stroke-[1.9]" aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}
