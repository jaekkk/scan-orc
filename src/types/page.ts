export type BoundaryConfidence = 'detected' | 'fallback'

export interface Page {
  id: string
  /** Small downscaled preview used in the thumbnail strip. */
  thumbnailUrl: string
  /** Full-resolution processed (cropped + scan-enhanced) image. */
  fullImageUrl: string
  fullImageBlob: Blob
  width: number
  height: number
  boundaryConfidence: BoundaryConfidence
  createdAt: number
  /** Undistorted, unenhanced photo as captured — kept so the user can fall back to it. */
  originalImageUrl: string
  originalImageBlob: Blob
}
