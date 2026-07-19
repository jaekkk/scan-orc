import type { Quad } from './geometry'
import { applyHomography, computeHomography, type Mat3 } from './homography'
import type { RawImage } from './rawImage'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  out: Uint8ClampedArray,
  outIndex: number,
) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0

  const cx0 = clamp(x0, 0, width - 1)
  const cx1 = clamp(x0 + 1, 0, width - 1)
  const cy0 = clamp(y0, 0, height - 1)
  const cy1 = clamp(y0 + 1, 0, height - 1)

  const i00 = (cy0 * width + cx0) * 4
  const i10 = (cy0 * width + cx1) * 4
  const i01 = (cy1 * width + cx0) * 4
  const i11 = (cy1 * width + cx1) * 4

  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx
    const bottom = data[i01 + c] * (1 - fx) + data[i11 + c] * fx
    out[outIndex + c] = top * (1 - fy) + bottom * fy
  }
}

/**
 * Perspective-warps the quad region of `source` into an outWidth x outHeight
 * axis-aligned image, deskewing it. Uses backward mapping (for each dest
 * pixel, find its source coordinate via the inverse-direction homography)
 * with bilinear sampling, which is the standard approach for gap-free warps.
 */
export function warpPerspective(source: RawImage, quad: Quad, outWidth: number, outHeight: number): RawImage {
  const destRect = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ]
  // Maps dest-rect coords -> source-quad coords directly, so we can go
  // pixel-by-pixel over the destination without inverting a matrix.
  const H: Mat3 = computeHomography(destRect, quad)

  const out = new Uint8ClampedArray(outWidth * outHeight * 4)
  const { data: srcData, width: srcW, height: srcH } = source

  for (let Y = 0; Y < outHeight; Y++) {
    for (let X = 0; X < outWidth; X++) {
      const src = applyHomography(H, { x: X, y: Y })
      const outIndex = (Y * outWidth + X) * 4
      sampleBilinear(srcData, srcW, srcH, src.x, src.y, out, outIndex)
    }
  }

  return { data: out, width: outWidth, height: outHeight }
}
