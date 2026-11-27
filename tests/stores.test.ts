import { beforeEach, describe, expect, it } from 'vitest'
import { resolveTheme, useAppStore } from '../frontend/src/stores/appStore.ts'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'light',
      activeChat: null,
    })
  })

  it('resolves explicit light/dark and system fallback themes', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('system')).toBe('light')
  })

  it('updates theme with setTheme and toggleTheme', () => {
    const store = useAppStore.getState()
    store.setTheme('dark')
    expect(useAppStore.getState().theme).toBe('dark')

    useAppStore.getState().toggleTheme()
    expect(useAppStore.getState().theme).toBe('light')
  })

  it('updates sidebar and active chat state', () => {
    const store = useAppStore.getState()
    store.setSidebarOpen(false)
    store.setSidebarCollapsed(true)
    store.setActiveChat('conv-42')

    const next = useAppStore.getState()
    expect(next.sidebarOpen).toBe(false)
    expect(next.sidebarCollapsed).toBe(true)
    expect(next.activeChat).toBe('conv-42')
  })
})
