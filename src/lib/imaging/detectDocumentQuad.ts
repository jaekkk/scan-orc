import type { Point, Quad } from './geometry'
import { polygonArea } from './geometry'
import { boxBlur, otsuThreshold, toGrayscale } from './otsu'
import { convexHull } from './convexHull'
import { reduceToQuad } from './reduceToQuad'
import { largestComponent } from './connectedComponents'
import { flattenIllumination } from './illumination'
import { extractChannel } from './channels'
import { openMask } from './morphology'
import type { RawImage } from './rawImage'

const BLUE_CHANNEL = 2

const MIN_AREA_RATIO = 0.2
const BLUR_RADIUS = 2
// Severs thin bridges (glare or a shadow gradient locally blending the
// document into an adjacent background patch, usually near one corner)
// before flood-filling for the largest blob — otherwise that bridge lets
// the background patch's own extent get folded into the document's hull,
// dragging just that one corner out past the document's real edge.
const OPEN_RADIUS = 1
// If a whole SIDE of the detected quad runs flush along a frame border, that
// side is almost certainly the background's own edge (the background sits
// against the frame border everywhere it isn't blocked by the document) —
// not a real document edge. A real document's physical edge, even one
// that happens to pass near the frame border at an isolated point, is
// essentially never exactly parallel to and coincident with the sensor
// edge for an entire side in a handheld photo.
const EDGE_TOUCH_MARGIN_RATIO = 0.01

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

function buildMask(gray: Uint8ClampedArray, threshold: number, brighterIsForeground: boolean): Uint8Array {
  const mask = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    mask[i] = (brighterIsForeground ? gray[i] > threshold : gray[i] <= threshold) ? 1 : 0
  }
  return mask
}

/** True if any full side of the quad runs flush along a frame border — the signature of a background silhouette (which sits against the border everywhere the document doesn't block it), not a real document edge. */
function hasSideFlushWithBorder(quad: Quad, width: number, height: number): boolean {
  const marginX = Math.max(1, width * EDGE_TOUCH_MARGIN_RATIO)
  const marginY = Math.max(1, height * EDGE_TOUCH_MARGIN_RATIO)

  for (let i = 0; i < quad.length; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % quad.length]
    const bothAtLeft = a.x <= marginX && b.x <= marginX
    const bothAtRight = a.x >= width - 1 - marginX && b.x >= width - 1 - marginX
    const bothAtTop = a.y <= marginY && b.y <= marginY
    const bothAtBottom = a.y >= height - 1 - marginY && b.y >= height - 1 - marginY
    if (bothAtLeft || bothAtRight || bothAtTop || bothAtBottom) return true
  }

  return false
}

/** Isolates the largest connected blob in `mask`, then reduces its silhouette to a quad — or null if it's too small or (being background bleeding to every edge) actually the frame around the document. */
function candidateQuad(mask: Uint8Array, width: number, height: number): Quad | null {
  const opened = openMask(mask, width, height, OPEN_RADIUS)
  const component = largestComponent(opened, width, height)
  if (!component) return null

  const imageArea = width * height
  if (component.area < imageArea * MIN_AREA_RATIO) return null

  const candidates = extractMaskExtrema(component.mask, width, height)
  if (candidates.length < 4) return null

  const hull = convexHull(candidates)
  // Fewer than 4 hull vertices means there's no real quadrilateral silhouette
  // to work with; padding by duplicating a point here would hand
  // computeHomography two coincident correspondences and blow up as a
  // singular matrix downstream, so bail to the safe inset-crop fallback instead.
  if (hull.length < 4) return null

  const quad = reduceToQuad(hull)
  const area = polygonArea(quad)
  if (area < imageArea * MIN_AREA_RATIO) return null
  if (hasSideFlushWithBorder(quad, width, height)) return null

  return quad
}

/**
 * Otsu-thresholds `gray`, tries both polarities (document brighter than its
 * surroundings — typical white paper — or darker, e.g. a dark cover on a
 * light desk), and returns whichever side yields a larger valid quad. The
 * background, being on every side of the document, almost always forms the
 * single biggest connected blob for whichever polarity it falls on — sized
 * away by candidateQuad's full-frame check — so the document tends to "win"
 * on the other polarity instead.
 */
function detectFromGray(gray: Uint8ClampedArray, width: number, height: number): Quad | null {
  const threshold = otsuThreshold(gray)

  const brightQuad = candidateQuad(buildMask(gray, threshold, true), width, height)
  const darkQuad = candidateQuad(buildMask(gray, threshold, false), width, height)

  if (brightQuad && darkQuad) {
    return polygonArea(brightQuad) >= polygonArea(darkQuad) ? brightQuad : darkQuad
  }
  return brightQuad ?? darkQuad
}

/**
 * Detects the document boundary in a (typically downscaled-for-speed) image:
 * grayscale -> blur -> Otsu threshold -> largest connected foreground blob
 * (rejects noise/reflections elsewhere in frame) -> row/column extrema as
 * hull candidates -> convex hull -> reduce to 4 corners. Returns null (not a
 * hard failure) if no confident quad is found, so the caller can fall back
 * to a default inset crop.
 *
 * Three passes, each only tried if the previous one found nothing:
 * 1. Standard luma — works whenever the document and its surroundings
 *    actually differ in brightness.
 * 2. Luma with large-scale lighting gradients (shadows) flattened out first.
 * 3. Blue channel alone — a white/neutral document can sit at nearly the
 *    same luma as a warm-toned surroundings (tan leather, wood, skin) while
 *    still differing sharply in blue (warm colors are blue-deficient), so
 *    this catches document/background pairs luma can't separate at all.
 */
export function detectDocumentQuad(imageData: RawImage): Quad | null {
  const { width, height, data } = imageData
  const gray = toGrayscale(data, width, height)
  const blurred = boxBlur(gray, width, height, BLUR_RADIUS)
  const blueChannel = boxBlur(extractChannel(data, width, height, BLUE_CHANNEL), width, height, BLUR_RADIUS)

  return (
    detectFromGray(blurred, width, height) ??
    detectFromGray(flattenIllumination(blurred, width, height), width, height) ??
    detectFromGray(blueChannel, width, height)
  )
}
