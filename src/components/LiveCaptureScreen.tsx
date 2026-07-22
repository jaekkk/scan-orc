import { useEffect, useRef, useState } from 'react'
import type { Quad } from '../lib/imaging/geometry'
import { detectScaledQuad } from '../lib/imaging/detectScaledQuad'
import { drawVideoFrameToCanvas, canvasToBlob } from '../lib/pipeline/canvasUtils'
import { getImageData, MAX_DIMENSION, DETECTION_MAX_DIMENSION } from '../lib/pipeline/processImageFile'

const DETECTION_INTERVAL_MS = 350

interface LiveCaptureScreenProps {
  onCapture: (file: File) => void
  onCancel: () => void
  /** Escape hatch when the camera stream itself can't be used (permission denied, unsupported) — falls back to the OS-level camera picker. */
  onUseFilePicker: () => void
}

type Status = 'starting' | 'streaming' | 'error'

function quadToPoints(quad: Quad): string {
  return quad.map((p) => `${p.x},${p.y}`).join(' ')
}

export function LiveCaptureScreen({ onCapture, onCancel, onUseFilePicker }: LiveCaptureScreenProps) {
  const [status, setStatus] = useState<Status>('starting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [quad, setQuad] = useState<Quad | null>(null)
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null)
  const [capturing, setCapturing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setStatus('error')
        setErrorMessage('이 브라우저는 실시간 카메라 미리보기를 지원하지 않습니다.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setVideoSize({ width: video.videoWidth, height: video.videoHeight })
        setStatus('streaming')
      } catch (err) {
        console.error(err)
        if (cancelled) return
        setStatus('error')
        setErrorMessage('카메라를 사용할 수 없습니다. 권한을 확인해주세요.')
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'streaming') return

    function tick() {
      const video = videoRef.current
      if (!video || video.readyState < 2 || busyRef.current) return
      busyRef.current = true
      try {
        // Some mobile browsers keep adjusting videoWidth/videoHeight for a
        // moment after play() resolves (or renegotiate resolution later).
        // Re-sync on every tick so the SVG overlay's viewBox — which maps
        // detected coordinates back onto the displayed video — never drifts
        // out of sync with the frame actually being detected on, which
        // would otherwise show up as the boundary box misaligned from the
        // real video content along whichever axis changed.
        setVideoSize((prev) =>
          prev && prev.width === video.videoWidth && prev.height === video.videoHeight
            ? prev
            : { width: video.videoWidth, height: video.videoHeight },
        )

        const canvas = drawVideoFrameToCanvas(video, DETECTION_MAX_DIMENSION)
        const scale = video.videoWidth / canvas.width
        const detectionImage = getImageData(canvas)
        setQuad(detectScaledQuad(detectionImage, scale))
      } finally {
        busyRef.current = false
      }
    }

    const intervalId = window.setInterval(tick, DETECTION_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [status])

  async function handleCapture() {
    const video = videoRef.current
    if (!video || capturing) return
    setCapturing(true)
    try {
      const canvas = drawVideoFrameToCanvas(video, MAX_DIMENSION)
      const blob = await canvasToBlob(canvas)
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      onCapture(file)
    } catch (err) {
      console.error(err)
      setErrorMessage('촬영 중 오류가 발생했습니다.')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="live-capture-screen">
      <video ref={videoRef} className="live-capture-video" playsInline muted />

      {videoSize && (
        <svg className="live-capture-overlay" viewBox={`0 0 ${videoSize.width} ${videoSize.height}`}>
          {quad && <polygon className="live-capture-quad" points={quadToPoints(quad)} />}
        </svg>
      )}

      {status === 'streaming' && (
        <p className="live-capture-hint">{quad ? '문서를 인식했습니다' : '문서를 화면 안에 맞춰주세요'}</p>
      )}

      {status === 'starting' && <p className="live-capture-hint">카메라를 여는 중…</p>}

      {status === 'error' && (
        <div className="live-capture-error">
          <p>{errorMessage}</p>
          <button type="button" className="secondary-button" onClick={onUseFilePicker}>
            카메라 앱으로 촬영
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            취소
          </button>
        </div>
      )}

      {status === 'streaming' && (
        <div className="live-capture-controls">
          <button type="button" className="live-capture-cancel" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="live-capture-shutter"
            aria-label="촬영"
            disabled={capturing}
            onClick={handleCapture}
          />
        </div>
      )}
    </div>
  )
}
