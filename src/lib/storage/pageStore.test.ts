import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Page } from '../../types/page'
import { createPageSaver, loadStoredPages, toPage } from './pageStore'

function makePage(id: string, text = id): Page {
  const blob = (s: string) => new Blob([s], { type: 'image/jpeg' })
  return {
    id,
    thumbnailUrl: URL.createObjectURL(blob(`thumb-${text}`)),
    fullImageUrl: 'unused',
    fullImageBlob: blob(`full-${text}`),
    originalImageUrl: 'unused',
    originalImageBlob: blob(`orig-${text}`),
    width: 10,
    height: 20,
    boundaryConfidence: 'detected',
    createdAt: 1,
    quad: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ],
  }
}

/** The saver is fire-and-forget; a no-op call queued after it resolves once earlier writes finish. */
async function flush() {
  await new Promise((r) => setTimeout(r, 50))
}

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('scan-orc')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
})

describe('pageStore', () => {
  it('starts empty', async () => {
    expect(await loadStoredPages()).toEqual([])
  })

  it('round-trips pages with blobs and order', async () => {
    const save = createPageSaver([])
    save([makePage('a'), makePage('b')])
    await flush()

    const stored = await loadStoredPages()
    expect(stored.map((p) => p.id)).toEqual(['a', 'b'])
    expect(await stored[0].fullImageBlob.text()).toBe('full-a')
    expect(await stored[0].originalImageBlob.text()).toBe('orig-a')
    expect(await stored[0].thumbnailBlob.text()).toBe('thumb-a')

    const page = toPage(stored[1])
    expect(page.id).toBe('b')
    expect(page.quad).toHaveLength(4)
    expect(page.thumbnailUrl).toMatch(/^blob:/)
  })

  it('applies reorder, removal and additions', async () => {
    const a = makePage('a')
    const b = makePage('b')
    const save = createPageSaver([])
    save([a, b])
    await flush()

    const c = makePage('c')
    save([c, b])
    await flush()

    expect((await loadStoredPages()).map((p) => p.id)).toEqual(['c', 'b'])
  })

  it('does not rewrite restored pages, but saves replaced ones', async () => {
    const first = createPageSaver([])
    first([makePage('a', 'v1')])
    await flush()

    const restored = (await loadStoredPages()).map(toPage)
    const save = createPageSaver(restored)
    save(restored)
    await flush()
    expect(await (await loadStoredPages())[0].fullImageBlob.text()).toBe('full-v1')

    save([{ ...makePage('a', 'v2') }])
    await flush()
    expect(await (await loadStoredPages())[0].fullImageBlob.text()).toBe('full-v2')
  })

  it('clearing the list empties the store', async () => {
    const a = makePage('a')
    const save = createPageSaver([])
    save([a])
    await flush()
    save([])
    await flush()
    expect(await loadStoredPages()).toEqual([])
  })
})
