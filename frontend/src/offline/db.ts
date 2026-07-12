import { openDB, type DBSchema } from 'idb'

interface AppDB extends DBSchema {
  pendingCompletions: {
    key: number  // dayIndex
    value: {
      dayIndex: number
      userId: string
      timestamp: string  // ISO 8601
    }
  }
  cachedModules: {
    key: number  // dayIndex
    value: {
      dayIndex: number
      data: unknown
      cachedAt: string
    }
  }
}

let dbPromise: ReturnType<typeof openDB<AppDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>('ai-leader-app', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pendingCompletions')) {
          db.createObjectStore('pendingCompletions', { keyPath: 'dayIndex' })
        }
        if (!db.objectStoreNames.contains('cachedModules')) {
          db.createObjectStore('cachedModules', { keyPath: 'dayIndex' })
        }
      }
    })
  }
  return dbPromise
}

export async function queueCompletion(dayIndex: number, userId: string) {
  const db = await getDB()
  await db.put('pendingCompletions', {
    dayIndex,
    userId,
    timestamp: new Date().toISOString()
  })
}

export async function getPendingCompletions() {
  const db = await getDB()
  return db.getAll('pendingCompletions')
}

export async function removePendingCompletion(dayIndex: number) {
  const db = await getDB()
  await db.delete('pendingCompletions', dayIndex)
}
