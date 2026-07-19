import type { Page } from '../types/page'

interface PagePreviewModalProps {
  page: Page
  pageIndex: number
  onClose: () => void
  onRetake: (page: Page) => void
  onUseOriginal: (page: Page) => void
}

export function PagePreviewModal({ page, pageIndex, onClose, onRetake, onUseOriginal }: PagePreviewModalProps) {
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
