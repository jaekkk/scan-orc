import type { Point, Quad } from './geometry'
import { polygonArea } from './geometry'
import { boxBlur, otsuThreshold, toGrayscale } from './otsu'
import { convexHull } from './convexHull'
import { reduceToQuad } from './reduceToQuad'
import type { RawImage } from './rawImage'

const MIN_AREA_RATIO = 0.2
const MAX_FOREGROUND_RATIO = 0.95
const BLUR_RADIUS = 2

/** For each row/column, the extremal (min/max) foreground pixel — a superset of the true silhouette's convex hull vertices, much cheaper than collecting every boundary pixel. */
function extractMaskExtrema(mask: Uint8Array, width: number, height: number): Point[] {
  const points: Point[] = []

  for (let y = 0; y < height; y++) {
    let minX = -1
    let maxX = -1
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      if (mask[rowStart + x]) {
        if (minX === -1) minX = x
        maxX = x
      }
    }
    if (minX !== -1) {
      points.push({ x: minX, y })
      points.push({ x: maxX, y })
    }
  }

  for (let x = 0; x < width; x++) {
    let minY = -1
    let maxY = -1
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) {
        if (minY === -1) minY = y
        maxY = y
      }
    }
    if (minY !== -1) {
      points.push({ x, y: minY })
      points.push({ x, y: maxY })
    }
  }

  return points
}

/**
 * Detects the document boundary in a (typically downscaled-for-speed) image:
 * grayscale -> blur -> Otsu threshold (paper assumed brighter than background)
 * -> row/column extrema as hull candidates -> convex hull -> reduce to 4
 * corners. Returns null (not a hard failure) if no confident quad is found,
 * so the caller can fall back to a default inset crop.
 */
export function detectDocumentQuad(imageData: RawImage): Quad | null {
  const { width, height, data } = imageData
  const gray = toGrayscale(data, width, height)
  const blurred = boxBlur(gray, width, height, BLUR_RADIUS)
  const threshold = otsuThreshold(blurred)

  const mask = new Uint8Array(width * height)
  let foregroundCount = 0
  for (let i = 0; i < blurred.length; i++) {
    mask[i] = blurred[i] > threshold ? 1 : 0
    if (mask[i]) foregroundCount++
  }

  // A degenerate (e.g. uniform/blank) image gives Otsu no real class
  // separation, which otherwise misreads as "the whole frame is the document".
  if (foregroundCount / mask.length > MAX_FOREGROUND_RATIO) return null

  const candidates = extractMaskExtrema(mask, width, height)
  if (candidates.length < 4) return null

  const hull = convexHull(candidates)
  // Fewer than 4 hull vertices means there's no real quadrilateral silhouette
  // to work with; padding by duplicating a point here would hand
  // computeHomography two coincident correspondences and blow up as a
  // singular matrix downstream, so bail to the safe inset-crop fallback instead.
  if (hull.length < 4) return null

  const quad = reduceToQuad(hull)

  const imageArea = width * height
  if (polygonArea(quad) < imageArea * MIN_AREA_RATIO) return null

  return quad
}
