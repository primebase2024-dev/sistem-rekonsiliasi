// Service Worker untuk SAR PWA
const CACHE_NAME = 'sar-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
]

// Install: Cache file-file penting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
  self.skipWaiting()
})

// Activate: Bersihkan cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch: Network first, fallback ke cache
self.addEventListener('fetch', (event) => {
  // Jangan cache API calls ke Supabase (agar data selalu realtime)
  if (event.request.url.includes('supabase')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update cache dengan response baru
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // Jika offline, gunakan cache
        return caches.match(event.request)
      })
  )
})