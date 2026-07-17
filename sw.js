const RELEASE_VERSION = "production-foundation-20260717-nav-order";
const CACHE_VERSION = `alwenda-shell-${RELEASE_VERSION}`;
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./auth/callback/index.html"];
const AUTH_CALLBACK_PATH = "/auth/callback";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function fallbackShellFor(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith(AUTH_CALLBACK_PATH)) return caches.match("./auth/callback/index.html");
  return caches.match("./index.html");
}

/** Network-first for same-origin GET requests, falling back to whatever
 * is cached (and finally to the app shell for navigations) when offline.
 * Every successful response is cached opportunistically, so most of the
 * app becomes available offline after the first real visit. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || (request.mode === "navigate" ? fallbackShellFor(request) : undefined))
      )
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ALWENDA_RELEASE_DIAGNOSTICS") {
    event.source?.postMessage({ type: "ALWENDA_RELEASE_DIAGNOSTICS", releaseVersion: RELEASE_VERSION, cacheVersion: CACHE_VERSION });
  }
});
