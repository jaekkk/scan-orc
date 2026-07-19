import { jsPDF } from 'jspdf'
import type { Page } from '../../types/page'
import { loadImage } from '../pipeline/canvasUtils'

/**
 * Builds a multi-page PDF, one image per page, each page sized to that
 * photo's own aspect ratio (rather than forcing every page onto A4/Letter),
 * so the PDF stays faithful to the actual scanned document proportions.
 */
export async function buildPdf(pages: Page[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('내보낼 페이지가 없습니다.')

  const images = await Promise.all(pages.map((p) => loadImage(p.fullImageUrl)))

  const first = images[0]
  const doc = new jsPDF({
    unit: 'px',
    format: [first.naturalWidth, first.naturalHeight],
    orientation: first.naturalWidth >= first.naturalHeight ? 'landscape' : 'portrait',
    compress: true,
  })

  images.forEach((img, index) => {
    const { naturalWidth: width, naturalHeight: height } = img
    if (index > 0) {
      doc.addPage([width, height], width >= height ? 'landscape' : 'portrait')
    }
    doc.addImage(img, 'JPEG', 0, 0, width, height)
  })

  return doc.output('blob')
}
