import type { Page } from '../types/page'

interface PageThumbnailStripProps {
  pages: Page[]
  onRemove: (id: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
  onOpenPreview: (index: number) => void
}

export function PageThumbnailStrip({ pages, onRemove, onMove, onOpenPreview }: PageThumbnailStripProps) {
  if (pages.length === 0) return null

  return (
    <ul className="page-thumbnail-strip">
      {pages.map((page, index) => (
        <li key={page.id} className="page-thumbnail">
          <button type="button" className="page-thumbnail-image-button" onClick={() => onOpenPreview(index)}>
            <img src={page.thumbnailUrl} alt={`페이지 ${index + 1}`} />
          </button>
          <span className="page-number">{index + 1}</span>
          {page.boundaryConfidence === 'fallback' && (
            <span className="fallback-badge" title="가장자리 감지가 확실하지 않아 기본 여백으로 잘랐습니다">
              확인 필요
            </span>
          )}
          <div className="page-thumbnail-actions">
            <button
              type="button"
              aria-label="앞으로 이동"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="뒤로 이동"
              disabled={index === pages.length - 1}
              onClick={() => onMove(index, index + 1)}
            >
              →
            </button>
            <button type="button" aria-label="삭제" onClick={() => onRemove(page.id)}>
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
