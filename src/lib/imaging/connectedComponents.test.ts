import { describe, expect, it } from 'vitest'
import { largestComponent } from './connectedComponents'

function maskFromRows(rows: string[]): { mask: Uint8Array; width: number; height: number } {
  const height = rows.length
  const width = rows[0].length
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      mask[y * width + x] = rows[y][x] === '#' ? 1 : 0
    }
  }
  return { mask, width, height }
}

describe('largestComponent', () => {
  it('returns null for an all-empty mask', () => {
    const { mask, width, height } = maskFromRows(['...', '...', '...'])
    expect(largestComponent(mask, width, height)).toBeNull()
  })

  it('picks the larger of two disconnected blobs', () => {
    const { mask, width, height } = maskFromRows([
      '#....#',
      '#....#',
      '#....#',
      '......',
    ])
    const result = largestComponent(mask, width, height)
    expect(result).not.toBeNull()
    expect(result?.area).toBe(3)
  })

  it('ignores an isolated single-pixel outlier when a bigger blob exists', () => {
    const { mask, width, height } = maskFromRows([
      '.......#',
      '..####..',
      '..####..',
      '........',
    ])
    const result = largestComponent(mask, width, height)
    expect(result?.area).toBe(8)
    // the stray corner pixel must not be part of the winning component
    expect(result?.mask[7]).toBe(0)
  })

  it('flags a component that touches the image border', () => {
    const { mask, width, height } = maskFromRows(['##.', '#..', '...'])
    const result = largestComponent(mask, width, height)
    expect(result?.touchesBorder).toBe(true)
  })

  it('does not flag a component fully surrounded by background', () => {
    const { mask, width, height } = maskFromRows(['.....', '.###.', '.###.', '.....'])
    const result = largestComponent(mask, width, height)
    expect(result?.touchesBorder).toBe(false)
  })
})
