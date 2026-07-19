import { describe, expect, it } from 'vitest'
import { warpPerspective } from './warpPerspective'
import type { RawImage } from './rawImage'
import type { Quad } from './geometry'

/** width x height RGBA image, split vertically into a left color and a right color. */
function makeSplitImage(width: number, height: number, leftColor: number, rightColor: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = x < width / 2 ? leftColor : rightColor
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

function pixelAt(img: RawImage, x: number, y: number) {
  const i = (y * img.width + x) * 4
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] }
}

describe('warpPerspective', () => {
  it('is approximately identity when the quad equals the full source rect', () => {
    const source = makeSplitImage(100, 100, 20, 220)
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const out = warpPerspective(source, quad, 100, 100)
    expect(pixelAt(out, 10, 50).r).toBeCloseTo(20, 0)
    expect(pixelAt(out, 90, 50).r).toBeCloseTo(220, 0)
  })

  it('crops to a sub-region of the source', () => {
    // Right half of the source (all `rightColor`) becomes the entire output.
    const source = makeSplitImage(100, 100, 20, 220)
    const quad: Quad = [
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
    ]
    const out = warpPerspective(source, quad, 50, 100)
    expect(pixelAt(out, 5, 50).r).toBeCloseTo(220, 0)
    expect(pixelAt(out, 45, 50).r).toBeCloseTo(220, 0)
  })

  it('deskews a trapezoidal (perspective-distorted) quad toward uniform output', () => {
    // A uniformly white source photographed as a trapezoid should still warp
    // to a uniformly white rectangle.
    const data = new Uint8ClampedArray(200 * 200 * 4).fill(255)
    const source: RawImage = { data, width: 200, height: 200 }
    const quad: Quad = [
      { x: 40, y: 20 },
      { x: 160, y: 30 },
      { x: 170, y: 180 },
      { x: 30, y: 170 },
    ]
    const out = warpPerspective(source, quad, 100, 150)
    expect(pixelAt(out, 50, 75).r).toBe(255)
    expect(pixelAt(out, 5, 5).r).toBe(255)
    expect(pixelAt(out, 95, 145).r).toBe(255)
  })
})
