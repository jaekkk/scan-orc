import type { Point, Quad, ScoredQuad } from './geometry'
import { orderPoints, polygonArea, quadAngleScore } from './geometry'
import { dilateMask } from './morphology'
import { otsuThreshold } from './otsu'

const THETA_BINS = 180
// Each edge pixel only votes for lines whose normal is within this many bins
// (degrees) of its own gradient direction — far fewer votes, far cleaner peaks.
const VOTE_HALF_WINDOW = 10
const MAX_LINES = 12
// Two peaks closer than this (in angle and offset) are the same physical line.
const SAME_LINE_THETA = (8 * Math.PI) / 180
const SAME_LINE_RHO = 12
// A side must be backed by this many edge votes (as a fraction of the short
// frame side) to be a candidate line at all.
const MIN_LINE_VOTES_RATIO = 0.15
const MIN_AREA_RATIO = 0.2
// Document corners may sit slightly outside the frame; beyond this fraction
// of the frame size the quad is not a plausible document.
const FRAME_OVERSHOOT_RATIO = 0.03
const SUPPORT_RADIUS = 2
const SUPPORT_STEP = 2
const MIN_ANGLE_SCORE = 0.3

interface Line {
  theta: number
  rho: number
}

/** Sobel gradient magnitude (scaled into 0..255) and the angle of the gradient (the edge's normal). */
function sobel(gray: Uint8ClampedArray, width: number, height: number) {
  const magnitude = new Uint8ClampedArray(width * height)
  const angle = new Float32Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const tl = gray[i - width - 1]
      const t = gray[i - width]
      const tr = gray[i - width + 1]
      const l = gray[i - 1]
      const r = gray[i + 1]
      const bl = gray[i + width - 1]
      const b = gray[i + width]
      const br = gray[i + width + 1]
      const gx = tr + 2 * r + br - tl - 2 * l - bl
      const gy = bl + 2 * b + br - tl - 2 * t - tr
      magnitude[i] = Math.hypot(gx, gy) / 4
      angle[i] = Math.atan2(gy, gx)
    }
  }

  return { magnitude, angle }
}

/** Gradient-directed Hough transform: returns up to MAX_LINES distinct strong lines, strongest first. */
function findLines(edges: Uint8Array, angle: Float32Array, width: number, height: number): Line[] {
  const diag = Math.ceil(Math.hypot(width, height))
  const rhoBins = 2 * diag + 1
  const acc = new Uint16Array(THETA_BINS * rhoBins)
  const cos = new Float32Array(THETA_BINS)
  const sin = new Float32Array(THETA_BINS)
  for (let t = 0; t < THETA_BINS; t++) {
    cos[t] = Math.cos((t * Math.PI) / THETA_BINS)
    sin[t] = Math.sin((t * Math.PI) / THETA_BINS)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!edges[i]) continue
      const center = Math.round((angle[i] * THETA_BINS) / Math.PI)
      for (let t = center - VOTE_HALF_WINDOW; t <= center + VOTE_HALF_WINDOW; t++) {
        // t may fall outside 0..179: theta and theta+pi are the same line, so fold it back.
        const ti = ((t % THETA_BINS) + THETA_BINS) % THETA_BINS
        const rho = x * cos[ti] + y * sin[ti]
        acc[ti * rhoBins + Math.round(rho) + diag]++
      }
    }
  }

  const minVotes = Math.min(width, height) * MIN_LINE_VOTES_RATIO
  const cells: number[] = []
  for (let c = 0; c < acc.length; c++) {
    if (acc[c] >= minVotes) cells.push(c)
  }
  cells.sort((a, b) => acc[b] - acc[a])

  const lines: Line[] = []
  for (const c of cells) {
    if (lines.length >= MAX_LINES) break
    const candidate: Line = {
      theta: (Math.floor(c / rhoBins) * Math.PI) / THETA_BINS,
      rho: (c % rhoBins) - diag,
    }
    if (!lines.some((l) => isSameLine(l, candidate))) lines.push(candidate)
  }
  return lines
}

function isSameLine(a: Line, b: Line): boolean {
  let dTheta = b.theta - a.theta
  let rho = b.rho
  if (dTheta > Math.PI / 2) {
    dTheta -= Math.PI
    rho = -rho
  } else if (dTheta < -Math.PI / 2) {
    dTheta += Math.PI
    rho = -rho
  }
  return Math.abs(dTheta) < SAME_LINE_THETA && Math.abs(rho - a.rho) < SAME_LINE_RHO
}

