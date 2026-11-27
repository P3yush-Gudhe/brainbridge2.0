import { useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAppStore, resolveTheme } from '@/stores/appStore'

interface MermaidDiagramProps {
  chart: string
  className?: string
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const rawId = useId()
  const safeId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const { theme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setRendering(true)
        setError(null)
        const mermaidMod = await import('mermaid')
        const mermaid = mermaidMod.default
        mermaid.initialize({
          startOnLoad: false,
          theme: effectiveTheme === 'dark' ? 'dark' : 'neutral',
          securityLevel: 'strict',
        })
        const { svg: renderedSvg } = await mermaid.render(safeId, chart.trim())
        if (active) {
          setSvg(renderedSvg)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to render Mermaid diagram')
        }
      } finally {
        if (active) setRendering(false)
      }
    })()
    return () => { active = false }
  }, [chart, safeId, effectiveTheme])

  if (rendering) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-surface-subtle border border-border text-xs text-text-secondary">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
        Rendering diagram...
      </div>
    )
  }

  if (error || !svg) {
    return (
      <div className="p-3 rounded-xl bg-surface-subtle border border-border text-xs">
        <p className="text-error font-medium mb-1">Mermaid diagram preview unavailable</p>
        <pre className="text-[11px] font-mono text-text-secondary overflow-x-auto">{chart}</pre>
      </div>
    )
  }

  return (
    <div
      className={className || 'my-3 p-4 rounded-xl bg-surface-subtle border border-border overflow-x-auto flex justify-center'}
      // Mermaid securityLevel is 'strict'
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
