import { describe, expect, it } from 'vitest'
import { solveLinearSystem } from './linalg'

describe('solveLinearSystem', () => {
  it('solves a simple diagonal system', () => {
    const A = [
      [2, 0],
      [0, 4],
    ]
    const b = [6, 8]
    const x = solveLinearSystem(A, b)
    expect(x[0]).toBeCloseTo(3)
    expect(x[1]).toBeCloseTo(2)
  })

  it('solves a system requiring pivoting', () => {
    const A = [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ]
    const b = [3, 3, 4]
    const x = solveLinearSystem(A, b)
    // x0+x1=4, x0+x2=3, x1+x2=3 => x0=2, x1=2, x2=1
    expect(x[0]).toBeCloseTo(2)
    expect(x[1]).toBeCloseTo(2)
    expect(x[2]).toBeCloseTo(1)
  })

  it('throws on a singular matrix', () => {
    const A = [
      [1, 1],
      [2, 2],
    ]
    expect(() => solveLinearSystem(A, [1, 2])).toThrow()
  })
})
