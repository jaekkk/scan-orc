import { describe, expect, it } from 'vitest'
import { convexHull } from './convexHull'
import { reduceToQuad } from './reduceToQuad'
import { polygonArea } from './geometry'

describe('convexHull', () => {
  it('excludes interior points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior, should be excluded
    ]
    const hull = convexHull(points)
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 5, y: 5 })
  })

  it('includes all points of a convex shape', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]
    const hull = convexHull(triangle)
    expect(hull).toHaveLength(3)
  })
})

describe('reduceToQuad', () => {
  it('leaves an exact quad unchanged (order may rotate)', () => {
    const quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const reduced = reduceToQuad(quad)
    expect(reduced).toHaveLength(4)
    expect(polygonArea(reduced)).toBeCloseTo(100)
  })

  it('removes the least-significant vertex from a near-quad with one small notch', () => {
    // A square with one extra point that barely nudges one edge outward —
    // that extra point should be the first one removed.
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10.1, y: 5 }, // near-collinear bump on the right edge
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const reduced = reduceToQuad(points)
    expect(reduced).toHaveLength(4)
    expect(reduced).not.toContainEqual({ x: 10.1, y: 5 })
  })

  it('reduces a regular hexagon to a plausible quad covering most of its area', () => {
    const hexagon = [
      { x: 10, y: 0 },
      { x: 20, y: 5 },
      { x: 20, y: 15 },
      { x: 10, y: 20 },
      { x: 0, y: 15 },
      { x: 0, y: 5 },
    ]
    const hexArea = polygonArea(hexagon)
    const reduced = reduceToQuad(hexagon)
    expect(reduced).toHaveLength(4)
    // The greedy reduction should retain a substantial majority of the hexagon's area
    // (a hexagon inscribed by its best-fit quad inherently loses some area at the corners).
    expect(polygonArea(reduced)).toBeGreaterThan(hexArea * 0.6)
  })
})
