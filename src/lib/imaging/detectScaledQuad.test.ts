import { describe, expect, it } from 'vitest'
import { detectScaledQuad } from './detectScaledQuad'
import { polygonArea } from './geometry'
import type { RawImage } from './rawImage'

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

describe('detectScaledQuad', () => {
  it('scales a detected quad up by the given factor', () => {
    const img = makeSyntheticPhoto(200, 150, { x0: 40, y0: 30, x1: 160, y1: 120 })
    const quad = detectScaledQuad(img, 3)
    expect(quad).not.toBeNull()
    if (!quad) return

    // Scaling by 3 multiplies linear dimensions by 3, so area by 9.
    const unscaled = detectScaledQuad(img, 1)
    expect(unscaled).not.toBeNull()
    if (!unscaled) return
    expect(polygonArea(quad)).toBeCloseTo(polygonArea(unscaled) * 9, -1)
  })

  it('returns null when no document is found, regardless of scale', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(128)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    const img: RawImage = { width: 100, height: 100, data }
    expect(detectScaledQuad(img, 4)).toBeNull()
  })
})
