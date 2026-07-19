/** Solves A*x = b via Gauss-Jordan elimination with partial pivoting. A is n x n, b is length n. */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r
    }
    ;[M[col], M[pivotRow]] = [M[pivotRow], M[col]]

    const pivotVal = M[col][col]
    if (Math.abs(pivotVal) < 1e-10) {
      throw new Error('연립방정식을 풀 수 없습니다 (특이 행렬)')
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col] / pivotVal
      if (factor === 0) continue
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c]
      }
    }
  }

  return M.map((row, i) => row[n] / row[i])
}
