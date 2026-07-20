/**
 * crypto.randomUUID() is only exposed in secure contexts (HTTPS or localhost).
 * A phone reached over a plain-HTTP LAN address — the usual way to test the
 * camera capture input on a real device during development — is not a secure
 * context, so crypto.randomUUID would throw on every single capture.
 */
export function generatePageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-')
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
