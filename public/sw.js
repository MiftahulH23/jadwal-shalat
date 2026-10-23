// Service worker: lets the app (especially the mosque display) open and run without internet.
// Schedules themselves are kept offline by the app in localStorage; this caches the app shell.

const VERSION = "v1"
const PAGES = `pages-${VERSION}`
const ASSETS = `assets-${VERSION}`
const SHELL = ["/", "/layar", "/bulanan"]

/** Static files referenced by a page (scripts, styles, fonts). */
async function referencedAssets(response) {
  const text = await response.text()
  return [...new Set(text.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])]
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES)
      const assets = await caches.open(ASSETS)
      const found = new Set()
      for (const path of SHELL) {
        const res = await fetch(path, { cache: "no-cache" })
        if (!res.ok) continue
        await pages.put(path, res.clone())
        for (const url of await referencedAssets(res)) found.add(url)
      }
      // Fonts are referenced from the CSS files, so look inside those too.
      for (const url of [...found].filter((u) => u.endsWith(".css"))) {
        const res = await fetch(url)
        if (res.ok) for (const font of await referencedAssets(res)) found.add(font)
      }
      await Promise.all([...found].map((url) => assets.add(url).catch(() => {})))
      await assets.addAll(["/manifest.webmanifest", "/icon.svg"]).catch(() => {})
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS]
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key)
      await self.clients.claim()
    })()
  )
})

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(fallbackKey ?? request, response.clone())
    return response
  } catch (error) {
    const cached = (await cache.match(fallbackKey ?? request)) ?? (fallbackKey ? await cache.match("/") : undefined)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone())
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // Schedule APIs: the app handles offline itself (stored month + local calculation).
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/kota") event.respondWith(networkFirst(request, ASSETS))
    return
  }

  // Hashed build files never change: serve from cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Pages: always try fresh, fall back to the stored copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, url.pathname))
    return
  }

  // Everything else (client navigation data, icons, manifest): fresh first, cached when offline.
  event.respondWith(networkFirst(request, ASSETS))
})
