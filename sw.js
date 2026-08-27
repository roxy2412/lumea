const CACHE_VERSION = "lumea-light-v7";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/tienda.css?v=20260827a",
  "/taxonomy.js?v=20260827a",
  "/catalog-manual-products.js?v=20260827a",
  "/product-descriptions.js?v=20260630b",
  "/store.js?v=20260827a",
  "/tienda.js?v=20260827a",
  "/admin.js?v=20260827a",
  "/assets/lumea-logo-nuevo.webp",
  "/assets/lumea-logo-icono.webp",
  "/assets/lumea-logo-icono.png",
  "/assets/lumea-productos-ligero.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("lumea-") && key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallback = null) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : Response.error());
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) return cached;
  return (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api/bootstrap") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }
  if (
    url.pathname.startsWith("/assets/")
    || url.pathname.startsWith("/media/products/")
    || /\.(?:css|js|png|jpe?g|webp|svg|gif|mp4)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
