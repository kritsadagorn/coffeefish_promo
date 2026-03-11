/* Simple SW cache for GitHub Pages static site */
const CACHE_NAME = "coffeefish-v1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
      ),
    ])
  );
});

function isImageRequest(request) {
  return request.destination === "image" || /\.(png|jpg|jpeg|gif|webp|avif)(\?.*)?$/i.test(request.url);
}

function isFontRequest(request) {
  return request.destination === "font" || /fonts\.(googleapis|gstatic)\.com/i.test(request.url);
}

// Stale-while-revalidate for images/fonts, network-first for html
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle same-origin + Google Fonts
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = /fonts\.(googleapis|gstatic)\.com$/i.test(url.hostname);
  if (!isSameOrigin && !isGoogleFonts) return;

  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isImageRequest(request) || isFontRequest(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            return resp;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});

