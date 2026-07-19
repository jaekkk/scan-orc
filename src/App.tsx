import { useRef, useState } from 'react'
import { usePages } from './hooks/usePages'
import { processImageFile } from './lib/pipeline/processImageFile'
import { buildPageFromOriginal } from './lib/pipeline/useOriginalPhoto'
import { CaptureScreen } from './components/CaptureScreen'
import { ProcessingOverlay } from './components/ProcessingOverlay'
import { PageThumbnailStrip } from './components/PageThumbnailStrip'
import { PagePreviewModal } from './components/PagePreviewModal'
import { ExportScreen } from './components/ExportScreen'
import type { Page } from './types/page'

type Step = 'capture' | 'processing' | 'export'

function App() {
  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const { pages, addPage, replacePage, removePage, reorderPages } = usePages()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const retakeTargetId = useRef<string | null>(null)

  function openCapture(retakePageId?: string) {
    retakeTargetId.current = retakePageId ?? null
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    const targetId = retakeTargetId.current
    retakeTargetId.current = null

    setError(null)
    setStep('processing')
    try {
      const page = await processImageFile(file)
      if (targetId) {
        replacePage(targetId, page)
      } else {
        addPage(page)
      }
    } catch (err) {
      console.error(err)
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setError(`사진 처리 중 오류가 발생했습니다. 다시 시도해주세요. [${detail}]`)
    } finally {
      setStep('capture')
    }
  }

  function handleRetake(page: Page) {
    setPreviewIndex(null)
    openCapture(page.id)
  }

  async function handleUseOriginal(page: Page) {
    setPreviewIndex(null)
    try {
      const updated = await buildPageFromOriginal(page)
      replacePage(page.id, updated)
    } catch (err) {
      console.error(err)
      setError('원본 사진 적용 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>scan-orc</h1>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        hidden
      />

      {error && <div className="error-banner">{error}</div>}

      {step === 'processing' && <ProcessingOverlay message="사진 처리 중…" />}

      {step === 'capture' && (
        <CaptureScreen
          pageCount={pages.length}
          onRequestCapture={() => openCapture()}
          onDone={() => setStep('export')}
        />
      )}

      {step === 'capture' && (
        <PageThumbnailStrip
          pages={pages}
          onRemove={removePage}
          onMove={reorderPages}
          onOpenPreview={setPreviewIndex}
        />
      )}

      {previewIndex !== null && pages[previewIndex] && (
        <PagePreviewModal
          page={pages[previewIndex]}
          pageIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onRetake={handleRetake}
          onUseOriginal={handleUseOriginal}
        />
      )}

      {step === 'export' && <ExportScreen pages={pages} onBack={() => setStep('capture')} />}
    </div>
  )
}

export default App
