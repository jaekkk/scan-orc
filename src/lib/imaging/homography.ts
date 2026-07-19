import type { Point } from './geometry'
import { solveLinearSystem } from './linalg'

/** 3x3 matrix, row-major, flat length-9 array. */
export type Mat3 = number[]

/**
 * Computes the 3x3 homography H mapping each src[i] -> dst[i] (4 point
 * correspondences), via the standard 8-unknown linear system (h8 fixed to 1).
 */
export function computeHomography(src: Point[], dst: Point[]): Mat3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('computeHomography requires exactly 4 point correspondences')
  }

  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: X, y: Y } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }

  const h = solveLinearSystem(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

/** Applies H to a point in homogeneous coordinates, dividing through by w. */
export function applyHomography(H: Mat3, p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8]
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  }
}
