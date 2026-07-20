import type { RawImage } from './rawImage'
import { boxBlur } from './otsu'
import { extractChannel } from './channels'

// Per-channel highlight percentile treated as "paper white" — forcing it to
// true neutral 255 is what makes the same document scan the same color
// whether the room light is warm, cool, or dim, instead of inheriting the
// ambient light's color cast.
const WHITE_POINT_PERCENTILE = 0.98
// Safety floor: guards the mirror-image failure to MAX_BLACK_POINT above —
// without it, an image with very little genuinely bright content could let
// the percentile scan land on some small stray highlight, producing a huge
// 255/whitePoint scale factor that blows the whole channel out.
const MIN_WHITE_POINT = 150
// Luminance (not per-channel) percentile treated as "ink black" — stretched
// uniformly across all 3 channels so it brightens/adds contrast without
// re-introducing any color tint.
const BLACK_POINT_PERCENTILE = 0.005
// Safety cap: a real page's ink/shadow coverage can be thinner than
// BLACK_POINT_PERCENTILE (e.g. a mostly-blank page), which would make the
// percentile scan skip straight past the sparse dark pixels and land back
// on the paper's own luma — collapsing the whole page toward black instead
// of leaving it white. Refusing to treat anything above this as "black"
// keeps that failure bounded no matter how little dark content there is.
const MAX_BLACK_POINT = 100
const EXPOSURE_ALPHA = 1.12
const EXPOSURE_BETA = 18
const SHARPEN_RADIUS = 1
const SHARPEN_AMOUNT = 0.6

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function percentileValue(histogram: number[], totalPixels: number, percentile: number): number {
  const target = totalPixels * percentile
  let cumulative = 0
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v]
    if (cumulative >= target) return v
  }
  return 255
}

/** Scales each channel independently so its own highlight percentile lands on 255 — neutralizes whatever color cast the ambient light put on the page, so "paper white" comes out the same regardless of lighting. */
function whiteBalance(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  const totalPixels = width * height

  for (let channel = 0; channel < 3; channel++) {
    const histogram = new Array(256).fill(0)
    for (let i = channel; i < data.length; i += 4) histogram[data[i]]++

    const whitePoint = Math.max(MIN_WHITE_POINT, percentileValue(histogram, totalPixels, WHITE_POINT_PERCENTILE))
    const scale = 255 / whitePoint
    for (let i = channel; i < data.length; i += 4) {
      out[i] = clamp(data[i] * scale, 0, 255)
    }
  }

  return out
}

/** Stretches the black point using overall luminance (the same factor applied to every channel), so shadows/ink deepen and midtones brighten without disturbing the white balance just established. */
function stretchBlackPoint(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  const totalPixels = width * height

  const lumaHistogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    lumaHistogram[luma]++
  }
  const black = Math.min(percentileValue(lumaHistogram, totalPixels, BLACK_POINT_PERCENTILE), MAX_BLACK_POINT)
  const range = Math.max(1, 255 - black)

  for (let i = 0; i < data.length; i += 4) {
    out[i] = clamp(((data[i] - black) / range) * 255, 0, 255)
    out[i + 1] = clamp(((data[i + 1] - black) / range) * 255, 0, 255)
    out[i + 2] = clamp(((data[i + 2] - black) / range) * 255, 0, 255)
  }

  return out
}

/** Unsharp mask (orig + (orig - blurred) * amount) per channel: counteracts the softness bilinear warp sampling introduces, which otherwise reads as "blurry". */
function sharpen(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  for (let channel = 0; channel < 3; channel++) {
    const plane = extractChannel(data, width, height, channel)
    const blurred = boxBlur(plane, width, height, SHARPEN_RADIUS)
    for (let i = channel, p = 0; p < plane.length; i += 4, p++) {
      out[i] = clamp(plane[p] + (plane[p] - blurred[p]) * SHARPEN_AMOUNT, 0, 255)
    }
  }
  return out
}

/**
 * Scan-look pipeline: white-balance (neutralizes ambient color cast so the
 * page reads the same regardless of lighting) -> black-point contrast
 * stretch (uniform across channels, so it doesn't re-tint) -> unsharp mask
 * (fixes warp-induced softness) -> an exposure push for extra brightness.
 */
export function applyScanEffect(image: RawImage): RawImage {
  const { width, height } = image

  let out = whiteBalance(image.data, width, height)
  out = stretchBlackPoint(out, width, height)
  out = sharpen(out, width, height)

  for (let i = 0; i < out.length; i += 4) {
    out[i] = clamp(out[i] * EXPOSURE_ALPHA + EXPOSURE_BETA, 0, 255)
    out[i + 1] = clamp(out[i + 1] * EXPOSURE_ALPHA + EXPOSURE_BETA, 0, 255)
    out[i + 2] = clamp(out[i + 2] * EXPOSURE_ALPHA + EXPOSURE_BETA, 0, 255)
  }

  return { data: out, width, height }
}
