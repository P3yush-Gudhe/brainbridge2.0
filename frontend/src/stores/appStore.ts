import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyThemeToDom(mode: ThemeMode): 'light' | 'dark' {
  const effective = resolveTheme(mode)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', effective === 'dark')
    document.documentElement.dataset.theme = effective
  }
  return effective
}

interface AppState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  theme: ThemeMode
  activeChat: string | null
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setActiveChat: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',
      activeChat: null,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => {
        applyThemeToDom(theme)
        set({ theme })
      },
      toggleTheme: () =>
        set((state) => {
          const currentEffective = resolveTheme(state.theme)
          const next: ThemeMode = currentEffective === 'dark' ? 'light' : 'dark'
          applyThemeToDom(next)
          return { theme: next }
        }),
      setActiveChat: (id) => set({ activeChat: id }),
    }),
    {
      name: 'studymate-app',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeToDom(state.theme)
      },
    }
  )
)
