import JSZip from 'jszip'
import type { Page } from '../../types/page'
import { canvasToBlob, loadImage } from '../pipeline/canvasUtils'

export type ImageFormat = 'jpeg' | 'png'

const MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
}
const EXT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
}

export async function toImageBlob(page: Page, format: ImageFormat): Promise<Blob> {
  // fullImageBlob is already JPEG (from the processing pipeline) — reuse it
  // as-is instead of a wasteful decode/re-encode round trip.
  if (format === 'jpeg') return page.fullImageBlob

  const img = await loadImage(page.fullImageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0)
  return canvasToBlob(canvas, MIME[format], 1)
}

/** Bundles all pages into a single zip, one image file per page. */
export async function buildImageZip(pages: Page[], format: ImageFormat = 'jpeg'): Promise<Blob> {
  const zip = new JSZip()
  const ext = EXT[format]

  const blobs = await Promise.all(pages.map((p) => toImageBlob(p, format)))
  blobs.forEach((blob, index) => {
    zip.file(`page-${index + 1}.${ext}`, blob)
  })

  return zip.generateAsync({ type: 'blob' })
}
