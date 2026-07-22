function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const BACKGROUND_ESTIMATE_MAX_DIMENSION = 20

/** Block-average downsample of a single-channel plane to (at most) `maxDimension` on its longest side. */
export function downsamplePlane(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  maxDimension: number,
): { data: Float32Array; width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))

  const sums = new Float32Array(outW * outH)
  const counts = new Uint32Array(outW * outH)
  for (let y = 0; y < height; y++) {
    const oy = Math.min(outH - 1, Math.floor((y / height) * outH))
    for (let x = 0; x < width; x++) {
      const ox = Math.min(outW - 1, Math.floor((x / width) * outW))
      const oi = oy * outW + ox
      sums[oi] += gray[y * width + x]
      counts[oi]++
    }
  }

  const data = new Float32Array(outW * outH)
  for (let i = 0; i < data.length; i++) data[i] = sums[i] / Math.max(1, counts[i])
  return { data, width: outW, height: outH }
}

/** Bilinear-upsamples a small plane back to full resolution. */
export function upsampleBilinear(small: Float32Array, sw: number, sh: number, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const sy = clamp((y / height) * sh - 0.5, 0, sh - 1)
    const y0 = Math.floor(sy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < width; x++) {
      const sx = clamp((x / width) * sw - 0.5, 0, sw - 1)
      const x0 = Math.floor(sx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0
      const top = small[y0 * sw + x0] * (1 - fx) + small[y0 * sw + x1] * fx
      const bottom = small[y1 * sw + x0] * (1 - fx) + small[y1 * sw + x1] * fx
      out[y * width + x] = top * (1 - fy) + bottom * fy
    }
  }
  return out
}

/**
 * Estimates a smooth "local background level" for a plane — downsamples to
 * a tiny grid (coarser than any real document edge or line of text, so
 * those average out) and upsamples back, giving a full-resolution map of
 * how the ambient lighting itself varies across the image. Shared by
 * flattenIllumination (detection-time re-centering) and scanEffect's
 * shading correction (enhancement-time shadow flattening) — both need the
 * same "what would this pixel's neighborhood look like with no local
 * content" estimate, just combined with the source differently.
 */
export function estimateLocalBackground(plane: Uint8ClampedArray, width: number, height: number, maxDimension: number): Float32Array {
  const { data: small, width: sw, height: sh } = downsamplePlane(plane, width, height, maxDimension)
  return upsampleBilinear(small, sw, sh, width, height)
}

/**
 * Removes large-scale lighting gradients (shadows, vignetting) before
 * thresholding: re-centers every pixel around mid-gray relative to its
 * estimated local background level.
 *
 * Deliberately not used on the first detection pass — it can wash out
 * contrast for a document that already fills most of the frame — only as a
 * fallback when plain thresholding finds nothing.
 */
export function flattenIllumination(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const background = estimateLocalBackground(gray, width, height, BACKGROUND_ESTIMATE_MAX_DIMENSION)

  const out = new Uint8ClampedArray(width * height)
  for (let i = 0; i < out.length; i++) {
    out[i] = clamp(128 + gray[i] - background[i], 0, 255)
  }
  return out
}
