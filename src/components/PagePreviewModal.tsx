import { useState } from 'react'
import type { Page } from '../types/page'
import type { Quad } from '../lib/imaging/geometry'
import { CropAdjustModal } from './CropAdjustModal'

interface PagePreviewModalProps {
  page: Page
  pageIndex: number
  /** Open straight into the crop editor — used when auto-detection failed and the user should fix it immediately. */
  startInCropEditor?: boolean
  onClose: () => void
  onRetake: (page: Page) => void
  onUseOriginal: (page: Page) => void
  onManualCrop: (page: Page, quad: Quad) => void
}

export function PagePreviewModal({
  page,
  pageIndex,
  startInCropEditor = false,
  onClose,
  onRetake,
  onUseOriginal,
  onManualCrop,
}: PagePreviewModalProps) {
  const [adjusting, setAdjusting] = useState(startInCropEditor)

  if (adjusting) {
    return (
      <CropAdjustModal
        page={page}
        onCancel={() => setAdjusting(false)}
        onConfirm={(quad) => {
          setAdjusting(false)
          onManualCrop(page, quad)
        }}
      />
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>페이지 {pageIndex + 1}</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <img className="modal-image" src={page.fullImageUrl} alt={`페이지 ${pageIndex + 1} 미리보기`} />

        {page.boundaryConfidence === 'fallback' && (
          <p className="fallback-notice">
            문서 가장자리를 확실하게 감지하지 못했습니다. 결과가 이상하면 재촬영하거나 원본 사진을 사용해주세요.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => setAdjusting(true)}>
            직접 보정
          </button>
          <button type="button" className="secondary-button" onClick={() => onRetake(page)}>
            재촬영
          </button>
          <button type="button" className="secondary-button" onClick={() => onUseOriginal(page)}>
            원본 사진 사용
          </button>
        </div>
      </div>
    </div>
  )
}
