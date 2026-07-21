export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

/** Cheap feature check for whether this browser can share files at all — used to decide whether to render a share button in the first place. */
export function canShareFiles(): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
}

/**
 * Shares files via the OS-native share sheet (Web Share API Level 2).
 *
 * This is the practical way to get a file out of a phone browser tab and
 * onto another device without a backend: on iOS Safari / Android Chrome it
 * surfaces AirDrop, Nearby Share, Save to Files, and any installed
 * cloud-storage or messaging app — the user picks whichever one they
 * already use to reach their PC/Mac. Desktop browsers and older mobile
 * browsers mostly don't support sharing files, so callers should
 * feature-detect with canShareFiles() and fall back to a plain download.
 */
export async function shareFiles(files: File[], data: { title?: string; text?: string } = {}): Promise<ShareResult> {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !navigator.canShare({ files })) {
    return 'unsupported'
  }

  try {
    await navigator.share({ ...data, files })
    return 'shared'
  } catch (err) {
    // The user backing out of the native share sheet throws AbortError —
    // that's a normal cancel, not a failure worth surfacing as an error.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    throw err
  }
}
