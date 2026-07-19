/**
 * Structural stand-in for the DOM `ImageData` type. Using this instead of
 * `ImageData` directly lets the core pixel-processing functions run and be
 * unit-tested in plain Node (Vitest has no DOM/Canvas globals), while a real
 * browser `ImageData` object still satisfies this shape and can be passed in
 * directly at the call sites that live in the browser.
 */
export interface RawImage {
  data: Uint8ClampedArray
  width: number
  height: number
}
