import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { applyThemeToDom, useAppStore } from './stores/appStore'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Apply persisted or OS-default theme immediately before render
applyThemeToDom(useAppStore.getState().theme)

// Keep OS prefers-color-scheme in sync when mode is 'system'
if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSchemeChange = () => {
    if (useAppStore.getState().theme === 'system') {
      applyThemeToDom('system')
    }
  }
  mediaQuery.addEventListener?.('change', handleSchemeChange)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              boxShadow: 'var(--shadow-md)',
            },
            success: {
              iconTheme: { primary: '#3E7250', secondary: '#FFFFFF' },
            },
            error: {
              iconTheme: { primary: '#A64444', secondary: '#FFFFFF' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
