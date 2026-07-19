interface ProcessingOverlayProps {
  message: string
}

export function ProcessingOverlay({ message }: ProcessingOverlayProps) {
  return (
    <div className="processing-overlay">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
