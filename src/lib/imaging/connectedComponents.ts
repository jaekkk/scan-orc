export interface Component {
  /** 1 for pixels belonging to this component, 0 elsewhere. */
  mask: Uint8Array
  area: number
  touchesBorder: boolean
}

/**
 * Finds the largest 4-connected component of `mask`'s foreground (nonzero)
 * pixels via iterative flood fill (label-and-sweep, not recursive — avoids
 * stack overflow on large blobs).
 *
 * Used to isolate the actual document blob from a raw brightness-threshold
 * mask: without this, a single stray bright/dark pixel cluster elsewhere in
 * frame (a reflection, a light source, background clutter) becomes a hull
 * candidate on equal footing with the real document and can drag a detected
 * corner arbitrarily far off.
 */
export function largestComponent(mask: Uint8Array, width: number, height: number): Component | null {
  const n = width * height
  const labels = new Int32Array(n).fill(-1)
  const areas: number[] = []
  const borderTouches: boolean[] = []
  const stack: number[] = []

  let nextLabel = 0
  for (let start = 0; start < n; start++) {
    if (!mask[start] || labels[start] !== -1) continue

    const label = nextLabel++
    let area = 0
    let touchesBorder = false
    stack.length = 0
    stack.push(start)
    labels[start] = label

    while (stack.length > 0) {
      const idx = stack.pop() as number
      area++
      const x = idx % width
      const y = (idx - x) / width
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true

      if (x > 0) {
        const left = idx - 1
        if (mask[left] && labels[left] === -1) {
          labels[left] = label
          stack.push(left)
        }
      }
      if (x < width - 1) {
        const right = idx + 1
        if (mask[right] && labels[right] === -1) {
          labels[right] = label
          stack.push(right)
        }
      }
      if (y > 0) {
        const up = idx - width
        if (mask[up] && labels[up] === -1) {
          labels[up] = label
          stack.push(up)
        }
      }
      if (y < height - 1) {
        const down = idx + width
        if (mask[down] && labels[down] === -1) {
          labels[down] = label
          stack.push(down)
        }
      }
    }

    areas.push(area)
    borderTouches.push(touchesBorder)
  }

  if (nextLabel === 0) return null

  let bestLabel = 0
  for (let i = 1; i < nextLabel; i++) {
    if (areas[i] > areas[bestLabel]) bestLabel = i
  }

  const componentMask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (labels[i] === bestLabel) componentMask[i] = 1
  }

  return { mask: componentMask, area: areas[bestLabel], touchesBorder: borderTouches[bestLabel] }
}
