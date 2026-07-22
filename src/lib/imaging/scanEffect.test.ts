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
  it('flattens a smooth low-contrast gradient rather than stretching it — it reads as a lighting gradient (shadow/flash falloff), not real page content', () => {
    // A page is physically flat and evenly toned apart from ink; a smooth
    // brightness ramp across the whole frame is exactly what a shadow or
    // uneven flash looks like, so shading correction is supposed to flatten
    // it to a consistent brightness rather than preserve/stretch it as if
    // it were genuine contrast.
    const img = makeGradientImage(101, 1, 100, 150)
    const out = applyScanEffect(img)
    const firstPixel = out.data[0]
    const lastPixel = out.data[(100) * 4]
    expect(Math.abs(lastPixel - firstPixel)).toBeLessThan(20)
  })

  it('stretches genuinely low-contrast content (distinct ink vs. paper tones, not a smooth gradient) toward the full 0-255 range', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(150)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    // A couple of thin text-like lines rather than one large solid block —
    // real ink is thin strokes with paper visible around it even at small
    // scale, not a solid filled rectangle (which no real document has).
    for (const y of [40, 41, 55, 56]) {
      for (let x = 20; x < 80; x++) {
        const i = (y * width + x) * 4
        data[i] = 100
        data[i + 1] = 100
        data[i + 2] = 100
      }
    }

    const out = applyScanEffect({ width, height, data })
    const paper = out.data[(10 * width + 10) * 4]
    const ink = out.data[(40 * width + 50) * 4]
    expect(paper).toBeGreaterThan(200)
    expect(paper - ink).toBeGreaterThan(80)
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

  function makeTintedPage(width: number, height: number, paperTint: [number, number, number], inkTint: [number, number, number]): RawImage {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isInk = y === Math.floor(height / 2) && x > width * 0.2 && x < width * 0.8
        const [r, g, b] = isInk ? inkTint : paperTint
        const i = (y * width + x) * 4
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
    return { data, width, height }
  }

  it('neutralizes a warm (yellowish) ambient-light color cast so the page reads as true white', () => {
    const img = makeTintedPage(50, 50, [230, 210, 160], [70, 60, 45])
    const out = applyScanEffect(img)
    const i = (10 * 50 + 10) * 4 // a paper pixel
    const [r, g, b] = [out.data[i], out.data[i + 1], out.data[i + 2]]
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(15)
    expect(r).toBeGreaterThan(230)
  })

  it('does not crush a mostly-blank page toward black when ink coverage is thinner than the black-point percentile', () => {
    // Regression coverage: a percentile-based black point can, for a page
    // with very little dark content, skip straight past the sparse ink and
    // land back on the paper's own brightness — turning "black point" into
    // "the whole page", which then stretches every paper pixel to 0.
    const width = 200
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4).fill(230)
    for (let i = 3; i < data.length; i += 4) data[i] = 255 // alpha
    // Ink covering well under 1% of the page.
    for (let y = 100; y < 102; y++) {
      for (let x = 90; x < 110; x++) {
        const i = (y * width + x) * 4
        data[i] = 20
        data[i + 1] = 20
        data[i + 2] = 20
      }
    }

    const out = applyScanEffect({ width, height, data })
    const paperPixel = out.data[(50 * width + 50) * 4]
    expect(paperPixel).toBeGreaterThan(200)
  })

  it('brings a page with a shadow over only part of it to a consistent brightness end-to-end, instead of leaving a visible seam', () => {
    // Regression coverage for the reported complaint: a hand/phone casting a
    // shadow over roughly half the page during capture used to leave that
    // half visibly darker/grayer than the rest after enhancement — a
    // jarring discontinuity ("이질감") right at the shadow boundary.
    const width = 200
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Smooth falloff — real shadow edges are soft, not a hard step.
        const t = x / (width - 1)
        const v = Math.round(140 + (230 - 140) * t) // shadowed on the left, lit on the right
        const i = (y * width + x) * 4
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }

    const out = applyScanEffect({ width, height, data })
    const shadowedPaper = out.data[(50 * width + 20) * 4]
    const litPaper = out.data[(50 * width + 180) * 4]
    expect(shadowedPaper).toBeGreaterThan(220)
    expect(Math.abs(litPaper - shadowedPaper)).toBeLessThan(25)
  })

  it('produces near-identical paper color for warm- and cool-tinted versions of the same page', () => {
    const warm = makeTintedPage(50, 50, [230, 210, 160], [70, 60, 45])
    const cool = makeTintedPage(50, 50, [170, 195, 230], [45, 55, 70])
    const outWarm = applyScanEffect(warm)
    const outCool = applyScanEffect(cool)
    const i = (10 * 50 + 10) * 4

    for (let c = 0; c < 3; c++) {
      expect(Math.abs(outWarm.data[i + c] - outCool.data[i + c])).toBeLessThan(20)
    }
  })
})
