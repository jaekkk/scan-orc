import type { RawImage } from './rawImage'
import { toGrayscale } from './otsu'
import { upsampleBilinear } from './illumination'

// Coarse enough that a line of text or a whole word averages into its
// surrounding page rather than dragging the local estimate down — the goal
// is to track only genuinely large-scale gradients (a shadow falling across
// part of the page, uneven flash falloff), not react to content.
const BACKGROUND_GRID_MAX_DIMENSION = 20
// Percentile (on the coarse background grid, not the raw image) treated as
// "the best-lit part of the page" — the level every other region gets
// pulled toward. A high-but-not-max percentile so a single stray glare
// pixel/cell can't become the reference point.
const REFERENCE_PERCENTILE = 0.92
// Bounds how strongly any one pixel's brightness can be corrected. Without
// this, a corner that's genuinely dark (e.g. a sliver of background outside
// the document that survived cropping) would get amplified toward blown-out
// white instead of just gently lifted — and deep-shadow noise would get
// amplified into visible blotches.
const MAX_CORRECTION_RATIO = 1.6

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Block-MAXIMUM downsample of a plane — not a mean/average. Ink is always
 * darker than the paper around it, so as long as any sliver of paper is
 * visible within a grid cell, the max ignores the ink entirely and tracks
 * the paper's true brightness there. An average-based estimate, by
 * contrast, gets dragged down by dense ink and ends up mistaking that
 * content for a shadow — which would then overshoot when "corrected",
 * brightening the paper around the ink past its real brightness.
 */
function downsamplePlaneMax(
  plane: Uint8ClampedArray,
  width: number,
  height: number,
  maxDimension: number,
): { data: Float32Array; width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))

  const maxes = new Float32Array(outW * outH)
  for (let y = 0; y < height; y++) {
    const oy = Math.min(outH - 1, Math.floor((y / height) * outH))
    for (let x = 0; x < width; x++) {
      const ox = Math.min(outW - 1, Math.floor((x / width) * outW))
      const oi = oy * outW + ox
      const v = plane[y * width + x]
      if (v > maxes[oi]) maxes[oi] = v
    }
  }
  return { data: maxes, width: outW, height: outH }
}

/**
 * Dilates the coarse background grid by taking each cell's max with its
 * immediate neighbors. Guards against a solid dark region (a thick
 * underline, a table border, a stamp) that happens to fully fill one grid
 * cell with no paper pixel for downsamplePlaneMax to find in that cell
 * alone — its neighboring cells almost certainly do have paper, and this
 * lets that true level "bleed in" rather than mistaking the dark content
 * for shadow.
 */
function dilateGrid(grid: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy))
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          const v = grid[yy * width + xx]
          if (v > max) max = v
        }
      }
      out[y * width + x] = max
    }
  }
  return out
}

function percentileOfGrid(grid: Float32Array, percentile: number): number {
  const histogram = new Array(256).fill(0)
  for (const v of grid) histogram[clamp(Math.round(v), 0, 255)]++
  const target = grid.length * percentile
  let cumulative = 0
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v]
    if (cumulative >= target) return v
  }
  return 255
}

/**
 * Flattens large-scale lighting unevenness (a shadow falling across part of
 * the page, a flash brighter at the center than the edges) so the whole
 * page reads as one consistent brightness instead of visibly darker in
 * whichever corner the light didn't reach.
 *
 * Estimates a local "background" brightness at every pixel from luminance
 * only (not per-channel — see downsamplePlaneMax), then scales all three
 * channels together by how far that pixel's local background sits below
 * the page's best-lit region. A pixel in a shadowed area gets brightened to
 * match; a pixel already in the well-lit area is left close to unchanged.
 * Using one shared factor per pixel (rather than correcting each channel
 * independently) keeps the page's actual color intact — an independent
 * per-channel version would let whichever channel has the least headroom
 * before 255 (typically red) clip first, throwing off the global
 * white-balance pass that runs after this and introducing a color cast
 * exactly where this step is supposed to prevent one.
 *
 * Because the correction is local (per-pixel, not one global factor), it
 * fixes a shadow that only covers part of the page — something a single
 * global brightness/white-balance pass can't do without either leaving the
 * shadowed part too dark or blowing out the rest. Run before the global
 * white-balance/contrast steps, since those assume one consistent white
 * point across the whole page — an assumption this step is what makes
 * actually true.
 */
export function flattenShading(image: RawImage): RawImage {
  const { data, width, height } = image
  const out = new Uint8ClampedArray(data)

  const luma = toGrayscale(data, width, height)
  const { data: rawGrid, width: gw, height: gh } = downsamplePlaneMax(luma, width, height, BACKGROUND_GRID_MAX_DIMENSION)
  const grid = dilateGrid(rawGrid, gw, gh)
  const background = upsampleBilinear(grid, gw, gh, width, height)
  const referenceLevel = percentileOfGrid(grid, REFERENCE_PERCENTILE)

  for (let i = 0, p = 0; p < luma.length; i += 4, p++) {
    const factor = clamp(referenceLevel / Math.max(1, background[p]), 1 / MAX_CORRECTION_RATIO, MAX_CORRECTION_RATIO)
    out[i] = clamp(data[i] * factor, 0, 255)
    out[i + 1] = clamp(data[i + 1] * factor, 0, 255)
    out[i + 2] = clamp(data[i + 2] * factor, 0, 255)
  }

  return { data: out, width, height }
}
