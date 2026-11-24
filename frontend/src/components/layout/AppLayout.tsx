import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      } else if (key === '1') {
        e.preventDefault()
        navigate('/dashboard')
      } else if (key === '2') {
        e.preventDefault()
        navigate('/chat')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="flex h-screen bg-[#F7F7F5] text-[#252525] overflow-hidden">
      <Sidebar />

      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-[margin] duration-200 ease-out',
          sidebarCollapsed ? 'ml-[56px]' : 'ml-[220px]'
        )}
      >
        <TopNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main
          key={location.pathname}
          className="flex-1 overflow-y-auto animate-fade-in"
        >
          <Outlet />
        </main>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
