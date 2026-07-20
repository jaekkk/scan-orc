import type { Page } from '../../types/page'
import type { Quad } from '../imaging/geometry'
import { loadImage } from './canvasUtils'
import { buildImageAssets, getImageData, warpAndEnhance } from './processImageFile'

/**
 * Re-crops a page from its untouched original photo using a user-adjusted
 * quad (from the manual crop editor), replacing the fallback/mis-detected
 * boundary with one the user confirmed by hand.
 */
export async function applyManualQuad(page: Page, quad: Quad): Promise<Page> {
  const img = await loadImage(page.originalImageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0)

  const sourceImage = getImageData(canvas)
  const enhanced = warpAndEnhance(sourceImage, quad)
  const assets = await buildImageAssets(enhanced)

  return {
    ...page,
    thumbnailUrl: assets.thumbnailUrl,
    fullImageUrl: assets.fullImageUrl,
    fullImageBlob: assets.fullImageBlob,
    width: assets.width,
    height: assets.height,
    boundaryConfidence: 'detected',
    quad,
  }
}
