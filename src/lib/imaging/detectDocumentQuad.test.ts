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

  it('rejects a candidate whose hull has a full side flush with a frame border, even if it only touches 1-3 borders overall', () => {
    // Regression coverage: a bright blob shaped like a trapezoid whose top
    // edge runs the full width of the frame (flush with y=0) but which
    // narrows well before reaching the other 3 borders. This is the
    // signature of background bleeding to the top of frame, not a document
    // — but it only touches 1 border overall, so a check that only rejects
    // hulls touching all 4 borders (or a bounding box near the full frame
    // area) misses it and returns a bogus quad with two corners pinned to
    // the top-left/top-right of the frame.
    const width = 200
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4).fill(0)
    for (let i = 3; i < data.length; i += 4) data[i] = 255 // alpha
    for (let y = 0; y < 150; y++) {
      const halfWidth = 90 - (y / 150) * 70 // 90 at y=0 down to 20 at y=150
      const x0 = Math.round(100 - halfWidth)
      const x1 = Math.round(100 + halfWidth)
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4
        data[i] = 220
        data[i + 1] = 220
        data[i + 2] = 220
      }
    }

    const quad = detectDocumentQuad({ width, height, data })
    expect(quad).toBeNull()
  })

  it('detects a white document against a warm-toned (e.g. leather/wood) background matched to nearly the same luma', () => {
    // Regression coverage for a real failure: a white notebook page on a
    // tan leather portfolio cover, where the leather is warm enough to sit
    // at essentially the same perceived brightness as the paper — plain
    // grayscale thresholding sees ~96% of the frame as one undifferentiated
    // "bright" blob and finds nothing. The blue channel still separates them
    // cleanly, since warm colors are blue-deficient relative to white.
    const width = 200
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4)
    const rect = { x0: 40, y0: 30, x1: 160, y1: 170 }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inside = x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1
        const i = (y * width + x) * 4
        if (inside) {
          data[i] = 200
          data[i + 1] = 200
          data[i + 2] = 200 // neutral white paper
        } else {
          data[i] = 228
          data[i + 1] = 201
          data[i + 2] = 124 // warm tan leather — same luma (~200), far lower blue
        }
        data[i + 3] = 255
      }
    }

    const quad = detectDocumentQuad({ width, height, data })
    expect(quad).not.toBeNull()
    if (!quad) return

    const detectedArea = polygonArea(quad)
    const expectedArea = (rect.x1 - rect.x0) * (rect.y1 - rect.y0)
    expect(detectedArea).toBeGreaterThan(expectedArea * 0.8)
    expect(detectedArea).toBeLessThan(expectedArea * 1.2)
  })

  it('still detects a document shot to fill most of the frame, as long as some margin remains on every side', () => {
    // A common real-world shooting style: fill the frame for max resolution.
    // Only a few px of margin on each side — must not get rejected as "this
    // is just the background".
    const img = makeSyntheticPhoto(200, 150, { x0: 4, y0: 3, x1: 196, y1: 147 })
    const quad = detectDocumentQuad(img)
    expect(quad).not.toBeNull()
    if (!quad) return

    const detectedArea = polygonArea(quad)
    const expectedArea = (196 - 4) * (147 - 3)
    expect(detectedArea).toBeGreaterThan(expectedArea * 0.85)
  })

  it('detects a dark document on a light background (not just the reverse)', () => {
    const data = new Uint8ClampedArray(200 * 150 * 4)
    for (let y = 0; y < 150; y++) {
      for (let x = 0; x < 200; x++) {
        const inside = x >= 40 && x < 160 && y >= 30 && y < 120
        const v = inside ? 40 : 220 // dark document, bright surrounding desk
        const i = (y * 200 + x) * 4
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const quad = detectDocumentQuad({ width: 200, height: 150, data })
    expect(quad).not.toBeNull()
    if (!quad) return

    const detectedArea = polygonArea(quad)
    const expectedArea = (160 - 40) * (120 - 30)
    expect(detectedArea).toBeGreaterThan(expectedArea * 0.85)
    expect(detectedArea).toBeLessThan(expectedArea * 1.15)
  })

  it('ignores a small bright reflection elsewhere in frame instead of letting it distort the quad', () => {
    const img = makeSyntheticPhoto(200, 150, { x0: 40, y0: 30, x1: 160, y1: 120 })
    // A stray bright speck far outside the document — e.g. a reflection or
    // light source — that used to get folded into the hull as if it were a
    // document corner.
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = (y * 200 + x) * 4
        img.data[i] = 250
        img.data[i + 1] = 250
        img.data[i + 2] = 250
      }
    }

    const quad = detectDocumentQuad(img)
    expect(quad).not.toBeNull()
    if (!quad) return

    const detectedArea = polygonArea(quad)
    const expectedArea = (160 - 40) * (120 - 30)
    expect(detectedArea).toBeGreaterThan(expectedArea * 0.85)
    expect(detectedArea).toBeLessThan(expectedArea * 1.15)
  })

  it('does not let a thin glare bridge at one corner drag that corner out into the background', () => {
    // Regression coverage for a real report: the green boundary overshot
    // past the document's real edge at exactly one corner. Root cause: a
    // narrow (1-2px) bright bridge — e.g. glare or a shadow gradient locally
    // matching the document's brightness — connects the document blob to
    // the background right at that corner. Since it's 4-connected to the
    // document, the flood fill folds it into the same component, and the
    // hull follows the bridge out past the true corner. A thin bridge
    // should get severed by the mask-opening step before it can do that.
    const width = 200
    const height = 200
    const rect = { x0: 40, y0: 30, x1: 160, y1: 120 }
    const img = makeSyntheticPhoto(width, height, rect)

    // A 1px-wide diagonal bridge running from the document's top-left
    // corner further up and to the left into the background, simulating a
    // glare streak that locally bridges document and background brightness.
    for (let t = 1; t <= 25; t++) {
      const x = rect.x0 - t
      const y = rect.y0 - t
      if (x < 0 || y < 0) break
      const i = (y * width + x) * 4
      img.data[i] = 250
      img.data[i + 1] = 250
      img.data[i + 2] = 250
    }

    const quad = detectDocumentQuad(img)
    expect(quad).not.toBeNull()
    if (!quad) return

    // The corner closest to the true top-left (40, 30) should stay near it,
    // not get dragged out toward the bridge's far end (~15, 5).
    let bestDist = Infinity
    for (const p of quad) {
      bestDist = Math.min(bestDist, Math.hypot(p.x - rect.x0, p.y - rect.y0))
    }
    expect(bestDist).toBeLessThan(10)
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