function intersect(a: Line, b: Line): Point | null {
  const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta)
  if (Math.abs(det) < 0.25) return null // nearly parallel (< ~15 degrees apart)
  return {
    x: (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
    y: (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / det,
  }
}

function isConvex(points: Point[]): boolean {
  let sign = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const c = points[(i + 2) % points.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross === 0) return false
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

/** Fraction of the segment a->b (sampled inside the frame) that has an edge pixel within SUPPORT_RADIUS. */
function sideSupport(a: Point, b: Point, nearEdge: Uint8Array, width: number, height: number): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const steps = Math.max(1, Math.round(length / SUPPORT_STEP))
  let inside = 0
  let hits = 0
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(a.x + ((b.x - a.x) * s) / steps)
    const y = Math.round(a.y + ((b.y - a.y) * s) / steps)
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    inside++
    if (nearEdge[y * width + x]) hits++
  }
  return inside === 0 ? 0 : hits / inside
}

/**
 * Edge-based document detection, for photos where the document and its
 * surroundings barely differ in tone but the paper's edge is still visible
 * as a line: Sobel edges -> gradient-directed Hough lines -> every four-line
 * combination that closes into a large convex quad, scored by how well all
 * four sides are backed by actual edge pixels and how close to rectangular
 * the corners are. Returns null if nothing scores as a plausible document.
 */
export function detectEdgeQuad(gray: Uint8ClampedArray, width: number, height: number): ScoredQuad | null {
  const { magnitude, angle } = sobel(gray, width, height)
  const threshold = otsuThreshold(magnitude)
  const edges = new Uint8Array(width * height)
  for (let i = 0; i < edges.length; i++) edges[i] = magnitude[i] > threshold ? 1 : 0

  const lines = findLines(edges, angle, width, height)
  if (lines.length < 4) return null

  const nearEdge = dilateMask(edges, width, height, SUPPORT_RADIUS)
  const imageArea = width * height
  const overshootX = width * FRAME_OVERSHOOT_RATIO
  const overshootY = height * FRAME_OVERSHOOT_RATIO

  let best: ScoredQuad | null = null

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      for (let k = j + 1; k < lines.length; k++) {
        for (let l = k + 1; l < lines.length; l++) {
          const four = [lines[i], lines[j], lines[k], lines[l]]
          // Three ways to split four lines into two "opposite side" pairs.
          for (const [a, b, c, d] of [
            [0, 1, 2, 3],
            [0, 2, 1, 3],
            [0, 3, 1, 2],
          ]) {
            const quad = closeQuad(four[a], four[b], four[c], four[d])
            if (!quad) continue
            if (
              quad.some(
                (p) => p.x < -overshootX || p.x > width - 1 + overshootX || p.y < -overshootY || p.y > height - 1 + overshootY,
              )
            ) {
              continue
            }
            const area = polygonArea(quad)
            if (area < imageArea * MIN_AREA_RATIO) continue
            const angles = quadAngleScore(quad)
            if (angles < MIN_ANGLE_SCORE) continue

            let weakestSide = 1
            for (let s = 0; s < 4 && weakestSide > 0; s++) {
              weakestSide = Math.min(weakestSide, sideSupport(quad[s], quad[(s + 1) % 4], nearEdge, width, height))
            }
            const score = weakestSide * angles * (0.9 + 0.1 * Math.min(1, area / imageArea))
            if (!best || score > best.score) best = { quad, score }
          }
        }
      }
    }
  }

  if (!best) return null
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v))
  const ordered = orderPoints(best.quad)
  return {
    quad: ordered.map((p) => ({ x: clamp(p.x, width - 1), y: clamp(p.y, height - 1) })) as Quad,
    score: best.score,
  }
}

/** Corners of the quad whose sides lie on lines a, b (opposite pair) and c, d (opposite pair), in cycle order — or null if they don't close into a convex quad. */
function closeQuad(a: Line, b: Line, c: Line, d: Line): Quad | null {
  const corners = [intersect(a, c), intersect(a, d), intersect(b, d), intersect(b, c)]
  if (corners.some((p) => p === null)) return null
  const quad = corners as Quad
  return isConvex(quad) ? quad : null
}
