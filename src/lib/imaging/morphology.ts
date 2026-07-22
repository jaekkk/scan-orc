/** True if (x, y) is inside the image bounds. */
function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height
}

/** Erosion: a pixel survives only if every pixel in its (2*radius+1) square neighborhood is foreground. Out-of-bounds neighbors count as background, so foreground touching the frame border shrinks inward. */
export function erodeMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let survives = true
      for (let dy = -radius; dy <= radius && survives; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (!inBounds(xx, yy, width, height) || !mask[yy * width + xx]) {
            survives = false
            break
          }
        }
      }
      out[y * width + x] = survives ? 1 : 0
    }
  }
  return out
}

/** Dilation: a pixel is foreground if any pixel in its (2*radius+1) square neighborhood is foreground. */
export function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = false
      for (let dy = -radius; dy <= radius && !hit; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (inBounds(xx, yy, width, height) && mask[yy * width + xx]) {
            hit = true
            break
          }
        }
      }
      out[y * width + x] = hit ? 1 : 0
    }
  }
  return out
}

/**
 * Morphological opening (erode then dilate): severs thin bridges connecting
 * the document silhouette to a nearby same-tone background region (e.g. a
 * glare highlight or shadow gradient bleeding into one corner) while
 * restoring the surviving blob to close to its original size and shape.
 * A bridge narrower than 2*radius+1 is fully eroded away and never returns
 * on the dilate pass, since dilation only regrows from surviving pixels.
 */
export function openMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return dilateMask(erodeMask(mask, width, height, radius), width, height, radius)
}
