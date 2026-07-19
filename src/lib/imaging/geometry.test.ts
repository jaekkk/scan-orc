import { describe, expect, it } from 'vitest'
import { distance, insetQuad, orderPoints, polygonArea, scaleQuad, warpedSize } from './geometry'

describe('orderPoints', () => {
  it('sorts an axis-aligned rectangle into tl/tr/br/bl regardless of input order', () => {
    const tl = { x: 0, y: 0 }
    const tr = { x: 100, y: 0 }
    const br = { x: 100, y: 50 }
    const bl = { x: 0, y: 50 }

    expect(orderPoints([br, tl, bl, tr])).toEqual([tl, tr, br, bl])
  })

  it('sorts a rotated/skewed quad correctly', () => {
    const tl = { x: 20, y: 10 }
    const tr = { x: 120, y: 5 }
    const br = { x: 110, y: 90 }
    const bl = { x: 15, y: 95 }

    expect(orderPoints([bl, br, tr, tl])).toEqual([tl, tr, br, bl])
  })

  it('throws for non-4-point input', () => {
    expect(() => orderPoints([{ x: 0, y: 0 }])).toThrow()
  })
})

describe('polygonArea', () => {
  it('computes the area of a simple rectangle', () => {
    const area = polygonArea([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ])
    expect(area).toBe(50)
  })
})

describe('insetQuad', () => {
  it('produces a quad inset by the given ratio', () => {
    const quad = insetQuad(200, 100, 0.1)
    expect(quad).toEqual([
      { x: 20, y: 10 },
      { x: 180, y: 10 },
      { x: 180, y: 90 },
      { x: 20, y: 90 },
    ])
  })
})

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('scaleQuad', () => {
  it('scales all points by the given factor', () => {
    const quad = insetQuad(100, 100, 0.1)
    const scaled = scaleQuad(quad, 2)
    expect(scaled).toEqual([
      { x: 20, y: 20 },
      { x: 180, y: 20 },
      { x: 180, y: 180 },
      { x: 20, y: 180 },
    ])
  })
})

describe('warpedSize', () => {
  it('preserves aspect ratio of the source quad', () => {
    const quad = orderPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ])
    expect(warpedSize(quad)).toEqual({ width: 100, height: 50 })
  })
})
