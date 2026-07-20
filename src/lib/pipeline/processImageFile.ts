import type { Page, BoundaryConfidence } from '../../types/page'
import { orderPoints, insetQuad, scaleQuad, warpedSize, type Quad } from '../imaging/geometry'
import { detectDocumentQuad } from '../imaging/detectDocumentQuad'
import { warpPerspective } from '../imaging/warpPerspective'
import { applyScanEffect } from '../imaging/scanEffect'
import type { RawImage } from '../imaging/rawImage'
import { canvasToBlob, downscaleCanvas, drawToCanvas } from './canvasUtils'
import { generatePageId } from './randomId'

const MAX_DIMENSION = 2400
const DETECTION_MAX_DIMENSION = 500
const THUMBNAIL_MAX_DIMENSION = 320
const MIN_AREA_RATIO_FOR_FALLBACK_INSET = 0.05

export function getImageData(canvas: HTMLCanvasElement): RawImage {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function rawImageToCanvas(image: RawImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
  return canvas
}

export function warpAndEnhance(sourceImage: RawImage, quad: Quad): RawImage {
  const ordered = orderPoints(quad)
  const { width, height } = warpedSize(ordered)
  const warped = warpPerspective(sourceImage, ordered, width, height)
  return applyScanEffect(warped)
}

/** Renders an enhanced RawImage to its full-size and thumbnail blobs, shared by the initial capture pipeline and the manual crop re-processing path. */
export async function buildImageAssets(enhanced: RawImage) {
  const fullCanvas = rawImageToCanvas(enhanced)
  const thumbCanvas = downscaleCanvas(fullCanvas, THUMBNAIL_MAX_DIMENSION)

  const [fullImageBlob, thumbnailBlob] = await Promise.all([
    canvasToBlob(fullCanvas),
    canvasToBlob(thumbCanvas),
  ])

  return {
    fullImageBlob,
    thumbnailBlob,
    fullImageUrl: URL.createObjectURL(fullImageBlob),
    thumbnailUrl: URL.createObjectURL(thumbnailBlob),
    width: fullCanvas.width,
    height: fullCanvas.height,
  }
}

/** Attempts the detected-quad warp; returns null (rather than throwing) so the caller can fall back to a safe default crop. */
function tryWarpAndEnhance(sourceImage: RawImage, quad: Quad | null): RawImage | null {
  if (!quad) return null
  try {
    return warpAndEnhance(sourceImage, quad)
  } catch (err) {
    console.error('감지된 경계로 보정 실패, 기본 자르기로 대체합니다:', err)
    return null
  }
}

function detectQuadSafely(detectionImage: RawImage, scale: number): Quad | null {
  try {
    const detected = detectDocumentQuad(detectionImage)
    return detected ? scaleQuad(detected, scale) : null
  } catch (err) {
    console.error('문서 감지 실패, 기본 자르기로 대체합니다:', err)
    return null
  }
}

export async function processImageFile(file: File): Promise<Page> {
  // imageOrientation defaults to "none" (ignores EXIF) in some browsers,
  // which would leave phone photos sideways/upside-down — force EXIF-correct
  // orientation explicitly.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const sourceCanvas = drawToCanvas(bitmap, MAX_DIMENSION)
  bitmap.close()

  const originalImageBlob = await canvasToBlob(sourceCanvas)
  const sourceImage = getImageData(sourceCanvas)

  // Detection runs on a small downscaled copy for speed; the resulting quad
  // is scaled back up to the full working resolution before warping.
  const detectionCanvas = downscaleCanvas(sourceCanvas, DETECTION_MAX_DIMENSION)
  const detectionScale = sourceCanvas.width / detectionCanvas.width
  const detectionImage = getImageData(detectionCanvas)
  const detectedQuad = detectQuadSafely(detectionImage, detectionScale)

  let boundaryConfidence: BoundaryConfidence = 'detected'
  let usedQuad = detectedQuad
  let enhanced = tryWarpAndEnhance(sourceImage, detectedQuad)
  if (!enhanced) {
    boundaryConfidence = 'fallback'
    usedQuad = insetQuad(sourceImage.width, sourceImage.height, MIN_AREA_RATIO_FOR_FALLBACK_INSET)
    enhanced = warpAndEnhance(sourceImage, usedQuad)
  }

  const assets = await buildImageAssets(enhanced)

  return {
    id: generatePageId(),
    thumbnailUrl: assets.thumbnailUrl,
    fullImageUrl: assets.fullImageUrl,
    fullImageBlob: assets.fullImageBlob,
    width: assets.width,
    height: assets.height,
    boundaryConfidence,
    createdAt: Date.now(),
    originalImageUrl: URL.createObjectURL(originalImageBlob),
    originalImageBlob,
    quad: usedQuad as Quad,
  }
}
