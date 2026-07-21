import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShareFiles, shareFiles } from './shareFiles'

function makeFile(): File {
  return new File(['x'], 'scan.pdf', { type: 'application/pdf' })
}

describe('canShareFiles', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup of a non-standard property
    delete navigator.share
    // @ts-expect-error test cleanup of a non-standard property
    delete navigator.canShare
  })

  it('is false when the browser has neither share nor canShare', () => {
    expect(canShareFiles()).toBe(false)
  })

  it('is true once both share and canShare exist', () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(), configurable: true })
    expect(canShareFiles()).toBe(true)
  })
})

describe('shareFiles', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup of a non-standard property
    delete navigator.share
    // @ts-expect-error test cleanup of a non-standard property
    delete navigator.canShare
  })

  it('returns "unsupported" when the Web Share API is absent (most desktop browsers)', async () => {
    const result = await shareFiles([makeFile()])
    expect(result).toBe('unsupported')
  })

  it('returns "unsupported" when canShare rejects this particular file set', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => false), configurable: true })
    const result = await shareFiles([makeFile()])
    expect(result).toBe('unsupported')
  })

  it('calls navigator.share with the files and returns "shared" on success', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })

    const file = makeFile()
    const result = await shareFiles([file], { title: 'scan' })

    expect(result).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'scan', files: [file] })
  })

  it('returns "cancelled" (not an error) when the user dismisses the native share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })

    const result = await shareFiles([makeFile()])
    expect(result).toBe('cancelled')
  })

  it('rethrows other share failures instead of swallowing them', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })

    await expect(shareFiles([makeFile()])).rejects.toThrow('boom')
  })
})
