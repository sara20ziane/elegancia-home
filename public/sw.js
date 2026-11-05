/* Elegancia: only immutable build resources and a data-free offline page. */
const VERSION = "elegancia-commerce-v2";
const CACHE = `${VERSION}-static`;
const ASSETS = /^\/(?:assets|_build|build)\/.+\.(?:js|css|woff2?|ttf|otf)$/i;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/offline.html", "/icon-192.png", "/icon-512.png"])),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE && /^(elegancia|openstore)/.test(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (/^\/(api|admin|login|setup|checkout|order|track)(\/|$)/.test(url.pathname)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match("/offline.html")) ||
          new Response("Connexion requise", { status: 503 }),
      ),
    );
  } else if (ASSETS.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (
          response.ok &&
          response.type === "basic" &&
          !/no-store|private/i.test(response.headers.get("Cache-Control") || "")
        )
          await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
