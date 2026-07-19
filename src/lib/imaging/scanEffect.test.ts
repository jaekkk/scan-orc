import { describe, expect, it } from 'vitest'
import { applyScanEffect } from './scanEffect'
import type { RawImage } from './rawImage'

function makeGradientImage(width: number, height: number, low: number, high: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round(low + ((high - low) * x) / (width - 1))
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

describe('applyScanEffect', () => {
  it('stretches a low-contrast gray gradient toward the full 0-255 range', () => {
    const img = makeGradientImage(101, 1, 100, 150)
    const out = applyScanEffect(img)
    const firstPixel = out.data[0]
    const lastPixel = out.data[(100) * 4]
    expect(firstPixel).toBeLessThan(50)
    expect(lastPixel).toBeGreaterThan(200)
  })

  it('preserves image dimensions and alpha channel', () => {
    const img = makeGradientImage(20, 10, 50, 200)
    const out = applyScanEffect(img)
    expect(out.width).toBe(20)
    expect(out.height).toBe(10)
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255)
    }
  })

  it('does not mutate the input image', () => {
    const img = makeGradientImage(10, 10, 50, 200)
    const before = img.data[0]
    applyScanEffect(img)
    expect(img.data[0]).toBe(before)
  })
})
