import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePageId } from './randomId'

describe('generatePageId', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
  })

  it('uses crypto.randomUUID when available (secure context)', () => {
    const spy = vi.spyOn(originalCrypto, 'randomUUID')
    generatePageId()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('falls back to crypto.getRandomValues when randomUUID is missing (insecure context, e.g. phone over LAN HTTP)', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
    })

    const id = generatePageId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('falls back to a Math.random-based id when crypto is entirely unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })

    const id = generatePageId()
    expect(id).toMatch(/^id-\d+-[0-9a-f]+$/)
  })

  it('never produces two equal ids across repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePageId()))
    expect(ids.size).toBe(100)
  })
})
