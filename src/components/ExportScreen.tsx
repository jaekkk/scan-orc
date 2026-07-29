import { useState } from 'react'
import type { Page } from '../types/page'
import type { ImageFormat } from '../lib/export/buildImageZip'
import { canShareFiles, shareFiles } from '../lib/export/shareFiles'
import { resolveFilenameBase, todayAsFilenameBase, withIndexSuffix } from '../lib/export/filename'

interface ExportScreenProps {
  pages: Page[]
  onBack: () => void
}

type Busy = 'pdf' | 'images' | 'share-pdf' | 'share-images' | null
type ImageBundleMode = 'zip' | 'individual'

/** Delay between successive saveAs() calls when downloading multiple individual files — back-to-back downloads with no gap get throttled or silently dropped by some browsers. */
const MULTI_DOWNLOAD_DELAY_MS = 300

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ExportScreen({ pages, onBack }: ExportScreenProps) {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<ImageFormat>('jpeg')
  const [name, setName] = useState('')
  const [bundleMode, setBundleMode] = useState<ImageBundleMode>('zip')
  // Feature-detected once, not re-checked per render — Web Share support
  // doesn't change mid-session.
  const [shareSupported] = useState(canShareFiles)

  async function buildPdfBlob(): Promise<Blob> {
    const { buildPdf } = await import('../lib/pdf/buildPdf')
    return buildPdf(pages)
  }

  /**
   * Builds the image deliverable(s) for the current format/name/bundle
   * settings. A single page always produces one plain image file. Multiple
   * pages produce either one zip, or one file per page individually named
   * with a `-01`, `-02`, … suffix so they stay distinguishable once shared
   * or downloaded loose.
   */
  async function buildImageDeliverables(): Promise<{ blob: Blob; filename: string }[]> {
    const ext = format === 'jpeg' ? 'jpg' : 'png'
    const base = resolveFilenameBase(name)

    if (pages.length === 1) {
      const { toImageBlob } = await import('../lib/export/buildImageZip')
      const blob = await toImageBlob(pages[0], format)
      return [{ blob, filename: `${base}.${ext}` }]
    }

    if (bundleMode === 'zip') {
      const { buildImageZip } = await import('../lib/export/buildImageZip')
      const blob = await buildImageZip(pages, format)
      return [{ blob, filename: `${base}.zip` }]
    }

    const { toImageBlob } = await import('../lib/export/buildImageZip')
    const blobs = await Promise.all(pages.map((p) => toImageBlob(p, format)))
    return blobs.map((blob, i) => ({
      blob,
      filename: `${withIndexSuffix(base, i + 1, pages.length)}.${ext}`,
    }))
  }

  async function handleDownloadPdf() {
    setError(null)
    setBusy('pdf')
    try {
      const [blob, { saveAs }] = await Promise.all([buildPdfBlob(), import('file-saver')])
      saveAs(blob, `${resolveFilenameBase(name)}.pdf`)
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
      const [deliverables, { saveAs }] = await Promise.all([buildImageDeliverables(), import('file-saver')])
      for (let i = 0; i < deliverables.length; i++) {
        if (i > 0) await delay(MULTI_DOWNLOAD_DELAY_MS)
        saveAs(deliverables[i].blob, deliverables[i].filename)
      }
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
      const filename = `${resolveFilenameBase(name)}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })
      const result = await shareFiles([file], { title: filename })
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
      const deliverables = await buildImageDeliverables()
      const files = deliverables.map((d) => new File([d.blob], d.filename, { type: d.blob.type }))
      const title = deliverables.length === 1 ? deliverables[0].filename : resolveFilenameBase(name)
      const result = await shareFiles(files, { title })
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

      <label className="export-name-field">
        파일 이름
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={todayAsFilenameBase()}
          maxLength={80}
        />
      </label>

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

      {pages.length > 1 && (
        <div className="format-toggle" role="radiogroup" aria-label="여러 장 묶음 방식">
          <label>
            <input
              type="radio"
              name="bundle-mode"
              checked={bundleMode === 'zip'}
              onChange={() => setBundleMode('zip')}
            />
            압축(zip)
          </label>
          <label>
            <input
              type="radio"
              name="bundle-mode"
              checked={bundleMode === 'individual'}
              onChange={() => setBundleMode('individual')}
            />
            개별 파일
          </label>
        </div>
      )}

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
              ? bundleMode === 'zip'
                ? '이미지로 다운로드 (zip)'
                : `이미지로 다운로드 (${pages.length}개 파일)`
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
