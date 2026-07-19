import type { RawImage } from './rawImage'

const LOW_PERCENTILE = 0.01
const HIGH_PERCENTILE = 0.99
const CONTRAST_ALPHA = 1.08
const BRIGHTNESS_BETA = 8

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Per-channel percentile-clipped histogram stretch (auto-levels) + a light global contrast/brightness push. */
export function applyScanEffect(image: RawImage): RawImage {
  const { data, width, height } = image
  const out = new Uint8ClampedArray(data)
  const totalPixels = width * height

  for (let channel = 0; channel < 3; channel++) {
    const histogram = new Array(256).fill(0)
    for (let i = channel; i < data.length; i += 4) histogram[data[i]]++

    const lowTarget = totalPixels * LOW_PERCENTILE
    const highTarget = totalPixels * HIGH_PERCENTILE

    let cumulative = 0
    let low = 0
    for (let v = 0; v < 256; v++) {
      cumulative += histogram[v]
      if (cumulative >= lowTarget) {
        low = v
        break
      }
    }

    cumulative = 0
    let high = 255
    for (let v = 0; v < 256; v++) {
      cumulative += histogram[v]
      if (cumulative >= highTarget) {
        high = v
        break
      }
    }

    const range = Math.max(1, high - low)
    for (let i = channel; i < data.length; i += 4) {
      out[i] = clamp(((data[i] - low) / range) * 255, 0, 255)
    }
  }

  for (let i = 0; i < out.length; i += 4) {
    out[i] = clamp(out[i] * CONTRAST_ALPHA + BRIGHTNESS_BETA, 0, 255)
    out[i + 1] = clamp(out[i + 1] * CONTRAST_ALPHA + BRIGHTNESS_BETA, 0, 255)
    out[i + 2] = clamp(out[i + 2] * CONTRAST_ALPHA + BRIGHTNESS_BETA, 0, 255)
  }

  return { data: out, width, height }
}
