import { describe, expect, it } from 'vitest'
import { flattenShading } from './shading'
import type { RawImage } from './rawImage'

/** Uniform gray page with a smooth left-to-right brightness falloff, simulating a shadow covering roughly the left half. */
function makeShadowedPage(width: number, height: number, litLevel: number, shadowLevel: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Smooth (not hard-edged) gradient — shadow edges from real lighting
      // are soft, not a sharp step.
      const t = x / (width - 1)
      const v = Math.round(shadowLevel + (litLevel - shadowLevel) * t)
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

function readGray(image: RawImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4]
}

describe('flattenShading', () => {
  it('brings a shadowed region much closer to the lit region than before correction', () => {
    const width = 200
    const height = 100
    const img = makeShadowedPage(width, height, 230, 110)

    const before = { lit: readGray(img, width - 10, 50), shadow: readGray(img, 10, 50) }
    expect(before.lit - before.shadow).toBeGreaterThan(100) // sanity: the synthetic shadow is strong

    const out = flattenShading(img)
    const after = { lit: readGray(out, width - 10, 50), shadow: readGray(out, 10, 50) }

    expect(after.lit - after.shadow).toBeLessThan(before.lit - before.shadow)
    expect(Math.abs(after.lit - after.shadow)).toBeLessThan(50)
  })

  it('leaves an already-evenly-lit page essentially unchanged', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(200)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    const img: RawImage = { width, height, data }

    const out = flattenShading(img)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(out.data[(50 * width + 50) * 4 + i] - 200)).toBeLessThan(10)
    }
  })

  it('keeps dark ink within a shadowed region distinguishably darker than its local paper background', () => {
    const width = 200
    const height = 100
    const img = makeShadowedPage(width, height, 230, 110)
    // A line of "ink" sitting inside the shadowed (left) half.
    for (let x = 20; x < 60; x++) {
      const i = (50 * width + x) * 4
      img.data[i] = 20
      img.data[i + 1] = 20
      img.data[i + 2] = 20
    }

    const out = flattenShading(img)
    const ink = readGray(out, 40, 50)
    const localPaper = readGray(out, 15, 50) // just outside the ink line, same shadowed region
    expect(localPaper - ink).toBeGreaterThan(50)
  })

  it('bounds the correction so a genuinely very dark region is not blown out toward white', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(230)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    // A deeply dark corner (e.g. background sliver that survived cropping),
    // not a shallow shadow.
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        const i = (y * width + x) * 4
        data[i] = 15
        data[i + 1] = 15
        data[i + 2] = 15
      }
    }

    const out = flattenShading({ width, height, data })
    const corner = readGray(out, 10, 10)
    expect(corner).toBeLessThan(80)
  })

  it('preserves image dimensions and alpha channel', () => {
    const img = makeShadowedPage(30, 20, 220, 150)
    const out = flattenShading(img)
    expect(out.width).toBe(30)
    expect(out.height).toBe(20)
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255)
    }
  })

  it('does not mutate the input image', () => {
    const img = makeShadowedPage(30, 20, 220, 150)
    const before = img.data[0]
    flattenShading(img)
    expect(img.data[0]).toBe(before)
  })
})
