import { describe, expect, it } from 'vitest'
import { detectDocumentQuad } from './detectDocumentQuad'
import { polygonArea, type Point } from './geometry'
import type { RawImage } from './rawImage'

/** Builds a synthetic photo: dark background with a white rectangle "document". */
function makeSyntheticPhoto(
  width: number,
  height: number,
  rect: { x0: number; y0: number; x1: number; y1: number },
): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1
      const v = inside ? 250 : 40
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

/** Builds a synthetic photo with a bright triangular (3-vertex) region — a degenerate silhouette a real photo could produce. */
function makeTrianglePhoto(width: number, height: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  const apex = { x: width / 2, y: height * 0.15 }
  const baseLeft = { x: width * 0.15, y: height * 0.85 }
  const baseRight = { x: width * 0.85, y: height * 0.85 }

  function sign(p1: Point, p2: Point, p3: Point) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  }
  function inTriangle(p: Point) {
    const d1 = sign(p, apex, baseLeft)
    const d2 = sign(p, baseLeft, baseRight)
    const d3 = sign(p, baseRight, apex)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = inTriangle({ x, y }) ? 250 : 40
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

describe('detectDocumentQuad', () => {
  it('detects a clean axis-aligned rectangle on a dark background', () => {
    const img = makeSyntheticPhoto(200, 150, { x0: 40, y0: 30, x1: 160, y1: 120 })
    const quad = detectDocumentQuad(img)
    expect(quad).not.toBeNull()
    if (!quad) return

    const detectedArea = polygonArea(quad)
    const expectedArea = (160 - 40) * (120 - 30)
    expect(detectedArea).toBeGreaterThan(expectedArea * 0.85)
    expect(detectedArea).toBeLessThan(expectedArea * 1.15)
  })

  it('returns null when there is no document (uniform image)', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(128)
    for (let i = 3; i < data.length; i += 4) data[i] = 255 // alpha
    const img: RawImage = { width: 100, height: 100, data }
    expect(detectDocumentQuad(img)).toBeNull()
  })

  it('returns null when the bright region is too small to be the document', () => {
    const img = makeSyntheticPhoto(200, 200, { x0: 90, y0: 90, x1: 110, y1: 110 })
    expect(detectDocumentQuad(img)).toBeNull()
  })

  it('produces a non-degenerate 4-point quad (not a duplicated-point one) for a triangular region', () => {
    // Regression coverage: a hull with fewer than 4 vertices used to get
    // padded into a quad with a duplicated point, which made the
    // perspective-transform solve blow up as a singular matrix downstream.
    // extractMaskExtrema's row/column sampling in practice still finds 4
    // distinct corner-ish points even for a triangle (discretization splits
    // the apex row into two close points) — assert that stays true and no
    // two corners coincide.
    const img = makeTrianglePhoto(200, 200)
    const quad = detectDocumentQuad(img)
    expect(quad).not.toBeNull()
    if (!quad) return

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const dx = quad[i].x - quad[j].x
        const dy = quad[i].y - quad[j].y
        expect(Math.hypot(dx, dy)).toBeGreaterThan(0)
      }
    }
  })
})
