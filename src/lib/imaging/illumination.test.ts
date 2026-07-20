import { describe, expect, it } from 'vitest'
import { flattenIllumination } from './illumination'

describe('flattenIllumination', () => {
  it('flattens a smooth left-to-right lighting gradient toward mid-gray', () => {
    const width = 100
    const height = 40
    const gray = new Uint8ClampedArray(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        gray[y * width + x] = Math.round((x / (width - 1)) * 255)
      }
    }

    const out = flattenIllumination(gray, width, height)

    // Before: far-left ~0, far-right ~255 — a strong global gradient.
    // After: both ends should sit much closer to mid-gray, since the
    // gradient itself (not a real edge) was estimated away as "background".
    const left = out[height / 2 * width + 2]
    const right = out[(height / 2) * width + (width - 3)]
    expect(Math.abs(left - 128)).toBeLessThan(40)
    expect(Math.abs(right - 128)).toBeLessThan(40)
  })

  it('preserves a feature small relative to the background-estimate resolution', () => {
    const width = 80
    const height = 80
    const gray = new Uint8ClampedArray(width * height).fill(40)
    // A small bright speck, well under one background-estimate cell (frame
    // is downsampled to a max of 20px on a side, i.e. ~4x4px cells here) —
    // so the local background estimate only partially absorbs it and
    // contrast against its surroundings survives.
    gray[40 * width + 20] = 220

    const out = flattenIllumination(gray, width, height)
    const feature = out[40 * width + 20]
    const plainBackground = out[40 * width + 5]

    expect(feature).toBeGreaterThan(plainBackground)
  })

  it('preserves noticeably less contrast for a feature large enough to fill a background-estimate cell than for a small one (a known limit — this is only ever used as a fallback, never the primary pass)', () => {
    const width = 80
    const height = 80

    const smallFeature = new Uint8ClampedArray(width * height).fill(40)
    smallFeature[42 * width + 22] = 220
    const smallOut = flattenIllumination(smallFeature, width, height)
    const smallContrast = smallOut[42 * width + 22] - smallOut[42 * width + 5]

    const largeFeature = new Uint8ClampedArray(width * height).fill(40)
    for (let y = 40; y < 44; y++) {
      for (let x = 20; x < 24; x++) {
        largeFeature[y * width + x] = 220
      }
    }
    const largeOut = flattenIllumination(largeFeature, width, height)
    const largeContrast = largeOut[42 * width + 22] - largeOut[42 * width + 5]

    expect(largeContrast).toBeLessThan(smallContrast)
  })

  it('preserves image dimensions', () => {
    const gray = new Uint8ClampedArray(30 * 20).fill(100)
    const out = flattenIllumination(gray, 30, 20)
    expect(out.length).toBe(30 * 20)
  })
})
