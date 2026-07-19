import { describe, expect, it } from 'vitest'
import { applyHomography, computeHomography } from './homography'

describe('computeHomography', () => {
  it('produces the identity mapping when src equals dst', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const H = computeHomography(square, square)
    for (const p of square) {
      const mapped = applyHomography(H, p)
      expect(mapped.x).toBeCloseTo(p.x)
      expect(mapped.y).toBeCloseTo(p.y)
    }
    // and an interior point
    const mapped = applyHomography(H, { x: 5, y: 5 })
    expect(mapped.x).toBeCloseTo(5)
    expect(mapped.y).toBeCloseTo(5)
  })

  it('maps a unit rect to a 2x scaled rect correctly (affine case)', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const dst = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ]
    const H = computeHomography(src, dst)
    const mapped = applyHomography(H, { x: 5, y: 5 })
    expect(mapped.x).toBeCloseTo(10)
    expect(mapped.y).toBeCloseTo(10)
  })

  it('correctly maps a rect to a skewed quad (true projective case)', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    // a trapezoid: narrower at the top, simulating perspective foreshortening
    const quad = [
      { x: 20, y: 0 },
      { x: 80, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const H = computeHomography(rect, quad)
    for (let i = 0; i < 4; i++) {
      const mapped = applyHomography(H, rect[i])
      expect(mapped.x).toBeCloseTo(quad[i].x, 5)
      expect(mapped.y).toBeCloseTo(quad[i].y, 5)
    }
  })

  it('throws for a degenerate quad with a duplicated point (documents why callers must never pass one)', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const degenerateQuad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 100 }, // duplicate of the previous point
    ]
    expect(() => computeHomography(rect, degenerateQuad)).toThrow()
  })
})
