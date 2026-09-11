/* GRIT service worker.
   Gyms have terrible signal, so the app shell must survive being offline.
   - Navigations: the cached shell first, refreshed in the background.
   - Same-origin assets: stale-while-revalidate, so a deploy lands on the next
     load rather than pinning an old bundle forever.

   Both are the same policy, and it is the one bad signal rewards. Network first
   is only as fast as the network: measured on a 4x-throttled phone with the
   whole app already cached, a launch behind a navigation request that took three
   seconds to answer took 3.6 s to become interactive, against 0.6 s served from
   the cache. A gym is full of links that are connected and useless, and waiting
   on one to render a shell we already have is the worst of both.
*/
// Both constants are rewritten at build time by the grit-stamp-sw plugin, so a
// deploy produces new worker bytes and the browser installs it.
const CACHE = 'grit-dev'
const PRECACHE = []
const SHELL = './index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One failed asset must not fail the install, so they are added
      // individually rather than through addAll.
      .then((cache) =>
        Promise.all([SHELL, './', ...PRECACHE].map((url) => cache.add(url).catch(() => {}))),
      )
      .catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(SHELL).then((cached) => {
        const network = fetch(request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {})
          return response
        })
        if (!cached) return network.catch(() => Response.error())
        // The refresh has to outlive the response, or returning the cached
        // shell cancels the fetch that would have replaced it and the worker
        // serves the same stale shell for ever.
        event.waitUntil(network.catch(() => {}))
        return cached
      }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => cached ?? Response.error())
      return cached ?? network
    }),
  )
})
