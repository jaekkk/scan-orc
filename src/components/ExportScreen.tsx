import { useState } from 'react'
import type { Page } from '../types/page'
import type { ImageFormat } from '../lib/export/buildImageZip'

interface ExportScreenProps {
  pages: Page[]
  onBack: () => void
}

type Busy = 'pdf' | 'images' | null

export function ExportScreen({ pages, onBack }: ExportScreenProps) {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<ImageFormat>('jpeg')

  async function handleDownloadPdf() {
    setError(null)
    setBusy('pdf')
    try {
      const [{ buildPdf }, { saveAs }] = await Promise.all([
        import('../lib/pdf/buildPdf'),
        import('file-saver'),
      ])
      const blob = await buildPdf(pages)
      saveAs(blob, 'scan.pdf')
    } catch (err) {
      console.error(err)
      setError('PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDownloadImages() {
    setError(null)
    setBusy('images')
    try {
      const { saveAs } = await import('file-saver')
      const ext = format === 'jpeg' ? 'jpg' : 'png'

      if (pages.length === 1) {
        // Single page: skip the zip entirely for a plain one-click download.
        const { toImageBlob } = await import('../lib/export/buildImageZip')
        const blob = await toImageBlob(pages[0], format)
        saveAs(blob, `scan.${ext}`)
        return
      }

      const { buildImageZip } = await import('../lib/export/buildImageZip')
      const zipBlob = await buildImageZip(pages, format)
      saveAs(zipBlob, 'scan-pages.zip')
    } catch (err) {
      console.error(err)
      setError('이미지 생성 중 오류가 발생했습니다.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen export-screen">
      <p className="page-count">{pages.length}장 내보내기</p>

      {error && <div className="error-banner">{error}</div>}

      <button
        type="button"
        className="primary-button"
        disabled={busy !== null}
        onClick={handleDownloadPdf}
      >
        {busy === 'pdf' ? 'PDF 생성 중…' : 'PDF로 다운로드'}
      </button>

      <div className="format-toggle" role="radiogroup" aria-label="이미지 형식">
        <label>
          <input
            type="radio"
            name="format"
            checked={format === 'jpeg'}
            onChange={() => setFormat('jpeg')}
          />
          JPG
        </label>
        <label>
          <input
            type="radio"
            name="format"
            checked={format === 'png'}
            onChange={() => setFormat('png')}
          />
          PNG
        </label>
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={busy !== null}
        onClick={handleDownloadImages}
      >
        {busy === 'images'
          ? '이미지 생성 중…'
          : pages.length > 1
            ? '이미지로 다운로드 (zip)'
            : '이미지로 다운로드'}
      </button>

      <button type="button" className="secondary-button" onClick={onBack}>
        뒤로
      </button>
    </div>
  )
}
