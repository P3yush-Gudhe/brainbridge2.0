import { useState, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfDocumentPreviewProps {
  fileBase64: string
  currentPage: number
  onPageChange: (page: number) => void
}

export default function PdfDocumentPreview({ fileBase64, currentPage, onPageChange }: PdfDocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number>(1)

  const fileSource = useMemo(() => {
    return { data: Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0)) }
  }, [fileBase64])

  const clampedPage = Math.max(1, Math.min(currentPage, numPages))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-surface-subtle border border-border rounded-lg px-3 py-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
          aria-label="Previous PDF page"
        >
          Prev
        </Button>
        <span className="text-xs font-mono text-text-secondary">
          Page <strong className="text-text-primary">{clampedPage}</strong> of {numPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={clampedPage >= numPages}
          onClick={() => onPageChange(Math.min(numPages, clampedPage + 1))}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          aria-label="Next PDF page"
        >
          Next
        </Button>
      </div>

      <div className="flex justify-center overflow-auto max-h-[600px] bg-surface-secondary rounded-xl border border-border p-3">
        <Document
          file={fileSource}
          onLoadSuccess={({ numPages: total }) => setNumPages(total || 1)}
          loading={
            <div className="flex items-center gap-2 py-12 text-xs text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-accent-text" /> Rendering PDF page...
            </div>
          }
          error={
            <div className="py-10 text-xs text-error text-center">
              Unable to render PDF canvas preview. Extracted text remains available.
            </div>
          }
        >
          <Page pageNumber={clampedPage} width={Math.min(680, typeof window !== 'undefined' ? window.innerWidth - 96 : 640)} />
        </Document>
      </div>
    </div>
  )
}
