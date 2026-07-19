import { useCallback, useState } from 'react'
import type { Page } from '../types/page'

function revokePageUrls(page: Page) {
  URL.revokeObjectURL(page.thumbnailUrl)
  URL.revokeObjectURL(page.fullImageUrl)
  URL.revokeObjectURL(page.originalImageUrl)
}

/** Revokes oldUrl unless the replacement page still references the same URL (e.g. "use original" keeps originalImageUrl). */
function revokeIfUnused(oldUrl: string, replacement: Page) {
  const stillUsed =
    oldUrl === replacement.thumbnailUrl ||
    oldUrl === replacement.fullImageUrl ||
    oldUrl === replacement.originalImageUrl
  if (!stillUsed) URL.revokeObjectURL(oldUrl)
}

export function usePages() {
  const [pages, setPages] = useState<Page[]>([])

  const addPage = useCallback((page: Page) => {
    setPages((prev) => [...prev, page])
  }, [])

  const replacePage = useCallback((id: string, newPage: Page) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        revokeIfUnused(p.thumbnailUrl, newPage)
        revokeIfUnused(p.fullImageUrl, newPage)
        revokeIfUnused(p.originalImageUrl, newPage)
        return newPage
      }),
    )
  }, [])

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) revokePageUrls(target)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const clearPages = useCallback(() => {
    setPages((prev) => {
      for (const p of prev) revokePageUrls(p)
      return []
    })
  }, [])

  return { pages, addPage, replacePage, removePage, reorderPages, clearPages }
}
