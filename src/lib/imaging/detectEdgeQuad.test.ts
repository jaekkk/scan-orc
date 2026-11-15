import { describe, expect, it } from 'vitest'
import { detectEdgeQuad } from './detectEdgeQuad'
import { distance, type Point, type Quad } from './geometry'

/** Gray image with `inside` brightness within the convex polygon and `outside` elsewhere. */
function makePolygonGray(width: number, height: number, polygon: Point[], inside: number, outside: number) {
  const gray = new Uint8ClampedArray(width * height).fill(outside)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sign = 0
      let isInside = true
      for (let i = 0; i < polygon.length && isInside; i++) {
        const a = polygon[i]
        const b = polygon[(i + 1) % polygon.length]
        const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
        if (cross !== 0) {
          if (sign === 0) sign = Math.sign(cross)
          else if (Math.sign(cross) !== sign) isInside = false
        }
      }
      if (isInside) gray[y * width + x] = inside
    }
  }
  return gray
}

function maxCornerError(detected: Quad, expected: Quad): number {
  return Math.max(...expected.map((e) => Math.min(...detected.map((d) => distance(d, e)))))
}

describe('detectEdgeQuad', () => {
  it('finds the corners of an axis-aligned rectangle', () => {
    const expected: Quad = [
      { x: 40, y: 30 },
      { x: 160, y: 30 },
      { x: 160, y: 120 },
      { x: 40, y: 120 },
    ]
    const result = detectEdgeQuad(makePolygonGray(200, 150, expected, 200, 60), 200, 150)
    expect(result).not.toBeNull()
    expect(maxCornerError(result!.quad, expected)).toBeLessThan(4)
    expect(result!.score).toBeGreaterThan(0.75)
  })

  it('finds a perspective-skewed quad even at low contrast', () => {
    const expected: Quad = [
      { x: 50, y: 25 },
      { x: 170, y: 40 },
      { x: 150, y: 125 },
      { x: 35, y: 110 },
    ]
    const result = detectEdgeQuad(makePolygonGray(200, 150, expected, 150, 120), 200, 150)
    expect(result).not.toBeNull()
    expect(maxCornerError(result!.quad, expected)).toBeLessThan(6)
  })

  it('returns null on a uniform image', () => {
    const gray = new Uint8ClampedArray(200 * 150).fill(128)
    expect(detectEdgeQuad(gray, 200, 150)).toBeNull()
  })

  it('returns null when only a small object is present', () => {
    const small: Quad = [
      { x: 90, y: 65 },
      { x: 110, y: 65 },
      { x: 110, y: 85 },
      { x: 90, y: 85 },
    ]
    expect(detectEdgeQuad(makePolygonGray(200, 150, small, 220, 40), 200, 150)).toBeNull()
  })
})
