import type { Page } from '../../types/page'

const DB_NAME = 'scan-orc'
const PAGES = 'pages'
const META = 'meta'
const ORDER_KEY = 'order'

/** A Page as persisted: blobs instead of object URLs, which die with the tab. */
type StoredPage = Omit<Page, 'thumbnailUrl' | 'fullImageUrl' | 'originalImageUrl'> & { thumbnailBlob: Blob }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PAGES, { keyPath: 'id' })
      req.result.createObjectStore(META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Stored pages in their saved order; an unavailable or corrupt store just means nothing to restore. */
export async function loadStoredPages(): Promise<StoredPage[]> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction([PAGES, META])
      const [records, order] = await Promise.all([
        request<StoredPage[]>(tx.objectStore(PAGES).getAll()),
        request<string[] | undefined>(tx.objectStore(META).get(ORDER_KEY)),
      ])
      const byId = new Map(records.map((r) => [r.id, r]))
      return (order ?? []).flatMap((id) => byId.get(id) ?? [])
    } finally {
      db.close()
    }
  } catch (err) {
    console.warn('저장된 페이지 불러오기 실패:', err)
    return []
  }
}

export function toPage({ thumbnailBlob, ...rest }: StoredPage): Page {
  return {
    ...rest,
    thumbnailUrl: URL.createObjectURL(thumbnailBlob),
    fullImageUrl: URL.createObjectURL(rest.fullImageBlob),
    originalImageUrl: URL.createObjectURL(rest.originalImageBlob),
  }
}

async function toStored(page: Page): Promise<StoredPage> {
  const thumbnailBlob = await (await fetch(page.thumbnailUrl)).blob()
  return {
    id: page.id,
    thumbnailBlob,
    fullImageBlob: page.fullImageBlob,
    originalImageBlob: page.originalImageBlob,
    width: page.width,
    height: page.height,
    boundaryConfidence: page.boundaryConfidence,
    createdAt: page.createdAt,
    quad: page.quad,
  }
}

/**
 * Returns a function that mirrors a page list into IndexedDB: only pages whose
 * object changed since the last write are re-saved (blobs are large), removed
 * ones are deleted, and the order is stored separately. Writes run one at a
 * time in call order, and a failed write is retried implicitly by the next call.
 */
export function createPageSaver(restored: Page[]): (pages: Page[]) => void {
  const saved = new Map(restored.map((p) => [p.id, p]))
  let queue: Promise<void> = Promise.resolve()
  let askedForPersistence = false

  async function write(pages: Page[]) {
    const ids = new Set(pages.map((p) => p.id))
    const changed = pages.filter((p) => saved.get(p.id) !== p)
    const removed = [...saved.keys()].filter((id) => !ids.has(id))
    const records = await Promise.all(changed.map(toStored))

    const db = await openDb()
    try {
      const tx = db.transaction([PAGES, META], 'readwrite')
      const store = tx.objectStore(PAGES)
      for (const record of records) store.put(record)
      for (const id of removed) store.delete(id)
      tx.objectStore(META).put(pages.map((p) => p.id), ORDER_KEY)
      await transactionDone(tx)
    } finally {
      db.close()
    }

    for (const p of changed) saved.set(p.id, p)
    for (const id of removed) saved.delete(id)

    // Ask once so the browser is less likely to evict the scans under storage pressure.
    if (!askedForPersistence) {
      askedForPersistence = true
      void navigator.storage?.persist?.()
    }
  }

  return (pages) => {
    queue = queue.then(() => write(pages)).catch((err) => console.warn('페이지 저장 실패:', err))
  }
}
