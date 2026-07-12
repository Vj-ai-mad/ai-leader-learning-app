import { completeModule } from '@/api'
import { getPendingCompletions, removePendingCompletion } from './db'

const MAX_RETRIES = 3

async function flushQueue() {
  if (!navigator.onLine) return

  const pending = await getPendingCompletions()
  if (pending.length === 0) return

  console.log(`[sync] Flushing ${pending.length} pending completion(s)`)

  for (const item of pending) {
    let attempt = 0
    let success = false

    while (attempt < MAX_RETRIES && !success) {
      try {
        await completeModule(item.dayIndex)
        await removePendingCompletion(item.dayIndex)
        success = true
        console.log(`[sync] Synced completion for day ${item.dayIndex}`)
      } catch (err) {
        attempt++
        console.warn(`[sync] Retry ${attempt}/${MAX_RETRIES} for day ${item.dayIndex}`, err)
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    }

    if (!success) {
      console.error(`[sync] Failed to sync day ${item.dayIndex} after ${MAX_RETRIES} attempts`)
      // Toast notification handled by the component layer that listens to the store
    }
  }
}

export function registerOnlineSync() {
  window.addEventListener('online', () => {
    console.log('[sync] Back online — flushing queue')
    flushQueue()
  })

  // Also try on page focus (handles cases where online event was missed)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushQueue()
    }
  })
}
