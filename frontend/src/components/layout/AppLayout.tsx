import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { MobileBottomNav } from './MobileBottomNav'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

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
    <div className="flex h-screen bg-bg text-text-primary overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-primary btn-sm"
      >
        Skip to content
      </a>

      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-[margin] duration-200 ease-out ml-0',
          sidebarCollapsed ? 'md:ml-[56px]' : 'md:ml-[220px]'
        )}
      >
        <TopNav
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
        />
        <main
          id="main-content"
          key={location.pathname}
          className="flex-1 overflow-y-auto animate-fade-in pb-16 md:pb-0"
        >
          <Outlet />
        </main>
      </div>

      <MobileBottomNav onOpenMenu={() => setMobileNavOpen(true)} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
