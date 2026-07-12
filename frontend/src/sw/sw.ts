/**
 * Custom service worker additions.
 * Workbox precaching and runtime caching is configured in vite.config.ts.
 * This file adds any custom SW logic needed beyond what Workbox generates.
 */

// Skip waiting so new SW activates immediately on update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // @ts-expect-error — self is ServiceWorkerGlobalScope
    self.skipWaiting()
  }
})
