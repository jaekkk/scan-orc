import type { Point, Quad } from './geometry'

/** Signed area of the triangle formed by three points (used as "area lost by removing b"). */
function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
}

/**
 * Reduces a convex polygon to exactly 4 vertices by repeatedly removing the
 * vertex whose removal loses the least area — a small Visvalingam-Whyatt-style
 * simplification. For a photographed rectangular document (whose silhouette is
 * itself a quadrilateral, possibly skewed by perspective), this converges on
 * the true 4 corners rather than an axis-aligned bounding box.
 */
export function reduceToQuad(hull: Point[]): Quad {
  let pts = [...hull]

  while (pts.length < 4) {
    // Degenerate hull (shouldn't happen for a real document mask) — pad by duplicating.
    pts.push(pts[pts.length - 1])
  }

  while (pts.length > 4) {
    const n = pts.length
    let minLoss = Infinity
    let minIndex = 0
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n]
      const curr = pts[i]
      const next = pts[(i + 1) % n]
      const loss = triangleArea(prev, curr, next)
      if (loss < minLoss) {
        minLoss = loss
        minIndex = i
      }
    }
    pts.splice(minIndex, 1)
  }

  return [pts[0], pts[1], pts[2], pts[3]]
}
