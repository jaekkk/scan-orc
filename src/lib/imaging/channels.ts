/** Extracts a single RGBA channel (0=R, 1=G, 2=B, 3=A) as its own plane, so single-channel algorithms (blur, Otsu threshold) can run on it directly. */
export function extractChannel(data: Uint8ClampedArray, width: number, height: number, channel: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  for (let i = channel, p = 0; p < out.length; i += 4, p++) out[p] = data[i]
  return out
}
