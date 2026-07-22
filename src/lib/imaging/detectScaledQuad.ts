import { detectDocumentQuad } from './detectDocumentQuad'
import { scaleQuad, type Quad } from './geometry'
import type { RawImage } from './rawImage'

/**
 * Runs detection on a (typically downscaled) image and scales the result
 * back up by `scale` — shared by the capture pipeline and the live-preview
 * detection loop, both of which detect on a small downscaled frame and need
 * the quad mapped back to a larger coordinate space. Swallows detection
 * errors (returns null) so callers can treat "no quad" as just another
 * valid outcome rather than a failure to handle separately.
 */
export function detectScaledQuad(detectionImage: RawImage, scale: number): Quad | null {
  try {
    const detected = detectDocumentQuad(detectionImage)
    return detected ? scaleQuad(detected, scale) : null
  } catch (err) {
    console.error('문서 감지 실패:', err)
    return null
  }
}
