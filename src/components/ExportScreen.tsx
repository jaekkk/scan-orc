import { useState } from 'react'
import type { Page } from '../types/page'
import type { ImageFormat } from '../lib/export/buildImageZip'
import { canShareFiles, shareFiles } from '../lib/export/shareFiles'

interface ExportScreenProps {
  pages: Page[]
  onBack: () => void
}

type Busy = 'pdf' | 'images' | 'share-pdf' | 'share-images' | null

export function ExportScreen({ pages, onBack }: ExportScreenProps) {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<ImageFormat>('jpeg')
  // Feature-detected once, not re-checked per render — Web Share support
  // doesn't change mid-session.
  const [shareSupported] = useState(canShareFiles)

  async function buildPdfBlob(): Promise<Blob> {
    const { buildPdf } = await import('../lib/pdf/buildPdf')
    return buildPdf(pages)
  }

  async function buildImageDeliverable(): Promise<{ blob: Blob; filename: string }> {
    const ext = format === 'jpeg' ? 'jpg' : 'png'

    if (pages.length === 1) {
      // Single page: skip the zip entirely for a plain one-click transfer.
      const { toImageBlob } = await import('../lib/export/buildImageZip')
      const blob = await toImageBlob(pages[0], format)
      return { blob, filename: `scan.${ext}` }
    }

    const { buildImageZip } = await import('../lib/export/buildImageZip')
    const blob = await buildImageZip(pages, format)
    return { blob, filename: 'scan-pages.zip' }
  }

  async function handleDownloadPdf() {
    setError(null)
    setBusy('pdf')
    try {
      const [blob, { saveAs }] = await Promise.all([buildPdfBlob(), import('file-saver')])
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
      const [{ blob, filename }, { saveAs }] = await Promise.all([buildImageDeliverable(), import('file-saver')])
      saveAs(blob, filename)
    } catch (err) {
      console.error(err)
      setError('이미지 생성 중 오류가 발생했습니다.')
    } finally {
      setBusy(null)
    }
  }

  // Handing the file to the OS share sheet (AirDrop, Nearby Share, Save to
  // Files, or whatever cloud/messaging app is installed) is the practical
  // way to move a file from a phone browser tab to another device without
  // running a backend — a plain download alone just lands in the phone's
  // local Downloads/Files storage.
  async function handleSharePdf() {
    setError(null)
    setBusy('share-pdf')
    try {
      const blob = await buildPdfBlob()
      const file = new File([blob], 'scan.pdf', { type: 'application/pdf' })
      const result = await shareFiles([file], { title: 'scan.pdf' })
      if (result === 'unsupported') setError('이 브라우저는 공유하기를 지원하지 않습니다. 다운로드를 이용해주세요.')
    } catch (err) {
      console.error(err)
      setError('공유 중 오류가 발생했습니다.')
    } finally {
      setBusy(null)
    }
  }

  async function handleShareImages() {
    setError(null)
    setBusy('share-images')
    try {
      const { blob, filename } = await buildImageDeliverable()
      const file = new File([blob], filename, { type: blob.type })
      const result = await shareFiles([file], { title: filename })
      if (result === 'unsupported') setError('이 브라우저는 공유하기를 지원하지 않습니다. 다운로드를 이용해주세요.')
    } catch (err) {
      console.error(err)
      setError('공유 중 오류가 발생했습니다.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen export-screen">
      <p className="page-count">{pages.length}장 내보내기</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="export-action-row">
        <button
          type="button"
          className="primary-button"
          disabled={busy !== null}
          onClick={handleDownloadPdf}
        >
          {busy === 'pdf' ? 'PDF 생성 중…' : 'PDF로 다운로드'}
        </button>
        {shareSupported && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy !== null}
            onClick={handleSharePdf}
          >
            {busy === 'share-pdf' ? '공유 준비 중…' : 'PDF 공유하기'}
          </button>
        )}
      </div>

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

      <div className="export-action-row">
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
        {shareSupported && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy !== null}
            onClick={handleShareImages}
          >
            {busy === 'share-images' ? '공유 준비 중…' : '이미지 공유하기'}
          </button>
        )}
      </div>

      <button type="button" className="secondary-button" onClick={onBack}>
        뒤로
      </button>
    </div>
  )
}
