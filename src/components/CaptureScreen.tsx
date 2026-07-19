interface CaptureScreenProps {
  pageCount: number
  onRequestCapture: () => void
  onDone: () => void
}

export function CaptureScreen({ pageCount, onRequestCapture, onDone }: CaptureScreenProps) {
  return (
    <div className="screen capture-screen">
      <button type="button" className="primary-button" onClick={onRequestCapture}>
        {pageCount === 0 ? '문서 촬영' : '페이지 추가 촬영'}
      </button>

      {pageCount > 0 && (
        <>
          <p className="page-count">{pageCount}장 촬영됨</p>
          <button type="button" className="secondary-button" onClick={onDone}>
            완료 — 내보내기로 이동
          </button>
        </>
      )}
    </div>
  )
}
