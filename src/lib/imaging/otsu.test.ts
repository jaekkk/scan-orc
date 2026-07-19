import { describe, expect, it } from 'vitest'
import { boxBlur, otsuThreshold, toGrayscale } from './otsu'

describe('toGrayscale', () => {
  it('converts pure white and pure black correctly', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    const gray = toGrayscale(data, 2, 1)
    expect(gray[0]).toBe(255)
    expect(gray[1]).toBe(0)
  })
})

describe('boxBlur', () => {
  it('leaves a uniform field unchanged', () => {
    const gray = new Uint8ClampedArray(9).fill(100)
    const blurred = boxBlur(gray, 3, 3, 1)
    for (const v of blurred) expect(v).toBe(100)
  })

  it('smooths a single bright outlier toward its neighbors', () => {
    const gray = new Uint8ClampedArray(9).fill(0)
    gray[4] = 255 // center pixel of a 3x3 grid
    const blurred = boxBlur(gray, 3, 3, 1)
    expect(blurred[4]).toBeLessThan(255)
    expect(blurred[4]).toBeGreaterThan(0)
  })
})

describe('otsuThreshold', () => {
  it('finds a threshold between two well-separated clusters', () => {
    const gray = new Uint8ClampedArray(200)
    for (let i = 0; i < 100; i++) gray[i] = 30
    for (let i = 100; i < 200; i++) gray[i] = 220
    const t = otsuThreshold(gray)
    // threshold semantics: pixels <= t are one class, > t the other — t=30
    // already perfectly separates the two clusters, so this is the expected minimum.
    expect(t).toBeGreaterThanOrEqual(30)
    expect(t).toBeLessThan(220)
  })
})
