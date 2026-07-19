import type { Page } from '../../types/page'
import { canvasToBlob, downscaleCanvas, loadImage } from './canvasUtils'

const THUMBNAIL_MAX_DIMENSION = 320

/**
 * Fallback escape hatch: replaces a page's active image with its untouched
 * original photo (no crop, no scan enhancement) — for cases where automatic
 * document-boundary detection got it wrong.
 */
export async function buildPageFromOriginal(page: Page): Promise<Page> {
  const img = await loadImage(page.originalImageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0)

  const thumbCanvas = downscaleCanvas(canvas, THUMBNAIL_MAX_DIMENSION)
  const thumbnailBlob = await canvasToBlob(thumbCanvas)

  // Old thumbnailUrl/fullImageUrl cleanup is handled by usePages().replacePage,
  // which knows whether a URL is still referenced by the replacement page.
  return {
    ...page,
    thumbnailUrl: URL.createObjectURL(thumbnailBlob),
    fullImageUrl: page.originalImageUrl,
    fullImageBlob: page.originalImageBlob,
    width: canvas.width,
    height: canvas.height,
    boundaryConfidence: 'fallback',
  }
}
