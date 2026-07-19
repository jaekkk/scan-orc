export interface Point {
  x: number
  y: number
}

export type Quad = [Point, Point, Point, Point]

/**
 * Sorts 4 arbitrary-order corner points into [topLeft, topRight, bottomRight, bottomLeft].
 * approxPolyDP does not guarantee point order, but getPerspectiveTransform requires a
 * consistent src/dst correspondence.
 */
export function orderPoints(points: Point[]): Quad {
  if (points.length !== 4) {
    throw new Error(`orderPoints expects exactly 4 points, got ${points.length}`)
  }

  const sorted = [...points].sort((a, b) => a.x + a.y - (b.x + b.y))
  const topLeft = sorted[0]
  const bottomRight = sorted[3]

  const remaining = sorted.slice(1, 3).sort((a, b) => a.x - a.y - (b.x - b.y))
  const bottomLeft = remaining[0]
  const topRight = remaining[1]

  return [topLeft, topRight, bottomRight, bottomLeft]
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Shoelace formula; works for any simple polygon, used to score quad candidates. */
export function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    sum += p1.x * p2.y - p2.x * p1.y
  }
  return Math.abs(sum) / 2
}

/** Default fallback quad: a fixed-percentage inset from the full image bounds. */
export function insetQuad(width: number, height: number, insetRatio = 0.05): Quad {
  const dx = width * insetRatio
  const dy = height * insetRatio
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ]
}

/** Scales a quad's coordinates by a factor (e.g. mapping a detection done on a downscaled image back to full resolution). */
export function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad
}

/** Output size for the perspective warp, preserving the quad's actual proportions. */
export function warpedSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad
  const width = Math.round(Math.max(distance(tl, tr), distance(bl, br)))
  const height = Math.round(Math.max(distance(tl, bl), distance(tr, br)))
  return { width: Math.max(width, 1), height: Math.max(height, 1) }
}
