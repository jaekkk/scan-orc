import { describe, expect, it } from 'vitest'
import { extractChannel } from './channels'

describe('extractChannel', () => {
  it('pulls out a single channel plane from interleaved RGBA data', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    expect(Array.from(extractChannel(data, 2, 1, 0))).toEqual([10, 40])
    expect(Array.from(extractChannel(data, 2, 1, 1))).toEqual([20, 50])
    expect(Array.from(extractChannel(data, 2, 1, 2))).toEqual([30, 60])
  })
})
