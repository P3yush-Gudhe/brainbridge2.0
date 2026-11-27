import { useState } from 'react'
import { Download, WifiOff, X } from 'lucide-react'
import { useOnlineStatus, usePWAInstall } from '@/hooks/usePWA'
import { Button } from '@/components/ui/Button'

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  if (isInstalled) return null

  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void install()}
        leftIcon={<Download className="w-3.5 h-3.5 text-accent-text" />}
        className="hidden sm:inline-flex"
        aria-label="Install StudyMate app"
      >
        Install app
      </Button>
    )
  }

  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          leftIcon={<Download className="w-3.5 h-3.5 text-accent-text" />}
          aria-label="Install StudyMate on iOS"
        >
          Install
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
            <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 id="ios-install-title" className="text-base font-semibold text-text-primary">Install on iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="btn-icon-sm btn-ghost text-text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <Button variant="secondary" className="w-full" onClick={() => setShowIOSGuide(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}

export function OfflineStatusBadge() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-light border border-warning/40 px-2.5 py-0.5 text-[11px] font-medium text-warning"
      title="Offline — cached notes and flashcard decks remain available"
    >
      <WifiOff className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">Offline</span>
    </span>
  )
}
