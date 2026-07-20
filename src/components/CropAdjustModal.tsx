import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Page } from '../types/page'
import type { Quad } from '../lib/imaging/geometry'

interface CropAdjustModalProps {
  page: Page
  onCancel: () => void
  onConfirm: (quad: Quad) => void
}

interface NaturalSize {
  width: number
  height: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function quadToPoints(quad: Quad): string {
  return quad.map((p) => `${p.x},${p.y}`).join(' ')
}

const HANDLE_LABELS = ['좌상단', '우상단', '우하단', '좌하단']

export function CropAdjustModal({ page, onCancel, onConfirm }: CropAdjustModalProps) {
  const [quad, setQuad] = useState<Quad>(page.quad)
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  function moveCorner(index: number, clientX: number, clientY: number) {
    const stage = stageRef.current
    if (!stage || !naturalSize) return
    const rect = stage.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const x = clamp(((clientX - rect.left) / rect.width) * naturalSize.width, 0, naturalSize.width)
    const y = clamp(((clientY - rect.top) / rect.height) * naturalSize.height, 0, naturalSize.height)

    setQuad((prev) => {
      const next = [...prev] as Quad
      next[index] = { x, y }
      return next
    })
  }

  function handlePointerDown(index: number) {
    return (e: ReactPointerEvent<SVGCircleElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      moveCorner(index, e.clientX, e.clientY)
    }
  }

  function handlePointerMove(index: number) {
    return (e: ReactPointerEvent<SVGCircleElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        moveCorner(index, e.clientX, e.clientY)
      }
    }
  }

  const handleRadius = naturalSize ? Math.max(naturalSize.width, naturalSize.height) * 0.022 : 0

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>모서리 직접 보정</span>
          <button type="button" aria-label="닫기" onClick={onCancel}>
            ×
          </button>
        </div>

        <p className="crop-editor-hint">모서리 점을 원본 문서의 네 꼭짓점으로 드래그하세요.</p>

        <div className="crop-editor-stage" ref={stageRef}>
          <img
            src={page.originalImageUrl}
            alt="보정할 원본 사진"
            className="crop-editor-image"
            onLoad={(e) => {
              const img = e.currentTarget
              setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
            }}
          />
          {naturalSize && (
            <svg
              className="crop-editor-overlay"
              viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
              preserveAspectRatio="none"
            >
              <polygon className="crop-editor-quad" points={quadToPoints(quad)} />
              {quad.map((point, index) => (
                <circle
                  key={index}
                  className="crop-editor-handle"
                  aria-label={HANDLE_LABELS[index]}
                  cx={point.x}
                  cy={point.y}
                  r={handleRadius}
                  onPointerDown={handlePointerDown(index)}
                  onPointerMove={handlePointerMove(index)}
                />
              ))}
            </svg>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => setQuad(page.quad)}>
            초기화
          </button>
          <button type="button" className="primary-button" onClick={() => onConfirm(quad)}>
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
